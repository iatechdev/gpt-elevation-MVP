// backend/utils/aiJobs.js
// Ganchos de revocación y borrado del análisis de IA del worker (ES-88, ES-84). Borrado: el worker queda drenado al ACEPTAR la solicitud
// (requestDeletion invalida lo vivo; el reclamo y la publicación rechazan a quien tiene una solicitud) y la purga (processDeletion) borra
// las filas; después ni siquiera existe el job (worker_publish responde job_not_found). Una publicación en curso no puede colarse: sus
// candidatas se insertan con una clave foránea a Users (KEY SHARE) y tanto la solicitud como la purga toman esa fila FOR UPDATE al empezar. Lado del API: usa el rol de la aplicación, no el del worker.
// Todo se hace en la transacción del llamador: ninguna candidata ni job queda vigente tras una revocación, y el worker no puede publicar
// después (worker_publish revisa el consentimiento FOR SHARE, el estado del job y el fence; ver migración de ES-85).
//
// Orden de bloqueos (el mismo que worker_publish): consentimiento -> jobs -> candidatas. Primero los jobs: si una publicación está en curso,
// esperamos a que confirme y las candidatas que acaba de insertar ya son visibles cuando se invalidan (READ COMMITTED toma la instantánea
// por sentencia). Las transiciones las impone el disparador de la tabla (ai_jobs_guard / skill_candidates_guard).

const { Op } = require('sequelize');
const AiJob = require('../AiJob');
const SkillCandidate = require('../SkillCandidate');

const LIVE_JOB = ['PENDING', 'RUNNING', 'REVIEW_REQUIRED'];
const LIVE_CANDIDATE = ['REVIEW_REQUIRED', 'ACCEPTED'];
const REASONS = Object.freeze(['consent_revoked', 'context_revoked', 'deletion_requested']); // AiJobs.errorCode (varchar 32)

// Invalida los jobs vivos (PENDING, RUNNING, REVIEW_REQUIRED) y las candidatas vigentes (por revisar o aceptadas) de la persona.
// Devuelve cuántos cambió. `RUNNING` pasa a INVALIDATED: el worker lo nota en su heartbeat y, si llegara a publicar, el fence lo rechaza.
async function invalidateForUser(userId, reason, transaction) {
  if (!REASONS.includes(reason)) throw new Error('Motivo de invalidación desconocido.');
  const now = new Date();
  const [jobs] = await AiJob.update(
    { status: 'INVALIDATED', errorCode: reason, leaseOwner: null, leaseExpiresAt: null, finishedAt: now },
    { where: { UserId: userId, status: { [Op.in]: LIVE_JOB } }, transaction },
  );
  const [candidates] = await SkillCandidate.update(
    { status: 'INVALIDATED' },
    { where: { UserId: userId, status: { [Op.in]: LIVE_CANDIDATE } }, transaction },
  );
  return { jobs, candidates };
}


module.exports = { LIVE_JOB, LIVE_CANDIDATE, REASONS, invalidateForUser };
