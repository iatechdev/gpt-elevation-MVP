const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// No cascade: this minimal tombstone must survive purges and be replayed after restores.
// No content, email, name, credential, provider response or raw exception in this table.
module.exports = sequelize.define('DeletionRequest', {
  id: { type: DataTypes.UUID, primaryKey: true },
  UserId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'accepted' },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  activePurgedAt: { type: DataTypes.DATE, allowNull: true },
  failureCode: { type: DataTypes.STRING(48), allowNull: true },
}, { indexes: [{ fields: ['status'] }] });
