// backend/utils/careerContext.js
// Puente profesional (ES-25, RF-04). La persona escribe o aprueba, campo por campo, un texto profesional; el servidor guarda una
// copia versionada y cifrada. `getApprovedContext` es la ÚNICA puerta por la que el motor profesional lee algo del espacio de la
// persona, y solo entrega {version, approvedAt, fields:[{key,text}]}. Contrato: docs/elevation-skillmap/19-CONTRATO-PUENTE-PROFESIONAL.md.

const { createHmac, createHash, timingSafeEqual } = require('crypto');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const JWT_SECRET = require('../config/jwt');
const CareerContextVersion = require('../CareerContextVersion');
const BridgeTransfer = require('../BridgeTransfer');
const DerivedInvalidation = require('../DerivedInvalidation');
const DiaryEntry = require('../DiaryEntry');
const ChatTurn = require('../ChatTurn');
const { encriptarV2, desencriptar } = require('./crypto');
const { normalizeText, redactSecrets } = require('./promptSafety');
const { detectRisk } = require('./safety');
const consent = require('./consent');

const FIELD_KEYS = Object.freeze(['motivations', 'values', 'interests', 'energy_gives', 'energy_drains', 'desired_conditions', 'constraints']);
const MAX_TEXT = 500;
const MAX_PER_KEY = 3;
const MAX_FIELDS = 12;
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const PURPOSE = 'professional_bridge';
const MAX_ATTEMPTS = 6;
const ORIGIN_TYPES = ['direct', 'diary_entry', 'chat_turn'];

class BridgeError extends Error {
  constructor(status, code, es, en, extra = {}) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}
const invalid = (es = 'Datos inválidos.', en = 'Invalid data.') => new BridgeError(400, 'invalid_input', es, en);
const consentError = () => new BridgeError(403, 'consent_required',
  'Necesitas autorizar el puente profesional.', 'You need to authorize the professional bridge.');

const isPlain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Valida y normaliza. NO toca la base: devuelve [{key, text, origin}] con el texto saneado.
function normalizeFields(fields) {
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > MAX_FIELDS) throw invalid();
  const perKey = new Map();
  return fields.map((field, index) => {
    if (!isPlain(field) || Object.keys(field).some((k) => !['key', 'text', 'origin'].includes(k))) throw invalid();
    if (!FIELD_KEYS.includes(field.key) || typeof field.text !== 'string') throw invalid();
    const text = redactSecrets(normalizeText(field.text));
    if (text.length < 1 || text.length > MAX_TEXT) {
      throw invalid('Cada campo debe tener entre 1 y 500 caracteres.', 'Each field must be 1 to 500 characters.');
    }
    perKey.set(field.key, (perKey.get(field.key) || 0) + 1);
    if (perKey.get(field.key) > MAX_PER_KEY) throw invalid();
    const origin = field.origin === undefined ? { type: 'direct' } : field.origin;
    if (!isPlain(origin) || !ORIGIN_TYPES.includes(origin.type)) throw invalid();
    if (origin.type === 'direct') {
      if (Object.keys(origin).length !== 1) throw invalid();
    } else if (Object.keys(origin).some((k) => !['type', 'id'].includes(k)) || !Number.isSafeInteger(origin.id) || origin.id < 1) {
      throw invalid();
    }
    // Un texto que el detector de riesgo marca no puede cruzar. No se dice por qué ni se guarda nada.
    if (detectRisk(text).level) {
      throw new BridgeError(422, 'field_not_shareable',
        'Este texto no se puede compartir. Reescríbelo o déjalo fuera.', 'This text cannot be shared. Rewrite it or leave it out.', { fieldIndex: index });
    }
    return { key: field.key, text, origin: origin.type === 'direct' ? { type: 'direct' } : { type: origin.type, id: origin.id } };
  });
}

const needsBridge = (fields) => fields.some((f) => f.origin.type !== 'direct');
const representation = (fields) => fields.map(({ key, text }) => ({ key, text }));
const canonical = (fields) => JSON.stringify(fields.map(({ key, text, origin }) => [key, text, origin.type, origin.id ?? null]));

function sign(userId, expiresAtMs, fields) {
  return createHmac('sha256', JWT_SECRET).update('ES-25-preview-v1\0').update(String(userId)).update('\0')
    .update(String(expiresAtMs)).update('\0').update(canonical(fields)).digest('hex');
}
function checkToken(userId, token, fields) {
  const [expiresPart, mac] = typeof token === 'string' ? token.split('.') : [];
  const expiresAtMs = Number(expiresPart);
  if (!Number.isSafeInteger(expiresAtMs) || !/^[0-9a-f]{64}$/.test(mac || '')) throw invalid('Vista previa inválida.', 'Invalid preview.');
  const expected = Buffer.from(sign(userId, expiresAtMs, fields), 'hex');
  const given = Buffer.from(mac, 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new BridgeError(409, 'preview_mismatch', 'Los campos no coinciden con la vista previa.', 'The fields do not match the preview.');
  }
  if (expiresAtMs <= Date.now()) throw new BridgeError(410, 'preview_expired', 'La vista previa venció.', 'The preview has expired.');
}

// Comprueba que cada origen pertenece a la persona. No copia su contenido; devuelve la marca de tiempo del origen.
async function resolveOrigins(userId, fields, transaction) {
  const origins = [];
  for (const [index, field] of fields.entries()) {
    const { type, id } = field.origin;
    if (type === 'direct') { origins.push({ key: field.key, index, type }); continue; }
    const row = type === 'diary_entry'
      ? await DiaryEntry.findOne({ where: { id, UserId: userId, deletedAt: null }, attributes: ['id', 'updatedAt'], transaction })
      : await ChatTurn.findOne({ where: { id, UserId: userId }, attributes: ['id', 'updatedAt'], transaction });
    if (!row) throw new BridgeError(404, 'origin_not_found', 'No se encontró el origen indicado.', 'The referenced source was not found.');
    origins.push({ key: field.key, index, type, id, stamp: new Date(row.updatedAt).toISOString() });
  }
  return origins;
}

async function preview(userId, { fields }) {
  const clean = normalizeFields(fields);
  await resolveOrigins(userId, clean);
  if (needsBridge(clean) && !await consent.hasConsent(userId, PURPOSE)) throw consentError();
  const expiresAtMs = Date.now() + PREVIEW_TTL_MS;
  return {
    token: `${expiresAtMs}.${sign(userId, expiresAtMs, clean)}`,
    expiresAt: new Date(expiresAtMs),
    representation: representation(clean),
  };
}

const toRecord = (row, fields, extra = {}) => ({
  version: row.version, status: row.status, approvedAt: row.approvedAt, revokedAt: row.revokedAt ?? null, fields, ...extra,
});

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

async function confirm(userId, { fields, token, requestId }) {
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) throw invalid();
  const clean = normalizeFields(fields);
  checkToken(userId, token, clean);
  const withBridge = needsBridge(clean);

  const work = async (transaction) => {
    const rows = await CareerContextVersion.findAll({ where: { UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });
    const repeated = rows.find((r) => r.requestId === requestId);
    if (repeated) return { record: toRecord(repeated, JSON.parse(desencriptar(repeated.payload))), created: false };
    const origins = await resolveOrigins(userId, clean, transaction);
    for (const previous of rows.filter((r) => r.status === 'active')) {
      await previous.update({ status: 'superseded' }, { transaction });
      await DerivedInvalidation.create({ UserId: userId, sourceType: 'career_context_version', sourceId: previous.id, reason: 'superseded' }, { transaction });
    }
    const row = await CareerContextVersion.create({
      UserId: userId, version: rows.reduce((max, r) => Math.max(max, r.version), 0) + 1, status: 'active',
      payload: encriptarV2(JSON.stringify(representation(clean))), origins,
      consentVersion: withBridge ? consent.REQUIRED_VERSION[PURPOSE] : null, requestId, approvedAt: new Date(),
    }, { transaction });
    return { record: toRecord(row, representation(clean)), created: true };
  };

  for (let attempt = 1; ; attempt++) {
    try {
      if (!withBridge) return await ownTransaction(work);
      try {
        return await consent.withConsent(userId, PURPOSE, work);
      } catch (error) {
        if (error instanceof consent.ConsentRequiredError) throw consentError();
        throw error;
      }
    } catch (error) {
      // Confirmaciones simultáneas: gana el INSERT de una; las demás se reintentan (acotado) sobre lo ya creado.
      if (error && error.name === 'SequelizeUniqueConstraintError' && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
}

async function revokeActive(userId, transaction, { onlyWithConsent = false } = {}) {
  const rows = await CareerContextVersion.findAll({ where: { UserId: userId, status: 'active' }, transaction, lock: Transaction.LOCK.UPDATE });
  let revoked = 0;
  for (const row of rows) {
    if (onlyWithConsent && row.consentVersion === null) continue;
    await row.update({ status: 'revoked', revokedAt: new Date() }, { transaction });
    await DerivedInvalidation.create({ UserId: userId, sourceType: 'career_context_version', sourceId: row.id, reason: 'revoked' }, { transaction });
    revoked++;
  }
  return revoked;
}

// Revocación voluntaria desde el puente. Revoca la versión activa (no crea otra).
const revoke = (userId) => ownTransaction(async (transaction) => ({ revoked: (await revokeActive(userId, transaction)) > 0 }));

// Gancho de utils/consent.js: al revocar `professional_bridge`, la versión que dependa de él se revoca en la MISMA transacción.
// Las versiones con solo texto ingresado directamente no dependen del consentimiento y se conservan.
const revokeForConsent = (userId, transaction) => revokeActive(userId, transaction, { onlyWithConsent: true });

async function needsReviewFor(userId, origins) {
  for (const origin of origins) {
    if (origin.type === 'direct') continue;
    const row = origin.type === 'diary_entry'
      ? await DiaryEntry.findOne({ where: { id: origin.id, UserId: userId, deletedAt: null }, attributes: ['id', 'updatedAt'] })
      : await ChatTurn.findOne({ where: { id: origin.id, UserId: userId }, attributes: ['id', 'updatedAt'] });
    if (!row || new Date(row.updatedAt).toISOString() !== origin.stamp) return true;
  }
  return false;
}

// Consulta de la propia persona: versión activa e historial. Solo el dueño (userId viene de la sesión).
async function list(userId) {
  const rows = await CareerContextVersion.findAll({ where: { UserId: userId }, order: [['version', 'DESC']] });
  const versions = [];
  for (const row of rows) {
    const extra = row.status === 'active' ? { needsReview: await needsReviewFor(userId, row.origins) } : {};
    versions.push(toRecord(row, JSON.parse(desencriptar(row.payload)), extra));
  }
  return { active: versions.find((v) => v.status === 'active') ?? null, versions };
}

// ÚNICA puerta de lectura del motor profesional. Entrega solo clave y texto; sin IDs de origen, correo ni nombre.
// Si la versión incluye texto del espacio privado, la lectura exige el consentimiento vigente (bloqueo compartido).
async function getApprovedContext(userId, consumer) {
  const deliver = async (transaction) => {
    const row = await CareerContextVersion.findOne({ where: { UserId: userId, status: 'active' }, transaction });
    if (!row) throw new BridgeError(404, 'no_context', 'No hay contexto profesional autorizado.', 'There is no authorized professional context.');
    const fields = JSON.parse(desencriptar(row.payload)).map(({ key, text }) => ({ key, text }));
    const delivered = { version: row.version, approvedAt: row.approvedAt, fields };
    await BridgeTransfer.create({
      UserId: userId, version: row.version, keys: fields.map((f) => f.key),
      hash: createHash('sha256').update(JSON.stringify(delivered)).digest('hex'), consumer: String(consumer).slice(0, 32),
    }, { transaction });
    return delivered;
  };
  const active = await CareerContextVersion.findOne({ where: { UserId: userId, status: 'active' } });
  if (!active) throw new BridgeError(404, 'no_context', 'No hay contexto profesional autorizado.', 'There is no authorized professional context.');
  if (active.consentVersion === null) return ownTransaction(deliver); // solo texto directo: no depende del consentimiento
  try {
    return await consent.withConsent(userId, PURPOSE, deliver);
  } catch (error) {
    if (error instanceof consent.ConsentRequiredError) throw consentError();
    throw error;
  }
}

module.exports = { BridgeError, FIELD_KEYS, preview, confirm, revoke, revokeForConsent, list, getApprovedContext, normalizeFields };
