// backend/worker/runner.js
// Bucle del worker (ES-87): sondeo con espera creciente, lease con heartbeat, un job a la vez, publicación con fence y apagado ordenado.
// Todo el estado vive en Postgres (ES-85); este proceso no guarda nada que no pueda perder. Si muere en cualquier punto, el lease vence
// y el job vuelve a PENDING (o FAILED al agotar intentos) sin duplicar resultados: el fence invalida cualquier publicación tardía.
const professionalCrypto = require('../utils/professionalCrypto');
const { analyze, InvalidOutputError } = require('./analyze');
const { codeOf } = require('./log');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Errores del análisis -> {errorCode, retryable, retryAfter}. Nunca se usa el mensaje del error.
function classify(error, { config, attempt }) {
  const code = error && error.code;
  if (code === 'ai_budget_exhausted') return { errorCode: 'budget_exhausted', retryable: true, retryAfter: config.budgetRetrySeconds };
  if (code === 'ai_budget_not_configured') return { errorCode: 'budget_not_configured', retryable: false, retryAfter: 0 };
  if (code === 'prompt_too_large') return { errorCode: 'prompt_too_large', retryable: false, retryAfter: 0 };
  if (code === 'context_invalid') return { errorCode: 'context_invalid', retryable: false, retryAfter: 0 };
  if (code === 'professional_key_missing' || code === 'unknown_key_id' || code === 'decryption_failed') return { errorCode: 'decrypt_failed', retryable: false, retryAfter: 0 };
  if (code === 'invalid_model_output' || error instanceof InvalidOutputError) return { errorCode: 'invalid_output', retryable: true, retryAfter: 10 * attempt };
  if (code === 'provider_unavailable') {
    const known = String(error.errorCode || 'provider_error').replace(/[^a-z_]/g, '').slice(0, 32) || 'provider_error';
    // Una petición mal formada o una credencial inválida no mejoran con reintentos.
    const retryable = !['bad_request', 'provider_auth'].includes(known);
    return { errorCode: known === 'unknown' ? 'provider_error' : known, retryable, retryAfter: Math.min(300, 30 * attempt) };
  }
  return { errorCode: 'internal_error', retryable: true, retryAfter: Math.min(300, 30 * attempt) };
}

function createRunner({ db, config, log, owner, ask, decrypt = professionalCrypto.decrypt, sleepFn = sleep }) {
  let stopping = false;
  let active = null; // promesa del job en curso
  let wake = null;

  // Procesa un job ya reclamado. Nunca lanza: lo que falle se registra y se devuelve al sistema de lease/fail.
  async function handle(job) {
    const { jobId, fence, attempt } = job;
    log('job_claimed', { jobId, fence, attempt });
    const started = Date.now();
    let lost = false;
    let heartbeatFailures = 0;
    const timer = setInterval(async () => {
      try {
        const alive = await db.heartbeat(jobId, fence, owner, config.leaseSeconds);
        heartbeatFailures = 0;
        if (!alive) { lost = true; log('lease_lost', { jobId, fence }); }
      } catch (error) {
        heartbeatFailures += 1;
        log('heartbeat_error', { jobId, code: codeOf(error) });
        if (heartbeatFailures * (config.leaseSeconds * 1000 / 3) >= config.leaseSeconds * 1000) lost = true; // el lease ya venció
      }
    }, Math.max(50, Math.floor((config.heartbeatMs ?? (config.leaseSeconds * 1000) / 3))));
    timer.unref?.();

    const failJob = async (error) => {
      const verdict = classify(error, { config, attempt });
      try {
        const out = await db.fail(jobId, fence, verdict.errorCode, verdict.retryable, verdict.retryAfter, config.maxAttempts);
        log('job_failed', { jobId, fence, errorCode: verdict.errorCode, retryable: verdict.retryable, status: out && out.status, reason: out && out.reason });
      } catch (failure) {
        log('job_fail_error', { jobId, code: codeOf(failure) }); // el lease vencerá y el barrido lo recuperará
      }
    };

    try {
      const plaintext = decrypt(job.payload);
      const { candidates, discarded } = await analyze({ userId: job.userId, plaintext, skills: job.skills, ask, limitTokens: config.ai && config.ai.perUser });
      if (lost) { log('job_skipped', { jobId, fence, reason: 'lease_lost' }); return; }
      let outcome;
      try {
        outcome = await db.publish(jobId, fence, candidates);
      } catch (error) {
        // 22023 = la validación del SQL rechazó la salida (no debería ocurrir tras validar aquí): no se reintenta a ciegas.
        if (error && error.parent && error.parent.code === '22023') { await failJob({ code: 'invalid_model_output' }); return; }
        log('publish_error', { jobId, code: codeOf(error) }); // sin saber si se confirmó: el lease/fence decide; no se llama a fail
        return;
      }
      if (outcome.ok) log('job_published', { jobId, fence, candidates: outcome.candidates, discarded, ms: Date.now() - started });
      else log('job_not_published', { jobId, fence, reason: outcome.reason });
    } catch (error) {
      if (lost) { log('job_skipped', { jobId, fence, reason: 'lease_lost' }); return; }
      await failJob(error);
    } finally {
      clearInterval(timer);
    }
  }

  // Una vuelta: reclama y procesa a lo sumo un job. -> 'processed' | 'idle' | 'error'
  async function runOnce() {
    let job;
    try {
      job = await db.claim(owner, config.leaseSeconds, config.maxAttempts);
    } catch (error) {
      log('claim_error', { code: codeOf(error) });
      return 'error';
    }
    if (!job) return 'idle';
    active = handle(job);
    try { await active; } finally { active = null; }
    return 'processed';
  }

  // Espera creciente en reposo (pollMs -> pollMaxMs), sin espera tras tomar trabajo; los fallos de base también espera creciente.
  async function loop() {
    let idleWait = config.pollMs;
    let errorWait = config.pollMs;
    while (!stopping) {
      const result = await runOnce();
      if (stopping) break;
      if (result === 'processed') { idleWait = config.pollMs; errorWait = config.pollMs; continue; }
      let wait;
      if (result === 'idle') { wait = idleWait; idleWait = Math.min(config.pollMaxMs, idleWait * 2); errorWait = config.pollMs; }
      else { wait = Math.min(60000, errorWait); errorWait = Math.min(60000, errorWait * 2); }
      const jittered = Math.round(wait * (0.9 + Math.random() * 0.2));
      log('poll_wait', { waitMs: jittered, reason: result });
      await new Promise((resolve) => { wake = resolve; sleepFn(jittered).then(resolve); });
      wake = null;
    }
  }

  // Apagado ordenado: deja de reclamar y espera el job en curso hasta shutdownMs. Si no termina, el lease lo recupera otro intento.
  async function stop() {
    stopping = true;
    if (wake) wake();
    if (!active) return 'clean';
    const finished = await Promise.race([active.then(() => 'clean'), sleepFn(config.shutdownMs).then(() => 'timeout')]);
    return finished;
  }

  return { runOnce, loop, stop, isStopping: () => stopping, handle };
}

module.exports = { createRunner, classify };
