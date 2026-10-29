const { randomUUID, createHmac } = require('crypto');
const { Transaction, Op } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const ExportRequest = require('../ExportRequest');
const DeletionRequest = require('../DeletionRequest');
const JWT_SECRET = require('../config/jwt');
const { deletionPending } = require('./deletionGuard');
const { personalData, requiresReview } = require('./personalData');
const { revokeForDeletion } = require('./consent');
const DataRightsError = require('./dataRightsError');
const problem = (status, code, es, en) => new DataRightsError(status, code, es, en);
const unavailable = () => problem(503, 'professional_contract_pending',
  'La exportación profesional aún no está disponible.', 'Professional export is not available yet.');
const reviewRequired = () => problem(409, 'data_review_required',
  'Estos datos requieren revisión antes de exportar o eliminar.', 'These records require review before export or deletion.');
const blocked = () => problem(403, 'deletion_pending',
  'La cuenta tiene una solicitud de eliminación.', 'The account has a deletion request.');
const missing = () => problem(404, 'export_not_found', 'Exportación no encontrada.', 'Export not found.');

// QA-23-04: un fallo de serialización (40001) o un interbloqueo (40P01) significa que otra transacción cambió la misma cuenta a la vez,
// por ejemplo la aceptación de un borrado. Se reintenta UNA vez antes de entregar nada; el reintento ve el estado nuevo y responde con el
// motivo real (cuenta con solicitud de eliminación) en lugar de un 503 genérico.
const isConcurrency = (error) => ['40001', '40P01'].includes(error?.parent?.code || error?.original?.code || error?.code);
async function withRetry(fn, canRetry = () => true) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (error) {
      if (!(isConcurrency(error) && attempt === 1 && canRetry())) throw error;
    }
  }
}

// QA-23-03: las vistas previas de un mismo dueño se atienden de una en una dentro de este proceso. La segunda empieza cuando la primera ya
// confirmó, ve su fila y la reutiliza; el límite de frecuencia de la ruta acota el resto. (Despliegue de una sola instancia en el piloto.)
const ownerQueues = new Map();
function serialize(userId, fn) {
  const previous = ownerQueues.get(userId) || Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.then(() => {}, () => {});
  ownerQueues.set(userId, tail);
  tail.then(() => { if (ownerQueues.get(userId) === tail) ownerQueues.delete(userId); });
  return run;
}

async function inTransaction(fn, options = {}) {
  const transaction = await sequelize.transaction(options);
  try {
    const result = await fn(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

async function exportOwner(userId, transaction) {
  const user = await User.findByPk(userId, { transaction, lock: Transaction.LOCK.SHARE });
  if (!user || user.active === false || await deletionPending(userId, transaction)) throw blocked();
  if (user.role !== 'user' || await requiresReview(userId, transaction)) throw reviewRequired();
  return user;
}

function fingerprint(id, data) {
  return createHmac('sha256', JWT_SECRET).update('ES-23-preview-v1\0').update(id).update('\0')
    .update(JSON.stringify(data)).digest('hex');
}

async function preview(userId, { type, locale }) {
  if (type === 'professional') throw unavailable(); // No guessed bridge/evidence schemas or fixtures.
  return serialize(userId, () => withRetry(() => inTransaction(async transaction => {
    const user = await exportOwner(userId, transaction);
    const data = await personalData(user, locale, transaction);
    const now = new Date();
    await ExportRequest.destroy({ where: { UserId: userId, expiresAt: { [Op.lt]: now } }, transaction });
    const live = await ExportRequest.findAll({ where: { UserId: userId, expiresAt: { [Op.gt]: now } }, transaction });
    // Si ya hay una vista previa vigente con el mismo contenido y idioma, se reutiliza: no se crea otra fila.
    const same = live.find((row) => row.locale === locale && fingerprint(row.id, data) === row.fingerprint);
    if (same) return { id: same.id, expiresAt: same.expiresAt, data, reused: true };
    // Una vista previa nueva reemplaza a las anteriores del mismo dueño: nunca quedan más de una vigente.
    for (const row of live) await ExportRequest.destroy({ where: { UserId: userId, id: row.id }, transaction });
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await ExportRequest.create({ id, UserId: userId, locale, fingerprint: fingerprint(id, data), expiresAt }, { transaction });
    return { id, expiresAt, data, reused: false };
  }, { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ })));
}

// publish() runs while the owner's row is held. A deletion request cannot be
// accepted between the last authorization check and handing these bytes to HTTP.
async function download(userId, id, publish) {
  let published = false; // tras entregar bytes a HTTP ya no se reintenta
  return withRetry(() => inTransaction(async transaction => {
    const user = await exportOwner(userId, transaction);
    const request = await ExportRequest.findOne({ where: { id, UserId: userId }, transaction });
    if (!request) throw missing();
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      throw problem(410, 'export_expired', 'La vista previa venció.', 'The preview has expired.');
    }
    const data = await personalData(user, request.locale, transaction);
    if (fingerprint(id, data) !== request.fingerprint) {
      throw problem(409, 'export_outdated', 'Los datos cambiaron. Genera otra vista previa.', 'Data changed. Create a new preview.');
    }
    published = true;
    return publish(data);
  }, { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }), () => !published);
}

const receipt = row => ({
  id: row.id, status: row.status, requestedAt: row.createdAt, activePurgedAt: row.activePurgedAt ?? null,
  // No unverified promises about active data or backups.
  deadlinesVerified: false,
});

async function requestDeletion(userId) {
  return inTransaction(async transaction => {
    // Same lock order as export and purge. Serializes repeated requests per owner.
    const user = await User.findByPk(userId, { transaction, lock: Transaction.LOCK.UPDATE });
    const existing = await DeletionRequest.findOne({ where: { UserId: userId }, transaction });
    if (existing) return { ...receipt(existing), repeated: true };
    if (!user) throw blocked();
    const row = await DeletionRequest.create({
      id: randomUUID(), UserId: userId, status: 'accepted', attempts: 0,
    }, { transaction });
    await revokeForDeletion(userId, transaction);
    // ES-96 (ES93-A1): su terapeuta deja de tener acceso desde este instante (no al purgar, que es un paso de mantenimiento manual).
    await require('./therapistLink').unlinkTherapist(userId, 'account_deletion', transaction);
    await user.update({ active: false }, { transaction });
    await ExportRequest.destroy({ where: { UserId: userId }, transaction });
    return { ...receipt(row), repeated: false };
  });
}

module.exports = {
  DataRightsError, inTransaction, preview, download, requestDeletion, receipt, reviewRequired, isConcurrency,
};
