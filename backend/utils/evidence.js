// backend/utils/evidence.js
// Evidencia profesional con procedencia (ES-27, RF-05). Contrato: docs/elevation-skillmap/20-CONTRATO-EVIDENCIA-PROCEDENCIA.md (§13).
// La persona registra una contribución real con sus límites. Meta, entrega y efecto observado son campos separados que el sistema
// nunca fusiona. Cada versión es inmutable y cifrada. Una evidencia que sale del chat guarda en la parte PRIVADA el id del turno y el
// hash de la cita, exige el consentimiento `professional_bridge` y nunca entrega turnos, citas ni IDs al motor.

const { createHash } = require('crypto');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const Evidence = require('../Evidence');
const EvidenceVersion = require('../EvidenceVersion');
const ChatTurn = require('../ChatTurn');
const ParticipantResume = require('../ParticipantResume');
const DerivedInvalidation = require('../DerivedInvalidation');
const { encriptarV2, desencriptar } = require('./crypto');
const { normalizeText, redactSecrets } = require('./promptSafety');
const { detectRisk } = require('./safety');
const consent = require('./consent');
const proposalToken = require('./proposalToken');

const PURPOSE = 'professional_bridge';
const STATUSES = ['draft', 'confirmed'];
const AUTONOMY = ['conceptual', 'assisted', 'autonomous', 'leads'];
const SOURCES = ['self_report', 'artifact_examined', 'exercise_observed'];
const PAYLOAD_KEYS = ['title', 'situation', 'responsibility', 'actions', 'alternatives', 'goal', 'delivered', 'observedEffect', 'learning', 'autonomy', 'artifactRefs'];
const MAX_ATTEMPTS = 6;

class EvidenceError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = (es = 'Datos inválidos.', en = 'Invalid data.') => new EvidenceError(400, 'invalid_input', es, en);
const notFound = () => new EvidenceError(404, 'evidence_not_found', 'Evidencia no encontrada.', 'Evidence not found.');
const consentError = () => new EvidenceError(403, 'consent_required',
  'Necesitas autorizar el puente profesional.', 'You need to authorize the professional bridge.');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const onlyKeys = (obj, keys) => Object.keys(obj).every((k) => keys.includes(k));

const cleanText = (value, min, max) => {
  if (typeof value !== 'string') throw invalid();
  const text = redactSecrets(normalizeText(value));
  if (text.length < min || text.length > max) throw invalid(`El texto debe tener entre ${min} y ${max} caracteres.`, `Text must be ${min} to ${max} characters.`);
  return text;
};

// Afirmación con procedencia. La persona solo puede enviar `self_report`: «artefacto examinado» y «ejercicio observado» exigen
// que alguien o algo lo haya hecho de verdad (una revisión o un ejercicio, otras historias).
function cleanClaim(value, max = 1000) {
  if (!isPlain(value) || !onlyKeys(value, ['text', 'source'])) throw invalid();
  const source = value.source === undefined ? 'self_report' : value.source;
  if (!SOURCES.includes(source) || source !== 'self_report') {
    throw new EvidenceError(400, 'invalid_source', 'La procedencia solo puede ser autorreporte.', 'Provenance can only be self-reported.');
  }
  return { text: cleanText(value.text, 1, max), source };
}

function cleanRef(value) {
  if (!isPlain(value)) throw invalid();
  if (value.kind === 'text') {
    if (!onlyKeys(value, ['kind', 'excerpt'])) throw invalid();
    return { kind: 'text', excerpt: cleanText(value.excerpt, 1, 1000) };
  }
  if (value.kind === 'url') {
    if (!onlyKeys(value, ['kind', 'url', 'note'])) throw invalid();
    if (typeof value.url !== 'string' || value.url.length > 500) throw invalid();
    let url;
    try { url = new URL(value.url); } catch { throw invalid(); }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw invalid();
    // Se guarda como dato y NUNCA se descarga, se abre ni se ejecuta (sin SSRF).
    const ref = { kind: 'url', url: url.toString() };
    if (value.note !== undefined) ref.note = cleanText(value.note, 1, 300);
    return ref;
  }
  throw invalid();
}

// Valida y normaliza el contenido. `status`: draft admite incompleto; confirmed exige lo obligatorio.
function normalizePayload(payload, status) {
  if (!isPlain(payload) || !onlyKeys(payload, PAYLOAD_KEYS)) throw invalid();
  const out = {};
  out.title = cleanText(payload.title, 1, 120);
  if (payload.situation !== undefined) out.situation = cleanText(payload.situation, 1, 1000);
  if (payload.responsibility !== undefined) out.responsibility = cleanClaim(payload.responsibility);
  if (payload.actions !== undefined) {
    if (!Array.isArray(payload.actions) || payload.actions.length < 1 || payload.actions.length > 8) throw invalid();
    out.actions = payload.actions.map((a) => cleanClaim(a));
  }
  if (payload.alternatives !== undefined) {
    if (!Array.isArray(payload.alternatives) || payload.alternatives.length > 5) throw invalid();
    out.alternatives = payload.alternatives.map((a) => cleanText(a, 1, 500));
  }
  if (payload.goal !== undefined) out.goal = cleanText(payload.goal, 1, 500);
  if (payload.delivered !== undefined) out.delivered = cleanClaim(payload.delivered);
  if (payload.observedEffect !== undefined) {
    const e = payload.observedEffect;
    if (!isPlain(e) || typeof e.known !== 'boolean') throw invalid();
    if (e.known) {
      if (!onlyKeys(e, ['known', 'claim'])) throw invalid();
      out.observedEffect = { known: true, claim: cleanClaim(e.claim) };
    } else {
      if (!onlyKeys(e, ['known'])) throw invalid();
      out.observedEffect = { known: false }; // resultado desconocido: válido y se conserva con ese límite
    }
  }
  if (payload.learning !== undefined) out.learning = cleanText(payload.learning, 1, 1000);
  if (payload.autonomy !== undefined && payload.autonomy !== null) {
    if (!AUTONOMY.includes(payload.autonomy)) throw invalid();
    out.autonomy = payload.autonomy;
  } else if (payload.autonomy === null) {
    out.autonomy = null;
  }
  if (payload.artifactRefs !== undefined) {
    if (!Array.isArray(payload.artifactRefs) || payload.artifactRefs.length > 5) throw invalid();
    out.artifactRefs = payload.artifactRefs.map(cleanRef);
  }
  if (status === 'draft' && Object.keys(out).length < 2) throw invalid('Un borrador necesita el título y al menos otro campo.', 'A draft needs a title and at least one more field.');
  if (status === 'confirmed') {
    const missing = ['situation', 'responsibility', 'actions', 'delivered', 'observedEffect'].filter((k) => out[k] === undefined);
    if (missing.length) {
      throw new EvidenceError(422, 'incomplete_evidence', 'Faltan campos obligatorios para confirmar.', 'Required fields are missing to confirm.', { missing });
    }
  }
  return out;
}

const norm = (s) => normalizeText(s).replace(/\s+/g, ' ').toLowerCase();

// Orígenes del chat: solo turnos de la persona. Verifica dueño y que la cita (si hay) aparece de verdad en el turno. Un turno que el
// detector de riesgo marca no se usa como fuente (el nivel de riesgo no se guarda ni se registra). No se guarda texto: solo id, marca de
// tiempo y hash de la cita.
async function resolveOrigins(userId, origins, transaction) {
  if (origins === undefined) return [];
  if (!Array.isArray(origins) || origins.length > 8) throw invalid();
  const out = [];
  for (const origin of origins) {
    if (!isPlain(origin) || !onlyKeys(origin, ['type', 'id', 'quote']) || origin.type !== 'chat_turn' || !Number.isSafeInteger(origin.id) || origin.id < 1) throw invalid();
    if (origin.quote !== undefined && (typeof origin.quote !== 'string' || origin.quote.length < 1 || origin.quote.length > 300)) throw invalid();
    const turn = await ChatTurn.findOne({ where: { id: origin.id, UserId: userId }, attributes: ['id', 'userContent', 'updatedAt'], transaction });
    if (!turn) throw new EvidenceError(404, 'origin_not_found', 'No se encontró el origen indicado.', 'The referenced source was not found.');
    const text = desencriptar(turn.userContent);
    if (detectRisk(text).level) {
      throw new EvidenceError(422, 'origin_not_usable', 'Ese fragmento no se puede usar como fuente.', 'That excerpt cannot be used as a source.');
    }
    const entry = { type: 'chat_turn', id: origin.id, stamp: new Date(turn.updatedAt).toISOString() };
    if (origin.quote !== undefined) {
      const quote = norm(origin.quote);
      if (!quote || !norm(text).includes(quote)) {
        throw new EvidenceError(422, 'quote_not_found', 'La cita no aparece en el turno indicado.', 'The quote does not appear in the referenced turn.');
      }
      entry.quoteHash = createHash('sha256').update(quote).digest('hex');
    }
    out.push(entry);
  }
  return out;
}

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

const decode = (row) => JSON.parse(desencriptar(row.payload));
// ES-110: si la evidencia salió de una hoja de vida, se informa de dónde (versión y fecha) y si esa versión ya no existe («para revisión»; nada se borra solo).
// De un origen del chat solo se informa que lo hay (`fromChat`): nunca su id ni su cita.
const summary = (ev, row, existingResumes) => {
  const out = { id: ev.id, version: row.version, status: row.status, authoring: row.authoring, createdAt: row.createdAt, payload: decode(row) };
  const resume = (Array.isArray(row.origins) ? row.origins : []).find((o) => o && o.type === 'resume');
  if (resume) out.origin = { kind: 'resume', version: resume.version, date: resume.stamp, needsReview: !(existingResumes && existingResumes.has(resume.id)) };
  if (row.hasChatOrigin) out.fromChat = true;
  return out;
};
const resumeIdsOf = async (userId, rows) => (rows.some((r) => Array.isArray(r.origins) && r.origins.some((o) => o && o.type === 'resume'))
  ? new Set((await ParticipantResume.findAll({ where: { UserId: userId }, attributes: ['id'] })).map((r) => r.id)) : new Set());

function parseWrite(body, { update }) {
  if (!isPlain(body) || !onlyKeys(body, update ? ['payload', 'status', 'baseVersion', 'requestId', 'origins', 'proposalToken'] : ['payload', 'status', 'requestId', 'origins', 'proposalToken'])) throw invalid();
  if (!STATUSES.includes(body.status)) throw invalid();
  if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.requestId)) throw invalid();
  if (update && (!Number.isSafeInteger(body.baseVersion) || body.baseVersion < 1)) throw invalid();
  return normalizePayload(body.payload, body.status);
}

// ES-28: `authoring` es `ai_proposed` solo si llega un proposalToken válido emitido a esta persona para una propuesta de la IA (aunque
// ella haya editado el borrador). Sin token, o con uno inválido, no se puede declarar: lo fija el servidor, nunca el cliente.
function authoringOf(userId, body) {
  if (body.proposalToken === undefined) return 'person';
  const verdict = proposalToken.check('evidence_proposal', userId, body.proposalToken);
  if (verdict === 'expired') throw new EvidenceError(410, 'proposal_expired', 'La propuesta venció.', 'The proposal expired.');
  if (verdict !== 'ok') throw new EvidenceError(409, 'proposal_mismatch', 'La propuesta no es válida.', 'The proposal is not valid.');
  return 'ai_proposed';
}

// Ejecuta `work` bajo el bloqueo de consentimiento solo cuando se confirma una evidencia con origen del chat.
async function guarded(userId, needsConsent, work) {
  for (let attempt = 1; ; attempt++) {
    try {
      if (!needsConsent) return await ownTransaction(work);
      try {
        return await consent.withConsent(userId, PURPOSE, work);
      } catch (error) {
        if (error instanceof consent.ConsentRequiredError) throw consentError();
        throw error;
      }
    } catch (error) {
      if (error && error.name === 'SequelizeUniqueConstraintError' && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
}

async function create(userId, body) {
  const payload = parseWrite(body, { update: false });
  const authoring = authoringOf(userId, body);
  const needsConsent = body.status === 'confirmed' && Array.isArray(body.origins) && body.origins.length > 0;
  return guarded(userId, needsConsent, async (transaction) => {
    const repeated = await EvidenceVersion.findOne({ where: { UserId: userId, requestId: body.requestId }, transaction });
    if (repeated) return { id: repeated.EvidenceId, version: repeated.version, created: false };
    const origins = await resolveOrigins(userId, body.origins, transaction);
    const ev = await Evidence.create({ UserId: userId, currentVersion: 1 }, { transaction });
    const row = await EvidenceVersion.create({
      EvidenceId: ev.id, UserId: userId, version: 1, status: body.status, authoring, payload: encriptarV2(JSON.stringify(payload)),
      origins, hasChatOrigin: origins.length > 0, consentVersion: origins.length && body.status === 'confirmed' ? consent.REQUIRED_VERSION[PURPOSE] : null,
      requestId: body.requestId,
    }, { transaction });
    return { id: ev.id, version: row.version, status: row.status, created: true };
  });
}

async function update(userId, id, body) {
  if (!Number.isSafeInteger(id) || id < 1) throw notFound();
  const payload = parseWrite(body, { update: true });
  const authoring = authoringOf(userId, body);
  const needsConsent = body.status === 'confirmed' && Array.isArray(body.origins) && body.origins.length > 0;
  return guarded(userId, needsConsent, async (transaction) => {
    const ev = await Evidence.findOne({ where: { id, UserId: userId, deletedAt: null }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!ev) throw notFound();
    const repeated = await EvidenceVersion.findOne({ where: { UserId: userId, requestId: body.requestId }, transaction });
    if (repeated) return { id: ev.id, version: repeated.version, status: repeated.status, created: false };
    if (body.baseVersion !== ev.currentVersion) {
      throw new EvidenceError(409, 'version_conflict', 'La evidencia cambió. Recárgala antes de editar.', 'The evidence changed. Reload it before editing.', { currentVersion: ev.currentVersion });
    }
    const chatOrigins = await resolveOrigins(userId, body.origins, transaction);
    const current = await EvidenceVersion.findOne({ where: { EvidenceId: ev.id, version: ev.currentVersion }, transaction });
    // ES-110: la procedencia «hoja de vida» es del servidor y no se pierde al editar (el cliente nunca puede crearla ni quitarla).
    const resumeOrigins = (current && Array.isArray(current.origins) ? current.origins : []).filter((o) => o && o.type === 'resume');
    const origins = [...resumeOrigins, ...chatOrigins];
    if (current && current.status !== 'draft') {
      // Lo derivado de la versión confirmada deja de ser válido: evaluaciones y rutas (ES-29, ES-32) deben recalcular.
      await DerivedInvalidation.create({ UserId: userId, sourceType: 'evidence', sourceId: ev.id, reason: 'edited' }, { transaction });
    }
    const row = await EvidenceVersion.create({
      EvidenceId: ev.id, UserId: userId, version: ev.currentVersion + 1, status: body.status, authoring, payload: encriptarV2(JSON.stringify(payload)),
      origins, hasChatOrigin: chatOrigins.length > 0, consentVersion: chatOrigins.length && body.status === 'confirmed' ? consent.REQUIRED_VERSION[PURPOSE] : null,
      requestId: body.requestId,
    }, { transaction });
    await ev.update({ currentVersion: row.version }, { transaction });
    return { id: ev.id, version: row.version, status: row.status, created: true };
  });
}

async function list(userId) {
  const evidences = await Evidence.findAll({ where: { UserId: userId, deletedAt: null }, order: [['id', 'ASC']] });
  const items = []; const rows = [];
  for (const ev of evidences) {
    const row = await EvidenceVersion.findOne({ where: { EvidenceId: ev.id, version: ev.currentVersion } });
    if (row) rows.push([ev, row]);
  }
  const existing = await resumeIdsOf(userId, rows.map(([, row]) => row));
  for (const [ev, row] of rows) items.push(summary(ev, row, existing));
  return { evidence: items };
}

async function get(userId, id) {
  if (!Number.isSafeInteger(id) || id < 1) throw notFound();
  const ev = await Evidence.findOne({ where: { id, UserId: userId, deletedAt: null } });
  if (!ev) throw notFound();
  const rows = await EvidenceVersion.findAll({ where: { EvidenceId: ev.id }, order: [['version', 'DESC']] });
  const existing = await resumeIdsOf(userId, rows);
  return { id: ev.id, currentVersion: ev.currentVersion, versions: rows.map((row) => summary(ev, row, existing)) };
}

// Borrar: se vacía el contenido de todas las versiones, se marca deletedAt y se registra la invalidación de lo derivado.
async function remove(userId, id) {
  if (!Number.isSafeInteger(id) || id < 1) throw notFound();
  return ownTransaction(async (transaction) => {
    const ev = await Evidence.findOne({ where: { id, UserId: userId, deletedAt: null }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!ev) throw notFound();
    const rows = await EvidenceVersion.findAll({ where: { EvidenceId: ev.id }, transaction });
    const emptied = encriptarV2('{}');
    for (const row of rows) await row.update({ payload: emptied, origins: [] }, { transaction });
    await ev.update({ deletedAt: new Date() }, { transaction });
    await DerivedInvalidation.create({ UserId: userId, sourceType: 'evidence', sourceId: ev.id, reason: 'deleted' }, { transaction });
    return { deleted: true };
  });
}

// Gancho de utils/consent.js: al revocar `professional_bridge`, las evidencias confirmadas con origen del chat dejan de estar vigentes
// en la MISMA transacción y se registra la invalidación. Las escritas directamente no dependen del consentimiento.
async function revokeForConsent(userId, transaction) {
  const rows = await EvidenceVersion.findAll({ where: { UserId: userId, status: 'confirmed', hasChatOrigin: true }, transaction, lock: Transaction.LOCK.UPDATE });
  let revoked = 0;
  for (const row of rows) {
    const ev = await Evidence.findOne({ where: { id: row.EvidenceId, UserId: userId, deletedAt: null }, transaction });
    if (!ev || ev.currentVersion !== row.version) continue; // solo la versión vigente
    await row.update({ status: 'revoked' }, { transaction });
    await DerivedInvalidation.create({ UserId: userId, sourceType: 'evidence', sourceId: ev.id, reason: 'revoked' }, { transaction });
    revoked++;
  }
  return revoked;
}

// ÚNICA puerta de lectura del motor: versiones confirmadas y vigentes, sin turnos, citas ni IDs del chat. Las que vienen del chat solo
// se entregan con el consentimiento vigente; si no lo hay, se entregan solo las escritas directamente.
async function getConfirmedEvidence(userId, consumer) {
  const collect = async (transaction, includeChat) => {
    const rows = await EvidenceVersion.findAll({ where: { UserId: userId, status: 'confirmed' }, transaction });
    const out = [];
    for (const row of rows) {
      if (row.hasChatOrigin && !includeChat) continue;
      const ev = await Evidence.findOne({ where: { id: row.EvidenceId, UserId: userId, deletedAt: null }, transaction });
      if (!ev || ev.currentVersion !== row.version) continue;
      out.push({ evidenceId: ev.id, version: row.version, payload: decode(row) });
    }
    return out.sort((a, b) => a.evidenceId - b.evidenceId);
  };
  void consumer;
  const probe = await EvidenceVersion.findOne({ where: { UserId: userId, status: 'confirmed', hasChatOrigin: true } });
  if (!probe) return ownTransaction((transaction) => collect(transaction, false));
  try {
    return await consent.withConsent(userId, PURPOSE, (transaction) => collect(transaction, true));
  } catch (error) {
    if (error instanceof consent.ConsentRequiredError) return ownTransaction((transaction) => collect(transaction, false));
    throw error;
  }
}

module.exports = {
  EvidenceError, create, update, list, get, remove, revokeForConsent, getConfirmedEvidence, normalizePayload,
};
