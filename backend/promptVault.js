const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
const CryptoJS = require('crypto-js');

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
// 💾 GUARDAR PROMPT ACTIVO DIRECTO (solo para seed/migración)
// ============================================
const savePrompt = async (promptKey, plainText, adminEmail) => {
  const encrypted = encryptPrompt(plainText);
  const existing = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });

  if (existing) {
    await existing.update({
      contentEncrypted: encrypted,
      version: existing.version + 1,
      updatedBy: adminEmail
    });
  } else {
    await PromptVault.create({
      key: promptKey,
      contentEncrypted: encrypted,
      updatedBy: adminEmail,
      status: 'active',
      isActive: true
    });
  }
};

// ============================================
// 📤 PROPONER NUEVA VERSIÓN (rol: admin)
// Crea una versión pending_review sin tocar el activo
// ============================================
const proposePrompt = async (promptKey, plainText, adminEmail) => {
  const encrypted = encryptPrompt(plainText);

  // Buscar la versión activa para saber el número siguiente
  const active = await PromptVault.findOne({ where: { key: promptKey, status: 'active' } });
  // Si no hay activo, buscar la versión más alta existente para ese key
  const maxVersion = await PromptVault.max('version', { where: { key: promptKey } });
  const nextVersion = maxVersion ? Number(maxVersion) + 1 : 2;

  // Crear nueva versión en pending_review (NO toca el activo)
  await PromptVault.create({
    key: promptKey,
    contentEncrypted: encrypted,
    version: nextVersion,
    status: 'pending_review',
    isActive: false,
    proposed_by: adminEmail
  });
};

// ============================================
// ✅ APROBAR UNA VERSIÓN (rol: superadmin)
// ============================================
const approvePrompt = async (versionId, superAdminEmail) => {
  const proposed = await PromptVault.findByPk(versionId);
  if (!proposed || proposed.status !== 'pending_review') {
    throw new Error('Versión no encontrada o no está en pending_review');
  }

  // Archivar la versión activa anterior
  await PromptVault.update(
    { status: 'approved', isActive: false },
    { where: { key: proposed.key, status: 'active' } }
  );

  // Activar la versión propuesta
  await proposed.update({
    status: 'active',
    isActive: true,
    approved_by: superAdminEmail,
    approved_at: new Date()
  });
};

// ============================================
// ❌ RECHAZAR UNA VERSIÓN (rol: superadmin)
// ============================================
const rejectPrompt = async (versionId, superAdminEmail, note = '') => {
  const proposed = await PromptVault.findByPk(versionId);
  if (!proposed || proposed.status !== 'pending_review') {
    throw new Error('Versión no encontrada o no está en pending_review');
  }

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
const rollbackPrompt = async (versionId, superAdminEmail) => {
  const target = await PromptVault.findByPk(versionId);
  if (!target) throw new Error('Versión no encontrada');

  // Archivar la activa actual
  await PromptVault.update(
    { status: 'approved', isActive: false },
    { where: { key: target.key, status: 'active' } }
  );

  // Activar la versión objetivo
  await target.update({
    status: 'active',
    isActive: true,
    approved_by: superAdminEmail,
    approved_at: new Date()
  });
};

module.exports = {
  PromptVault,
  getActivePrompt,
  savePrompt,
  proposePrompt,
  approvePrompt,
  rejectPrompt,
  rollbackPrompt,
  encryptPrompt,
  decryptPrompt
};