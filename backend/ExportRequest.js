const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-23: metadata only. The preview's private contents are never stored here.
module.exports = sequelize.define('ExportRequest', {
  id: { type: DataTypes.UUID, primaryKey: true },
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  locale: { type: DataTypes.STRING(2), allowNull: false },
  fingerprint: { type: DataTypes.STRING(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, { updatedAt: false, indexes: [{ fields: ['UserId', 'expiresAt'] }] });
