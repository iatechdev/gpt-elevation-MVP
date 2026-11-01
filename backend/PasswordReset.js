const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-132: enlaces de recuperación de contraseña. Solo se guarda el hash SHA-256 del token (nunca el token);
// usedAt marca el único uso (o la invalidación por una solicitud nueva).
const PasswordReset = sequelize.define('PasswordReset', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['UserId', 'createdAt'] }],
});

module.exports = PasswordReset;
