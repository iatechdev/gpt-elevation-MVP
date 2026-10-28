// backend/utils/skillMap.js
// Skill Map trazable con nivel nullable (ES-29, RF-06). Contrato: docs/elevation-skillmap/21-CONTRATO-SKILL-MAP.md.
// Un nivel (1–4) existe solo si lo sustentan evidencias CONFIRMADAS y VIGENTES de la persona; si no, es null. Autoevaluación y revisión son
// pistas separadas. La confianza se calcula por reglas (la que declara un modelo no está calibrada). Este módulo NO lee ánimo, diario,
// chat ni crisis: su única entrada personal son las evidencias confirmadas (utils/evidence.getConfirmedEvidence).

const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const SkillAssessment = require('../SkillAssessment');
const DerivedInvalidation = require('../DerivedInvalidation');
const { encriptarV2, desencriptar } = require('./crypto');
const { normalizeText, redactSecrets } = require('./promptSafety');
const { getConfirmedEvidence } = require('./evidence');
const skillCatalog = require('./skillCatalog');

const CONFIDENCE_RULE_VERSION = 1;
const AUTONOMY_LEVEL = Object.freeze({ conceptual: 1, assisted: 2, autonomous: 3, leads: 4 });
const MAX_REFS = 8;
const MAX_ATTEMPTS = 6;
const CONFIDENCE_REASONS = Object.freeze({
  single_evidence: { es: 'Se apoya en una sola evidencia.', en: 'It rests on a single piece of evidence.' },
  multiple_evidence: { es: 'Se apoya en dos o más evidencias, todas de autorreporte.', en: 'It rests on two or more pieces of evidence, all self-reported.' },
  examined_provenance: { es: 'Se apoya en dos o más evidencias, con procedencia examinada u observada.', en: 'It rests on two or more pieces of evidence, with examined or observed provenance.' },
});

class SkillMapError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = (es = 'Datos inválidos.', en = 'Invalid data.') => new SkillMapError(400, 'invalid_input', es, en);
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (obj, keys) => Object.keys(obj).every((k) => keys.includes(k));

const claimsOf = (payload) => [payload.responsibility, ...(payload.actions || []), payload.delivered, payload.observedEffect?.claim].filter(Boolean);

// Confianza cualitativa por reglas: depende de la cantidad y la procedencia de la evidencia, no de lo que diga un modelo.
function confidenceFor(evidences) {
  const examined = evidences.some((e) => claimsOf(e.payload).some((c) => c.source && c.source !== 'self_report'));
  if (evidences.length >= 2 && examined) return { confidence: 'high', code: 'examined_provenance' };
  if (evidences.length >= 2) return { confidence: 'medium', code: 'multiple_evidence' };
  return { confidence: 'low', code: 'single_evidence' };
}

const isoNow = () => new Date();
async function ownTransaction(fn) {
  const transaction = await sequelize.transaction();
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function requireCatalog() {
  const catalog = await skillCatalog.getPublished();
  if (!catalog) throw new SkillMapError(503, 'catalog_unavailable', 'El catálogo de habilidades aún no está disponible.', 'The skill catalog is not available yet.');
  return catalog;
}

function parseSelf(body) {
  if (!isPlain(body) || !onlyKeys(body, ['skillKey', 'level', 'evidenceRefs', 'rationale', 'requestId'])) throw invalid();
  if (typeof body.skillKey !== 'string' || !skillCatalog.KEY_RE.test(body.skillKey)) throw invalid();
  if (body.level !== null && !(Number.isInteger(body.level) && body.level >= 1 && body.level <= 4)) throw invalid();
  if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.requestId)) throw invalid();
  const refs = body.evidenceRefs === undefined ? [] : body.evidenceRefs;
  if (!Array.isArray(refs) || refs.length > MAX_REFS) throw invalid();
  const seen = new Set();
  const evidenceRefs = refs.map((r) => {
    if (!isPlain(r) || !onlyKeys(r, ['evidenceId', 'version']) || !Number.isSafeInteger(r.evidenceId) || r.evidenceId < 1 || !Number.isSafeInteger(r.version) || r.version < 1) throw invalid();
    if (seen.has(r.evidenceId)) throw invalid();
    seen.add(r.evidenceId);
    return { evidenceId: r.evidenceId, version: r.version };
  });
  let rationale = null;
  if (body.rationale !== undefined && body.rationale !== null) {
    if (typeof body.rationale !== 'string') throw invalid();
    rationale = redactSecrets(normalizeText(body.rationale));
    if (rationale.length < 1 || rationale.length > 500) throw invalid('La nota debe tener entre 1 y 500 caracteres.', 'The note must be 1 to 500 characters.');
  }
  return { skillKey: body.skillKey, level: body.level, evidenceRefs, rationale, requestId: body.requestId };
}

const summarize = (row) => ({
  skillKey: row.skillKey, track: row.track, level: row.level, state: row.state, confidence: row.confidence,
  confidenceReason: CONFIDENCE_REASONS[row.confidenceReasonCode], evidenceRefs: row.evidenceRefs, catalogVersion: row.catalogVersion, authoring: row.authoring,
});

// Autoevaluación de la persona. `level: null` retira la vigente. Un nivel exige evidencias propias, confirmadas y en su versión vigente.
async function selfAssess(userId, body) {
  const input = parseSelf(body);
  const catalog = await requireCatalog();
  const skill = catalog.skills.get(input.skillKey);
  if (!skill) throw new SkillMapError(400, 'unknown_skill', 'Habilidad fuera del catálogo.', 'Skill is not in the catalog.');

  if (input.level === null) {
    return ownTransaction(async (transaction) => {
      const current = await SkillAssessment.findAll({ where: { UserId: userId, skillKey: input.skillKey, track: 'self', status: 'current' }, transaction, lock: Transaction.LOCK.UPDATE });
      for (const row of current) await row.update({ status: 'superseded' }, { transaction });
      return { cleared: current.length > 0 };
    });
  }
  if (!input.evidenceRefs.length) {
    throw new SkillMapError(422, 'evidence_required', 'Un nivel necesita al menos una evidencia.', 'A level needs at least one piece of evidence.');
  }
  const confirmed = new Map((await getConfirmedEvidence(userId, 'skill-map')).map((e) => [e.evidenceId, e]));
  const cited = input.evidenceRefs.map((ref, index) => {
    const found = confirmed.get(ref.evidenceId);
    if (!found || found.version !== ref.version) {
      throw new SkillMapError(422, 'evidence_not_valid', 'Una evidencia no existe, no está confirmada o ya no es la versión vigente.', 'A piece of evidence does not exist, is not confirmed, or is no longer the current version.', { index });
    }
    return found;
  });
  const { confidence, code } = confidenceFor(cited);
  const autonomies = cited.map((e) => AUTONOMY_LEVEL[e.payload.autonomy]).filter(Boolean);
  // Discrepancia entre el nivel de la persona y lo que declaran sus propias evidencias: requiere revisión humana, no se resuelve sola.
  const state = autonomies.length && Math.abs(input.level - Math.max(...autonomies)) >= 2 ? 'contradictory' : 'initial';

  for (let attempt = 1; ; attempt++) {
    try {
      return await ownTransaction(async (transaction) => {
        const repeated = await SkillAssessment.findOne({ where: { UserId: userId, requestId: input.requestId }, transaction });
        if (repeated) return { assessment: summarize(repeated), created: false };
        const current = await SkillAssessment.findAll({ where: { UserId: userId, skillKey: input.skillKey, track: 'self', status: 'current' }, transaction, lock: Transaction.LOCK.UPDATE });
        for (const row of current) await row.update({ status: 'superseded' }, { transaction });
        const row = await SkillAssessment.create({
          UserId: userId, skillKey: input.skillKey, track: 'self', level: input.level, state, catalogVersion: catalog.version, rubricHash: skill.rubricHash,
          evidenceRefs: input.evidenceRefs, confidence, confidenceReasonCode: code, confidenceRuleVersion: CONFIDENCE_RULE_VERSION,
          rationale: input.rationale === null ? null : encriptarV2(input.rationale), authoring: 'person', status: 'current', requestId: input.requestId,
        }, { transaction });
        return { assessment: summarize(row), created: true };
      });
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError' && attempt < MAX_ATTEMPTS) continue;
      if (error && error.name === 'SequelizeUniqueConstraintError') throw new SkillMapError(409, 'conflict', 'Otro cambio ocurrió al mismo tiempo. Reintenta.', 'Another change happened at the same time. Retry.');
      throw error;
    }
  }
}

// El mapa: una entrada por habilidad del catálogo vigente. Sin evidencia vigente el nivel es null. Sin agregados ni porcentajes.
async function getMap(userId) {
  const catalog = await requireCatalog();
  const confirmed = new Map((await getConfirmedEvidence(userId, 'skill-map')).map((e) => [e.evidenceId, e]));
  const rows = await SkillAssessment.findAll({ where: { UserId: userId, status: 'current' } });
  const skills = [];
  for (const skill of catalog.skills.values()) {
    const entry = { skillKey: skill.skillKey, type: skill.type, labels: skill.labels, rubric: { levels: skill.rubric.levels, source: skill.rubric.source, verifiedAt: skill.rubric.verifiedAt }, self: null, review: null };
    for (const track of ['self', 'review']) {
      const row = rows.find((r) => r.skillKey === skill.skillKey && r.track === track);
      if (!row) continue;
      // Si alguna evidencia citada cambió, se borró o dejó de estar vigente, el nivel deja de mostrarse hasta recalcular.
      const stale = row.evidenceRefs.some((ref) => confirmed.get(ref.evidenceId)?.version !== ref.version);
      entry[track] = {
        level: stale ? null : row.level, state: stale ? 'stale' : row.state, stale, catalogOutdated: row.rubricHash !== skill.rubricHash, confidence: row.confidence,
        confidenceReason: CONFIDENCE_REASONS[row.confidenceReasonCode], evidenceCount: row.evidenceRefs.length, authoring: row.authoring,
        rationale: row.rationale ? desencriptar(row.rationale) : null, needsReview: !stale && row.state === 'contradictory',
      };
    }
    entry.state = entry.self || entry.review ? (entry.review || entry.self).state : 'no_evidence';
    skills.push(entry);
  }
  // Los eventos de invalidación de evidencia ya están reflejados en este cálculo: se marcan como procesados.
  const pending = await DerivedInvalidation.findAll({ where: { UserId: userId, sourceType: 'evidence', handledAt: null } });
  for (const event of pending) await event.update({ handledAt: isoNow() });
  return { catalogVersion: catalog.version, skills };
}

const normalizeForQuote = (s) => normalizeText(String(s)).replace(/\s+/g, ' ').toLowerCase();
function evidenceTexts(payload) {
  const out = [];
  const walk = (value) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (isPlain(value)) Object.values(value).forEach(walk);
  };
  walk(payload);
  return out.map(normalizeForQuote);
}

// Validación pura de la salida de un modelo (la usará la propuesta con IA de ES-28). Descarta lo inválido y explica por qué; nunca confía
// en la confianza que declare el modelo. `skillKeys`: Set del catálogo vigente. `evidence`: Map evidenceId -> { version, payload }.
function validateAssessmentOutput(output, { skillKeys, evidence }) {
  const valid = [];
  const rejected = [];
  if (!Array.isArray(output) || output.length > 20) return { valid, rejected: [{ index: -1, reason: 'schema' }] };
  const seen = new Set();
  output.forEach((item, index) => {
    const reject = (reason) => rejected.push({ index, reason });
    if (!isPlain(item) || !onlyKeys(item, ['skillKey', 'level', 'evidenceRefs', 'rationale'])) return reject('schema');
    if (typeof item.skillKey !== 'string' || !skillKeys.has(item.skillKey)) return reject('unknown_skill');
    if (seen.has(item.skillKey)) return reject('duplicate_skill');
    if (item.level !== null && !(Number.isInteger(item.level) && item.level >= 1 && item.level <= 4)) return reject('level');
    if (!Array.isArray(item.evidenceRefs) || item.evidenceRefs.length > MAX_REFS) return reject('schema');
    if (item.level !== null && item.evidenceRefs.length === 0) return reject('level_without_evidence');
    if (typeof item.rationale !== 'string' || item.rationale.length < 1 || item.rationale.length > 500) return reject('rationale');
    const refs = [];
    for (const ref of item.evidenceRefs) {
      if (!isPlain(ref) || !onlyKeys(ref, ['evidenceId', 'version', 'quote']) || !Number.isSafeInteger(ref.evidenceId) || !Number.isSafeInteger(ref.version)) return reject('schema');
      const owned = evidence.get(ref.evidenceId);
      if (!owned || owned.version !== ref.version) return reject('evidence_not_owned_or_stale');
      if (ref.quote !== undefined) {
        const quote = normalizeForQuote(ref.quote);
        if (typeof ref.quote !== 'string' || !quote || !evidenceTexts(owned.payload).some((t) => t.includes(quote))) return reject('quote_not_found');
      }
      refs.push({ evidenceId: ref.evidenceId, version: ref.version });
    }
    seen.add(item.skillKey);
    valid.push({ skillKey: item.skillKey, level: item.level, evidenceRefs: refs, rationale: redactSecrets(normalizeText(item.rationale)) });
  });
  return { valid, rejected };
}

module.exports = {
  SkillMapError, selfAssess, getMap, validateAssessmentOutput, confidenceFor, CONFIDENCE_RULE_VERSION,
  // Internos que reutiliza la confirmación de las propuestas de la IA (ES-28).
  shared: { summarize, AUTONOMY_LEVEL, CONFIDENCE_REASONS, ownTransaction, requireCatalog, MAX_ATTEMPTS },
};
