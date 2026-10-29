// ES-109: histórico de hojas de vida de la persona (criterio 6). Cada función recibe el dueño y lo verifica en la consulta (UserId): un id ajeno es
// indistinguible de uno inexistente. Nada de aquí guarda ni registra el contenido del PDF, su texto ni su nombre original.
const crypto = require('crypto');
const { Transaction } = require('sequelize');
const ParticipantResume = require('../ParticipantResume');
const DerivedInvalidation = require('../DerivedInvalidation');
const User = require('../User');
const { encriptarBuffer, desencriptarBuffer } = require('./crypto');

const MAX_VERSIONS = 5; // recomendación aprobada el 29-oct: al llegar al tope se pide borrar una versión; nunca se borra sola

class ResumeError extends Error {
  constructor(code) { super('Operación de hoja de vida no permitida.'); this.code = code; }
}
const meta = (row) => ({ id: row.id, version: row.version, size: row.size, createdAt: row.createdAt });

async function listResumes(userId) {
  const rows = await ParticipantResume.findAll({ where: { UserId: userId }, attributes: ['id', 'version', 'size', 'createdAt'], order: [['version', 'DESC']] });
  return rows.map(meta);
}

// Dentro de la transacción de withConsent. Serializa por persona (bloqueo de su fila) para que dos subidas simultáneas no repitan versión ni pasen del tope.
async function storeResume(userId, buffer, transaction) {
  await User.findOne({ where: { id: userId }, attributes: ['id'], transaction, lock: Transaction.LOCK.UPDATE });
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const same = await ParticipantResume.findOne({ where: { UserId: userId, sha256 }, attributes: ['id', 'version', 'size', 'createdAt'], transaction });
  if (same) return { resume: meta(same), reused: true };
  const rows = await ParticipantResume.findAll({ where: { UserId: userId }, attributes: ['version'], transaction });
  if (rows.length >= MAX_VERSIONS) throw new ResumeError('resume_limit');
  const version = rows.reduce((top, row) => Math.max(top, row.version), 0) + 1;
  const row = await ParticipantResume.create({ UserId: userId, version, size: buffer.length, sha256, data: encriptarBuffer(buffer) }, { transaction });
  return { resume: meta(row), reused: false };
}

// -> { pdf, version } o null si no existe o no es de esta persona.
async function getResumeFile(userId, id) {
  const row = await ParticipantResume.findOne({ where: { id, UserId: userId } });
  return row ? { pdf: desencriptarBuffer(row.data), version: row.version } : null;
}

// Borra de verdad, sin copias. Lo derivado de esa versión se marca «para revisión» (invalidación registrada, ES-20).
async function deleteResume(userId, id, transaction) {
  const row = await ParticipantResume.findOne({ where: { id, UserId: userId }, attributes: ['id'], transaction, lock: transaction ? Transaction.LOCK.UPDATE : undefined });
  if (!row) return false;
  await row.destroy({ transaction });
  await DerivedInvalidation.create({ UserId: userId, sourceType: 'resume', sourceId: id, reason: 'deleted' }, { transaction });
  return true;
}

// Al retirar la autorización de lectura con IA se borran todas las versiones, en la misma transacción que la revocación (consent.setConsent).
async function revokeForConsent(userId, transaction) {
  const rows = await ParticipantResume.findAll({ where: { UserId: userId }, attributes: ['id'], transaction, lock: Transaction.LOCK.UPDATE });
  for (const row of rows) {
    await row.destroy({ transaction });
    await DerivedInvalidation.create({ UserId: userId, sourceType: 'resume', sourceId: row.id, reason: 'deleted' }, { transaction });
  }
  return rows.length;
}
module.exports = { MAX_VERSIONS, ResumeError, listResumes, storeResume, getResumeFile, deleteResume, revokeForConsent };
