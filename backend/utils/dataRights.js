const { randomUUID, createHmac } = require('crypto');
const { Transaction } = require('sequelize');
const { sequelize } = require('../database');
const User = require('../User');
const ExportRequest = require('../ExportRequest');
const DeletionRequest = require('../DeletionRequest');
const JWT_SECRET = require('../config/jwt');
const { deletionPending } = require('./deletionGuard');
const { personalData, requiresReview } = require('./personalData');
const { revokeForDeletion } = require('./consent');

class DataRightsError extends Error {
  constructor(status, code, es, en) {
    super(`${es} / ${en}`);
    this.status = status;
    this.code = code;
  }
}
const problem = (status, code, es, en) => new DataRightsError(status, code, es, en);
const unavailable = () => problem(503, 'professional_contract_pending',
  'La exportación profesional aún no está disponible.', 'Professional export is not available yet.');
const reviewRequired = () => problem(409, 'data_review_required',
  'Estos datos requieren revisión antes de exportar o eliminar.', 'These records require review before export or deletion.');
const blocked = () => problem(403, 'deletion_pending',
  'La cuenta tiene una solicitud de eliminación.', 'The account has a deletion request.');
const missing = () => problem(404, 'export_not_found', 'Exportación no encontrada.', 'Export not found.');

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
  return inTransaction(async transaction => {
    const user = await exportOwner(userId, transaction);
    const data = await personalData(user, locale, transaction);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await ExportRequest.create({ id, UserId: userId, locale, fingerprint: fingerprint(id, data), expiresAt }, { transaction });
    return { id, expiresAt, data };
  }, { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ });
}

// publish() runs while the owner's row is held. A deletion request cannot be
// accepted between the last authorization check and handing these bytes to HTTP.
async function download(userId, id, publish) {
  return inTransaction(async transaction => {
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
    return publish(data);
  }, { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ });
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
    await user.update({ active: false }, { transaction });
    await ExportRequest.destroy({ where: { UserId: userId }, transaction });
    return { ...receipt(row), repeated: false };
  });
}

module.exports = {
  DataRightsError, inTransaction, preview, download, requestDeletion, receipt, reviewRequired,
};
