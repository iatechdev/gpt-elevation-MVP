// backend/worker/db.js
// Las cuatro funciones SQL del worker (ES-85) y nada más. El rol `elevation_worker` no puede leer ni escribir tablas de personas:
// toda la interacción con jobs, contexto y candidatas pasa por estas llamadas.
const { QueryTypes } = require('sequelize');

function createWorkerDb(sequelize) {
  const call = async (sql, replacements) => (await sequelize.query(sql, { replacements, type: QueryTypes.SELECT }))[0].r;
  return {
    // -> null o {jobId, fence, attempt, userId, kind, contextVersion, contextHash, payload, leaseExpiresAt, catalogVersion, skills}
    claim: (owner, leaseSeconds, maxAttempts) => call('SELECT worker_claim(:owner, :lease, :max) AS r', { owner, lease: leaseSeconds, max: maxAttempts }),
    // -> true si el job sigue siendo de este intento; false si ya no (invalidado, cancelado o reclamado por otro)
    heartbeat: (jobId, fence, owner, leaseSeconds) => call('SELECT worker_heartbeat(:job, :fence, :owner, :lease) AS r', { job: jobId, fence, owner, lease: leaseSeconds }),
    // -> {ok, candidates} | {ok:false, reason}. Lanza (22023 invalid_candidates) si la salida no pasa la validación del SQL.
    publish: (jobId, fence, candidates) => call('SELECT worker_publish(:job, :fence, CAST(:candidates AS jsonb)) AS r', { job: jobId, fence, candidates: JSON.stringify(candidates) }),
    // -> {ok, status} | {ok:false, reason:'fenced'|'job_not_found'}
    fail: (jobId, fence, errorCode, retryable, retryAfterSeconds, maxAttempts) => call(
      'SELECT worker_fail(:job, :fence, :error, :retryable, :wait, :max) AS r',
      { job: jobId, fence, error: errorCode, retryable: Boolean(retryable), wait: Math.max(0, Math.trunc(retryAfterSeconds || 0)), max: maxAttempts }),
  };
}

module.exports = { createWorkerDb };
