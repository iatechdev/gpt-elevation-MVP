// backend/worker/config.js
// Configuración y comprobación del entorno del worker (ES-87): el proceso se niega a arrancar si el entorno rompe el aislamiento
// (spike 43, §5 y §15). Los nombres de variables viven en envNames.js (sin dependencias). Los mensajes nombran variables, nunca valores.

const professionalCrypto = require('../utils/professionalCrypto');
const aiBudget = require('../utils/aiBudget'); // importa database.js: worker.js fija la URL propia ANTES de cargar este módulo
const { FORBIDDEN, REQUIRED, presenceProblems } = require('./envNames');

const clamp = (value, low, high, fallback) => {
  const number = value === undefined || value === null || String(value).trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? Math.min(high, Math.max(low, Math.trunc(number))) : fallback;
};

function readWorkerConfig(env = process.env) {
  const ai = aiBudget.readConfig(env); // null si falta el tope por persona
  return {
    pollMs: clamp(env.WORKER_POLL_MS, 500, 60000, 5000),             // espera en reposo
    pollMaxMs: clamp(env.WORKER_POLL_MAX_MS, 1000, 300000, 30000),   // tope de la espera creciente
    leaseSeconds: clamp(env.WORKER_LEASE_SECONDS, 30, 1800, 180),    // el SQL también lo acota a 30–1800
    maxAttempts: clamp(env.WORKER_MAX_ATTEMPTS, 1, 10, 3),
    shutdownMs: clamp(env.WORKER_SHUTDOWN_MS, 1000, 300000, 60000),
    budgetRetrySeconds: clamp(env.WORKER_BUDGET_RETRY_SECONDS, 60, 86400, 900),
    ai: ai ? { timeoutMs: ai.timeoutMs, maxRetries: ai.maxRetries, perUser: ai.perUser } : null,
  };
}

// Devuelve la lista de problemas (vacía = entorno correcto). Sin valores.
function checkEnv(env = process.env) {
  const problems = presenceProblems(env);
  const config = readWorkerConfig(env);
  if (!config.ai && env.AI_BUDGET_TOKENS_PER_USER) problems.push('AI_BUDGET_TOKENS_PER_USER no es válida.');
  if (env.PROFESSIONAL_ENCRYPTION_KEY) {
    try { professionalCrypto.configured(); } catch (error) { problems.push(`PROFESSIONAL_ENCRYPTION_KEY: ${error.message}`); }
  }
  if (config.ai) {
    // El lease debe superar con margen lo máximo que puede tardar una llamada (intentos + reintentos del SDK).
    const worstCaseSeconds = Math.ceil((config.ai.timeoutMs * (config.ai.maxRetries + 1)) / 1000) + 30;
    if (config.leaseSeconds < worstCaseSeconds) {
      problems.push(`WORKER_LEASE_SECONDS (${config.leaseSeconds}) debe ser al menos ${worstCaseSeconds} (tiempo de espera de la llamada × intentos + margen).`);
    }
  }
  return problems;
}

module.exports = { FORBIDDEN, REQUIRED, readWorkerConfig, checkEnv };
