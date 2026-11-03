const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-132: enlaces de recuperación de contraseña. Solo se guarda el hash SHA-256 del token (nunca el token);
// usedAt marca el único uso (o la invalidación por una solicitud nueva).
const PasswordReset = sequelize.define('PasswordReset', {
  // Misma clave foránea que la migración (nombre PasswordResets_UserId_fkey): sin ella el modelo y la migración derivan (QA-132-04).
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ name: 'password_resets_user_created', fields: ['UserId', 'createdAt'] }], // mismo nombre que la migración
});

module.exports = PasswordReset;
