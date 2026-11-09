const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('./database');
const CryptoJS = require('crypto-js');
const PromptRule = require('./PromptRule');
const { reviewPrompt, loadActiveRules, PromptReviewError } = require('./utils/promptReview');

// ============================================
// 🔐 TABLA DE PROMPTS ENCRIPTADOS CON VERSIONADO
// ============================================
const PromptVault = sequelize.define('PromptVault', {
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false
  },
  contentEncrypted: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  // ---- NUEVO: flujo de aprobación ----
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
    // active | pending_review | approved | rejected | archived
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  updatedBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  proposed_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  approved_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rejected_by: {
    type: DataTypes.STRING,
    allowNull: true
  },
  rejection_note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  rejected_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // ES-191: resultado de la revisión automática. 'passed' = sin hallazgos (sigue pendiente de aprobación humana); 'rejected' = con motivos.
  // null = versión anterior a ES-191 (se revisa al aprobarla o al volver a ella).
  reviewOutcome: {
    type: DataTypes.STRING(12),
    allowNull: true
  },
  reviewReasons: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

// ============================================
// 🔒 FUNCIONES DE ENCRIPTACIÓN
// ============================================
const encryptPrompt = (plainText) => {
  const key = process.env.PROMPT_ENCRYPTION_KEY;
  if (!key) throw new Error('PROMPT_ENCRYPTION_KEY no está configurada');
  return CryptoJS.AES.encrypt(plainText, key).toString();
};

const decryptPrompt = (encryptedText) => {
  const key = process.env.PROMPT_ENCRYPTION_KEY;
  if (!key) throw new Error('PROMPT_ENCRYPTION_KEY no está configurada');
  const bytes = CryptoJS.AES.decrypt(encryptedText, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// ============================================
// 📖 OBTENER PROMPT ACTIVO POR CLAVE
// ============================================
const getActivePrompt = async (promptKey) => {
  let record = await PromptVault.findOne({
    where: { key: promptKey, status: 'active' }
  });
  // Fallback: buscar por isActive=true si no hay status='active'
  if (!record) {
    record = await PromptVault.findOne({
      where: { key: promptKey, isActive: true },
      order: [['version', 'DESC']]
    });
  }
  if (!record) return null;
  return decryptPrompt(record.contentEncrypted);
};

// ============================================
// 📤 PROPONER NUEVA VERSIÓN (rol: admin)
// Crea una versión pending_review sin tocar el activo
// ============================================
// ES-191: la revisión automática ocurre ANTES de guardar y decide solo entre 'pending_review' (pendiente de aprobación humana)
// y 'rejected' (con motivos). Nunca deja una versión activa ni aprobada. Devuelve { id, version, status, outcome, reasons }.
const proposePrompt = async (promptKey, plainText, adminEmail) => {
  // Límite de propuestas por clave y hora: las rechazadas también se guardan, no deben poder inundar la tabla.
  const perHour = Number.isInteger(Number(process.env.PROMPT_PROPOSALS_PER_HOUR)) && Number(process.env.PROMPT_PROPOSALS_PER_HOUR) > 0 ? Number(process.env.PROMPT_PROPOSALS_PER_HOUR) : 10;
  const recent = await PromptVault.count({ where: { key: promptKey, createdAt: { [Op.gt]: new Date(Date.now() - 3600 * 1000) } } });
  if (recent >= perHour) throw new PromptReviewError('rate_limited');
  // El límite va ANTES de revisar y cifrar: una ráfaga sobre el límite no gasta CPU (ES-191 E191-1).
  const review = reviewPrompt(plainText, await loadActiveRules(PromptRule));
  const encrypted = encryptPrompt(plainText);

  // Buscar la versión más alta existente para ese key
  const maxVersion = await PromptVault.max('version', { where: { key: promptKey } });
  const nextVersion = maxVersion ? Number(maxVersion) + 1 : 2;
  const rejected = review.outcome === 'rejected';

  // Crear nueva versión (NO toca el activo)
  const row = await PromptVault.create({
    key: promptKey,
    contentEncrypted: encrypted,
    version: nextVersion,
    status: rejected ? 'rejected' : 'pending_review',
    isActive: false,
    proposed_by: adminEmail,
    ...(rejected ? { rejected_by: 'revision-automatica', rejection_note: 'Rechazada por la revisión automática. / Rejected by the automatic review.', rejected_at: new Date() } : {}),
    reviewOutcome: review.outcome,
    reviewReasons: JSON.stringify(review.reasons),
    reviewedAt: new Date()
  });
  return { id: row.id, version: row.version, status: row.status, outcome: review.outcome, reasons: review.reasons };
};

// ES-191: la revisión de una guía ya guardada (versiones previas a ES-191, o antes de aprobar / volver a una versión).
// Falla cerrado: si las reglas no están disponibles, lanza PromptReviewError('rules_unavailable').
const reviewStored = async (record, options = {}) => {
  const review = reviewPrompt(decryptPrompt(record.contentEncrypted), await loadActiveRules(PromptRule));
  await record.update({ reviewOutcome: review.outcome, reviewReasons: JSON.stringify(review.reasons), reviewedAt: new Date() }, options);
  return review;
};

// ES-191 (E191-2): cambiar la guía activa de una clave es una sola operación serializada. Se bloquean las filas de esa clave
// dentro de una transacción y la versión se vuelve a leer ya con el bloqueo, así dos aprobaciones o volver-a-versión
// simultáneos no dejan dos versiones activas ni repiten la misma aprobación.
// Antes del bloqueo se deja registrada la revisión de una guía anterior a ES-191: si no pasa, el rechazo de la operación
// no debe deshacer ese registro (la transacción se revierte entera).
const withKeyLock = async (versionId, work, reviewable) => {
  const stored = await PromptVault.findByPk(versionId);
  if (stored && !stored.reviewOutcome && reviewable(stored)) await reviewStored(stored);
  return withKeyLockTx(versionId, work);
};
const withKeyLockTx = async (versionId, work) => sequelize.transaction(async (transaction) => {
  const first = await PromptVault.findByPk(versionId, { transaction });
  if (!first) throw new PromptReviewError('not_found');
  await PromptVault.findAll({ where: { key: first.key }, attributes: ['id'], order: [['id', 'ASC']], lock: transaction.LOCK.UPDATE, transaction });
  const record = await PromptVault.findByPk(versionId, { transaction });
  if (!record) throw new PromptReviewError('not_found');
  return work(record, transaction);
});

// ============================================
// ✅ APROBAR UNA VERSIÓN (rol: superadmin)
// ============================================
const approvePrompt = async (versionId, superAdminEmail) => withKeyLock(versionId, async (proposed, transaction) => {
  if (proposed.status !== 'pending_review') throw new PromptReviewError('not_pending');
  // ES-191: nada se activa sin revisión automática superada (la versión anterior a ES-191 se revisa ahora).
  const review = proposed.reviewOutcome ? { outcome: proposed.reviewOutcome } : await reviewStored(proposed, { transaction });
  if (review.outcome !== 'passed') throw new PromptReviewError('review_failed', JSON.parse(proposed.reviewReasons || '[]'));

  // Archivar la versión activa anterior
  await PromptVault.update(
    { status: 'approved', isActive: false },
    { where: { key: proposed.key, status: 'active' }, transaction }
  );

  // Activar la versión propuesta
  await proposed.update({
    status: 'active',
    isActive: true,
    approved_by: superAdminEmail,
    approved_at: new Date()
  }, { transaction });
}, (row) => row.status === 'pending_review');

// ============================================
// ❌ RECHAZAR UNA VERSIÓN (rol: superadmin)
// ============================================
const rejectPrompt = async (versionId, superAdminEmail, note = '') => {
  const proposed = await PromptVault.findByPk(versionId);
  if (!proposed) throw new PromptReviewError('not_found');
  if (proposed.status !== 'pending_review') throw new PromptReviewError('not_pending');

  await proposed.update({
    status: 'rejected',
    isActive: false,
    rejected_by: superAdminEmail,
    rejection_note: note,
    rejected_at: new Date()
  });
};

// ============================================
// 🔁 ROLLBACK A VERSIÓN ANTERIOR (rol: superadmin)
// ============================================
const rollbackPrompt = async (versionId, superAdminEmail) => withKeyLock(versionId, async (target, transaction) => {
  // ES-191: no se vuelve a una versión rechazada ni a una que la revisión automática no supera hoy.
  if (target.status === 'rejected' || target.status === 'pending_review') throw new PromptReviewError('review_failed', []);
  const review = target.reviewOutcome ? { outcome: target.reviewOutcome } : await reviewStored(target, { transaction });
  if (review.outcome !== 'passed') throw new PromptReviewError('review_failed', JSON.parse(target.reviewReasons || '[]'));

  // Archivar la activa actual
  await PromptVault.update(
    { status: 'approved', isActive: false },
    { where: { key: target.key, status: 'active' }, transaction }
  );

  // Activar la versión objetivo
  await target.update({
    status: 'active',
    isActive: true,
    approved_by: superAdminEmail,
    approved_at: new Date()
  }, { transaction });
}, (row) => row.status !== 'rejected' && row.status !== 'pending_review');

module.exports = {
  PromptVault,
  getActivePrompt,
  proposePrompt,
  reviewStored,
  approvePrompt,
  rejectPrompt,
  rollbackPrompt,
  encryptPrompt,
  decryptPrompt
};