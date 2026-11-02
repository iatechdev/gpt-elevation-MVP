// backend/utils/skillAnalysis.js
// API del análisis de IA del worker (ES-89, ES-84): crear, consultar y cancelar el análisis del contexto profesional autorizado y revisar las
// candidatas a competencia. El titular siempre es el userId de la sesión; un id ajeno responde 404 (no se revela que existe).
// Las candidatas son PROPUESTAS: aceptar una registra la decisión de la persona (con un nivel igual o MENOR al propuesto) y no certifica nada.
// No crea evaluaciones del Skill Map: un nivel allí exige evidencias confirmadas (ES-29) y el worker solo ve el contexto profesional.
// Lo que dispara el análisis se decide aquí con una sola variable (AI_ANALYSIS_TRIGGER): `explicit` (por defecto, la persona lo pide) o
// `automatic` (al confirmar el contexto profesional). Pendiente de confirmar por Alejo (ES-84).

const crypto = require('crypto');
const { Op, Transaction } = require('sequelize');
const { sequelize } = require('../database');
const AiJob = require('../AiJob');
const SkillCandidate = require('../SkillCandidate');
const SkillCatalog = require('../SkillCatalog');
const SkillDefinition = require('../SkillDefinition');
const CareerContextVersion = require('../CareerContextVersion');
const Consent = require('../Consent');
const consent = require('./consent');

const KIND = 'competency_extraction';
const PURPOSE = 'professional_bridge';
const LIVE_JOB = ['PENDING', 'RUNNING', 'REVIEW_REQUIRED'];
const ADVISORY_NAMESPACE = 8841; // serializa las altas de análisis de una misma persona (no choca con otros bloqueos)
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

class AnalysisError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = () => new AnalysisError(400, 'invalid_input', 'Datos inválidos.', 'Invalid data.');
const notFound = () => new AnalysisError(404, 'not_found', 'No se encontró.', 'Not found.');
const consentError = () => new AnalysisError(403, 'consent_required', 'Necesitas autorizar el puente profesional.', 'You need to authorize the professional bridge.');

const triggerMode = (env = process.env) => (env.AI_ANALYSIS_TRIGGER === 'automatic' ? 'automatic' : 'explicit');

// Motivo que ve la persona: códigos gruesos; nunca el detalle de infraestructura (proveedor, claves, lease).
const REASON = Object.freeze({
  budget_exhausted: 'budget', budget_not_configured: 'budget',
  provider_unavailable: 'provider', rate_limited: 'provider', timeout: 'provider', provider_error: 'provider', provider_auth: 'provider', bad_request: 'provider',
  invalid_output: 'invalid_output',
  consent_revoked: 'revoked', context_revoked: 'revoked', deletion_requested: 'revoked',
  context_changed: 'context_changed', context_reencrypted: 'context_changed',
});
const reasonOf = (errorCode) => (errorCode ? (REASON[errorCode] || 'internal') : null);

const jobDto = (job) => ({
  id: job.id, status: job.status, contextVersion: job.contextVersion, attempt: job.attempt,
  reason: reasonOf(job.errorCode),
  retryAt: job.status === 'PENDING' && job.notBefore && new Date(job.notBefore).getTime() > Date.now() ? job.notBefore : null,
  createdAt: job.createdAt, startedAt: job.startedAt ?? null, finishedAt: job.finishedAt ?? null,
});

const candidateDto = (row, labels) => ({
  id: row.id, jobId: row.jobId, skillKey: row.skillKey, label: labels.get(`${row.catalogVersion}|${row.skillKey}`) ?? null,
  level: row.level, confirmedLevel: row.confirmedLevel ?? null, citations: row.citations, status: row.status, reviewedAt: row.reviewedAt ?? null,
});

// Etiquetas {es, en} del catálogo con el que se validó cada candidata (datos públicos del cliente).
async function labelsFor(rows, transaction) {
  const labels = new Map();
  for (const version of [...new Set(rows.map((r) => r.catalogVersion))]) {
    const catalog = await SkillCatalog.findOne({ where: { version }, transaction });
    if (!catalog) continue;
    for (const def of await SkillDefinition.findAll({ where: { catalogId: catalog.id }, transaction })) labels.set(`${version}|${def.skillKey}`, def.labels);
  }
  return labels;
}

const ownTransaction = async (fn) => {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
};

const parseId = (raw) => {
  if (typeof raw !== 'string' && typeof raw !== 'number') throw notFound();
  const text = String(raw);
  if (!/^[1-9][0-9]{0,9}$/.test(text) || Number(text) > 2147483647) throw notFound();
  return Number(text);
};

// ── Crear ────────────────────────────────────────────────────────────────────────────────────────
// Núcleo, dentro de la transacción de quien llama. Un solo análisis vivo por persona (acota el gasto); idempotente por requestId.
// `quiet`: en el disparo automático, si no se puede crear se omite sin error.
async function createInTransaction(userId, requestId, transaction, { quiet = false } = {}) {
  await sequelize.query('SELECT pg_advisory_xact_lock(:ns, :id)', { replacements: { ns: ADVISORY_NAMESPACE, id: userId }, transaction });
  const existing = await AiJob.findOne({ where: { UserId: userId, requestId }, transaction });
  if (existing) return { job: existing, created: false };
  const live = await AiJob.findOne({ where: { UserId: userId, status: { [Op.in]: LIVE_JOB } }, order: [['id', 'DESC']], transaction });
  if (live) {
    if (quiet) return null;
    throw new AnalysisError(409, 'analysis_in_progress', 'Ya hay un análisis en curso o por revisar.', 'There is already an analysis in progress or awaiting review.', { job: jobDto(live) });
  }
  const context = await CareerContextVersion.findOne({ where: { UserId: userId, status: 'active' }, transaction });
  if (!context) {
    if (quiet) return null;
    throw new AnalysisError(409, 'no_context', 'No hay contexto profesional autorizado para analizar.', 'There is no authorized professional context to analyze.');
  }
  const job = await AiJob.create({
    UserId: userId, kind: KIND, contextVersion: context.version, contextHash: crypto.createHash('sha256').update(context.payload, 'utf8').digest('hex'),
    requestId, status: 'PENDING',
  }, { transaction });
  return { job, created: true };
}

async function createJob(userId, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((k) => k !== 'requestId') || typeof body.requestId !== 'string' || !REQUEST_ID.test(body.requestId)) throw invalid();
  try {
    const { job, created } = await consent.withConsent(userId, PURPOSE, (transaction) => createInTransaction(userId, body.requestId, transaction));
    return { job: jobDto(job), created };
  } catch (error) {
    if (error instanceof consent.ConsentRequiredError) throw consentError();
    throw error;
  }
}

// Disparo automático (AI_ANALYSIS_TRIGGER=automatic): lo llama careerContext.confirm en la MISMA transacción que crea la versión de contexto.
// Solo si el consentimiento está vigente (el worker lo vuelve a comprobar al reclamar y al publicar). Nunca hace fallar la confirmación.
async function autoCreate(userId, contextRequestId, transaction) {
  if (triggerMode() !== 'automatic') return null;
  const row = await Consent.findOne({ where: { UserId: userId, purpose: PURPOSE, scope: consent.DEFAULT_SCOPE }, transaction });
  if (!consent.isEffective(row, PURPOSE)) return null;
  const requestId = `auto-${crypto.createHash('sha256').update(`auto|${contextRequestId}`).digest('hex').slice(0, 40)}`;
  const result = await createInTransaction(userId, requestId, transaction, { quiet: true });
  return result && result.created ? result.job : null;
}

// ── Consultar ────────────────────────────────────────────────────────────────────────────────────
async function listJobs(userId) {
  const rows = await AiJob.findAll({ where: { UserId: userId }, order: [['id', 'DESC']], limit: 20 });
  return { jobs: rows.map(jobDto) };
}

async function getJob(userId, rawId) {
  const id = parseId(rawId);
  const job = await AiJob.findOne({ where: { id, UserId: userId } });
  if (!job) throw notFound();
  const rows = await SkillCandidate.findAll({ where: { jobId: id, UserId: userId }, order: [['id', 'ASC']] });
  const labels = await labelsFor(rows);
  return { ...jobDto(job), candidates: rows.map((r) => candidateDto(r, labels)) };
}

async function listCandidates(userId, query = {}) {
  const status = query.status;
  if (status !== undefined && !['REVIEW_REQUIRED', 'ACCEPTED', 'REJECTED', 'INVALIDATED'].includes(status)) throw invalid();
  const rows = await SkillCandidate.findAll({ where: { UserId: userId, ...(status ? { status } : {}) }, order: [['id', 'DESC']], limit: 200 });
  const labels = await labelsFor(rows);
  return { candidates: rows.map((r) => candidateDto(r, labels)) };
}

// ── Cancelar ─────────────────────────────────────────────────────────────────────────────────────
// La persona cancela un análisis vivo. Lo que aún no revisó se descarta (rechazada por la persona); lo que ya aceptó se conserva.
async function cancelJob(userId, rawId) {
  const id = parseId(rawId);
  return ownTransaction(async (transaction) => {
    const job = await AiJob.findOne({ where: { id, UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!job) throw notFound();
    if (job.status === 'CANCELLED') return jobDto(job); // idempotente
    if (!LIVE_JOB.includes(job.status)) {
      throw new AnalysisError(409, 'job_final', 'Este análisis ya terminó y no se puede cancelar.', 'This analysis has already finished and cannot be cancelled.');
    }
    const now = new Date();
    await job.update({ status: 'CANCELLED', leaseOwner: null, leaseExpiresAt: null, finishedAt: now }, { transaction }); // el worker lo nota en su heartbeat
    await SkillCandidate.update({ status: 'REJECTED', reviewedAt: now }, { where: { jobId: id, UserId: userId, status: 'REVIEW_REQUIRED' }, transaction });
    return jobDto(job);
  });
}

// ── Revisar candidatas ───────────────────────────────────────────────────────────────────────────
// { action: 'accept', level? } | { action: 'reject' }. Aceptar sin `level` conserva el propuesto; con `level` solo puede BAJARLO (o null).
function parseReview(body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : null;
  if (!keys || keys.some((k) => !['action', 'level'].includes(k)) || !['accept', 'reject'].includes(body.action)) throw invalid();
  if (body.action === 'reject') {
    if (body.level !== undefined) throw invalid();
    return { action: 'reject' };
  }
  if (body.level !== undefined && body.level !== null && !(Number.isInteger(body.level) && body.level >= 1 && body.level <= 4)) throw invalid();
  return { action: 'accept', level: body.level };
}

async function reviewCandidate(userId, rawId, body) {
  const id = parseId(rawId);
  const input = parseReview(body);
  return ownTransaction(async (transaction) => {
    const probe = await SkillCandidate.findOne({ where: { id, UserId: userId }, attributes: ['id', 'jobId'], transaction });
    if (!probe) throw notFound();
    // Mismo orden de bloqueos que el resto: primero el job, después la candidata.
    const job = await AiJob.findOne({ where: { id: probe.jobId, UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });
    const row = await SkillCandidate.findOne({ where: { id, UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!job || !row) throw notFound();

    const wanted = input.action === 'reject' ? { status: 'REJECTED', confirmedLevel: null }
      : { status: 'ACCEPTED', confirmedLevel: input.level === undefined ? row.level : input.level };
    if (row.status === 'INVALIDATED') {
      throw new AnalysisError(409, 'candidate_invalidated', 'Esta candidata ya no es válida.', 'This candidate is no longer valid.');
    }
    if (row.status !== 'REVIEW_REQUIRED') {
      if (row.status === wanted.status && (row.confirmedLevel ?? null) === wanted.confirmedLevel) return { ...candidateDto(row, await labelsFor([row], transaction)), repeated: true };
      throw new AnalysisError(409, 'already_reviewed', 'Esta candidata ya fue revisada.', 'This candidate has already been reviewed.');
    }
    if (wanted.status === 'ACCEPTED' && wanted.confirmedLevel !== null && (row.level === null || wanted.confirmedLevel > row.level)) {
      throw new AnalysisError(422, 'cannot_raise_level', 'No se puede subir un nivel por encima del propuesto.', 'A level cannot be raised above the proposed one.');
    }
    await row.update({ ...wanted, reviewedAt: new Date() }, { transaction });
    // Cuando no queda nada por revisar, el análisis termina.
    const pending = await SkillCandidate.count({ where: { jobId: job.id, status: 'REVIEW_REQUIRED' }, transaction });
    if (pending === 0 && job.status === 'REVIEW_REQUIRED') await job.update({ status: 'COMPLETED' }, { transaction });
    return { ...candidateDto(row, await labelsFor([row], transaction)), repeated: false };
  });
}

module.exports = {
  AnalysisError, KIND, LIVE_JOB, triggerMode, reasonOf, jobDto,
  createJob, createInTransaction, autoCreate, listJobs, getJob, listCandidates, cancelJob, reviewCandidate,
};
