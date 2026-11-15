const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('./database');

// ES-192: invitaciones por enlace. Solo se guarda el hash SHA-256 del token (nunca el token ni la contraseña).
// Un solo uso (usedAt) y vencimiento (expiresAt). `acceptedUserId` enlaza la invitación con la cuenta que se creó (derechos de datos, ES-23).
// `email` es el de una persona que quizá nunca se registre: las filas vencidas o usadas se limpian al crear invitaciones nuevas.
const Invitation = sequelize.define('Invitation', {
  email: { type: DataTypes.STRING(254), allowNull: false },
  role: { type: DataTypes.STRING(16), allowNull: false },
  invitedBy: { type: DataTypes.INTEGER, allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  locale: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'es' },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
  acceptedUserId: { type: DataTypes.INTEGER, allowNull: true },
  requestId: { type: DataTypes.STRING(64), allowNull: true }, // ES-186 B: invitar es idempotente por (invitedBy, requestId)
}, {
  indexes: [
    { fields: ['email', 'createdAt'], name: 'invitations__email_created_at' },
    { fields: ['invitedBy', 'createdAt'], name: 'invitations__invited_by_created_at' },
    { fields: ['invitedBy', 'requestId'], name: 'invitations__invited_by_request_id', unique: true, where: { requestId: { [Op.ne]: null } } },
  ],
});

module.exports = Invitation;
