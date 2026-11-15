const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-175 (HU-P24): lo que la persona AUTORIZA mostrar a un revisor. Instantánea versionada: solo referencias (id de evidencia + versión confirmada), nunca texto.
// `materialVersion` sube con cada nueva autorización a ese revisor; la anterior queda `superseded`. `revoked` = la persona retiró el acceso. Tabla nueva (migración con RLS).
const ReviewShare = sequelize.define('ReviewShare', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  reviewerId: { type: DataTypes.INTEGER, allowNull: false },
  materialVersion: { type: DataTypes.INTEGER, allowNull: false },
  evidenceRefs: { type: DataTypes.JSON, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // granted | revoked | superseded
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { name: 'review_shares__request', unique: true, fields: ['UserId', 'requestId'] },
    { name: 'review_shares__version', unique: true, fields: ['UserId', 'reviewerId', 'materialVersion'] },
    { name: 'review_shares__reviewer', fields: ['reviewerId', 'status'] },
  ],
});

module.exports = ReviewShare;
