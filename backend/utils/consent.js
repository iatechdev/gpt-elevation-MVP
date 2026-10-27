// backend/utils/consent.js
// Consentimiento por propósito y revocación (ES-19, RF-02). La autorización se verifica AL ACCEDER, no al guardar.

const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const Consent = require('../Consent');
const ConsentEvent = require('../ConsentEvent');
const { deletionPending } = require('./deletionGuard');

// Lista cerrada de propósitos. `required`: no se puede revocar desde la API (solo con la eliminación de la cuenta, ES-23).
const PURPOSES = Object.freeze({
  necessary: { required: true },            // operación necesaria
  professional_bridge: { required: false }, // transferencia de exploración a carrera
  facilitator_sharing: { required: false }, // compartir con el facilitador
  research: { required: false },            // investigación (opcional)
  notifications: { required: false },       // notificaciones (opcional)
});
const SCOPES = Object.freeze(['default']); // ES-25 amplía el alcance por campos del puente
const DEFAULT_SCOPE = 'default';
const STATUSES = Object.freeze(['granted', 'revoked']);
// Versión de política exigida por propósito: un «granted» con versión anterior deja de valer (hay que volver a consentir).
const REQUIRED_VERSION = Object.freeze({
  necessary: 1, professional_bridge: 1, facilitator_sharing: 1, research: 1, notifications: 1,
});

class ConsentRequiredError extends Error {
  constructor(purpose) {
    super('Consentimiento requerido. / Consent required.');
    this.code = 'consent_required';
    this.purpose = purpose;
  }
}

const isPurpose = (value) => typeof value === 'string' && Object.hasOwn(PURPOSES, value);
const isEffective = (row, purpose) => Boolean(row) && row.status === 'granted' && row.version >= REQUIRED_VERSION[purpose];
const keyOf = (userId, purpose, scope) => ({ UserId: userId, purpose, scope });
const validOwner = (userId) => Number.isSafeInteger(Number(userId)) && Number(userId) > 0;

// Lectura simple (sin bloqueo): para decisiones que no abren una operación de varios pasos.
async function hasConsent(userId, purpose, scope = DEFAULT_SCOPE) {
  if (!validOwner(userId) || !isPurpose(purpose)) return false;
  if (await deletionPending(userId)) return false;
  const row = await Consent.findOne({ where: keyOf(Number(userId), purpose, scope) });
  return isEffective(row, purpose);
}

// Ejecuta fn(transaction) con el consentimiento comprobado DENTRO de la transacción y con bloqueo compartido:
// una revocación concurrente espera a que termine la operación y ninguna operación nueva ve un consentimiento revocado (ADR-003).
async function withConsent(userId, purpose, fn, scope = DEFAULT_SCOPE) {
  if (!validOwner(userId) || !isPurpose(purpose)) throw new ConsentRequiredError(purpose);
  const transaction = await sequelize.transaction();
  let finished = false;
  try {
    const row = await Consent.findOne({
      where: keyOf(Number(userId), purpose, scope), transaction, lock: Transaction.LOCK.SHARE,
    });
    if (!isEffective(row, purpose) || await deletionPending(userId, transaction)) throw new ConsentRequiredError(purpose);
    const result = await fn(transaction);
    await transaction.commit();
    finished = true;
    return result;
  } catch (error) {
    if (!finished) await transaction.rollback().catch(() => {});
    throw error;
  }
}

// Registra una decisión. Idempotente: repetir el mismo estado con la versión vigente no crea un evento nuevo.
async function setConsent(userId, purpose, status, scope = DEFAULT_SCOPE) {
  for (let attempt = 1; ; attempt++) {
    const transaction = await sequelize.transaction();
    let finished = false;
    try {
      if (await deletionPending(userId, transaction)) throw new ConsentRequiredError(purpose);
      const where = keyOf(userId, purpose, scope);
      const current = await Consent.findOne({ where, transaction, lock: Transaction.LOCK.UPDATE });
      const version = REQUIRED_VERSION[purpose];
      if (current && current.status === status && current.version === version) {
        await transaction.commit();
        finished = true;
        return { row: current, changed: false };
      }
      const decidedAt = new Date();
      let row = current;
      if (current) await current.update({ status, version, decidedAt }, { transaction });
      else row = await Consent.create({ ...where, status, version, decidedAt }, { transaction });
      await ConsentEvent.create({ ...where, status, version, decidedAt }, { transaction });
      // ES-25: revocar el puente revoca, en la misma transacción, la versión de contexto que depende de él.
      if (purpose === 'professional_bridge' && status === 'revoked') await require('./careerContext').revokeForConsent(userId, transaction);
      await transaction.commit();
      finished = true;
      return { row, changed: true };
    } catch (error) {
      if (!finished) await transaction.rollback().catch(() => {});
      // Dos primeras decisiones simultáneas: la otra gana el INSERT; se reintenta una vez sobre la fila ya creada.
      if (error && error.name === 'SequelizeUniqueConstraintError' && attempt === 1) continue;
      throw error;
    }
  }
}

// ES-23 only: the necessary purpose may be revoked when deleting the account.
// Uses the caller's transaction; exclusive row locks wait for in-flight withConsent consumers.
async function revokeForDeletion(userId, transaction) {
  const rows = await Consent.findAll({ where: { UserId: userId }, transaction, lock: Transaction.LOCK.UPDATE });
  for (const row of rows) {
    if (row.status === 'revoked') continue;
    const decidedAt = new Date();
    await row.update({ status: 'revoked', decidedAt }, { transaction });
    await ConsentEvent.create({
      UserId: userId, purpose: row.purpose, scope: row.scope, status: 'revoked', version: row.version, decidedAt,
    }, { transaction });
  }
}

// Estado por propósito para la persona (sin contenido privado).
async function listConsents(userId) {
  const rows = await Consent.findAll({ where: { UserId: userId, scope: DEFAULT_SCOPE } });
  const byPurpose = new Map(rows.map((row) => [row.purpose, row]));
  return Object.keys(PURPOSES).map((purpose) => {
    const row = byPurpose.get(purpose);
    let status = 'undecided';
    if (row) status = row.status === 'granted' && !isEffective(row, purpose) ? 'outdated' : row.status;
    return {
      purpose,
      required: PURPOSES[purpose].required,
      scope: DEFAULT_SCOPE,
      status,
      version: row ? row.version : null,
      requiredVersion: REQUIRED_VERSION[purpose],
      decidedAt: row ? row.decidedAt : null,
    };
  });
}

async function listHistory(userId, limit = 100) {
  const events = await ConsentEvent.findAll({ where: { UserId: userId }, order: [['id', 'DESC']], limit });
  return events.map((e) => ({
    purpose: e.purpose, scope: e.scope, status: e.status, version: e.version, decidedAt: e.decidedAt,
  }));
}

// Middleware para rutas donde alguien accede a datos de OTRA persona: ownerOf(req) devuelve el titular de los datos.
// Cierra en falla: si no se puede comprobar, 503; sin consentimiento vigente, 403.
const requireConsent = (purpose, ownerOf, scope = DEFAULT_SCOPE) => async (req, res, next) => {
  let allowed;
  try {
    allowed = await hasConsent(ownerOf(req), purpose, scope);
  } catch (error) {
    console.error('No se pudo verificar el consentimiento.');
    return res.status(503).json({ error: 'No se pudo verificar el consentimiento. Intenta de nuevo.' });
  }
  if (!allowed) {
    return res.status(403).json({ error: 'Consentimiento requerido. / Consent required.', code: 'consent_required', purpose });
  }
  next();
};

module.exports = {
  PURPOSES, SCOPES, STATUSES, DEFAULT_SCOPE, REQUIRED_VERSION,
  ConsentRequiredError, isPurpose, isEffective,
  hasConsent, withConsent, setConsent, listConsents, listHistory, requireConsent,
  revokeForDeletion,
};
