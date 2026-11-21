const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-303 (PR A): invitación de una persona REVISORA para que una persona le autorice material. Un solo uso, vence, se puede anular.
// Solo se guarda el sha256 del código (nunca el código): se muestra UNA vez al emitirlo. `usedByUserId` es la persona que la canjeó (la purga de esa persona lo anula; el revisor NUNCA lo ve).
// Sin claves foráneas hacia Users (como ES-175). Tabla nueva (migración 20261120010000-es303-reviewer-invites.cjs).
const ReviewerInvite = sequelize.define('ReviewerInvite', {
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  usedAt: { type: DataTypes.DATE, allowNull: true },
  usedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { name: 'reviewer_invites__token', unique: true, fields: ['tokenHash'] },
    { name: 'reviewer_invites__request', unique: true, fields: ['reviewerId', 'requestId'] },
    { name: 'reviewer_invites__reviewer', fields: ['reviewerId', 'createdAt'] },
  ],
});

module.exports = ReviewerInvite;
