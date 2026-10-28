const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
module.exports = sequelize.define('RouteChoice', {
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
  roleKey: { type: DataTypes.STRING(48), allowNull: false },
  slot: { type: DataTypes.STRING(12), allowNull: false },
  decision: { type: DataTypes.STRING(8), allowNull: false },
  catalogVersion: { type: DataTypes.INTEGER, allowNull: false },
  constraintsVersion: { type: DataTypes.INTEGER, allowNull: false },
  basisHash: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  inputHash: { type: DataTypes.STRING(64), allowNull: false },
}, { indexes: [
  { name: 'route_choices_owner_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'route_choices_one_current', unique: true, fields: ['UserId', 'roleKey'], where: { status: 'current' } },
] });
