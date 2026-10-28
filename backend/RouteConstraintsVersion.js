const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
module.exports = sequelize.define('RouteConstraintsVersion', {
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false },
  payload: { type: DataTypes.TEXT, allowNull: false },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  inputHash: { type: DataTypes.STRING(64), allowNull: false },
}, { indexes: [
  { name: 'route_constraints_owner_version', unique: true, fields: ['UserId', 'version'] },
  { name: 'route_constraints_owner_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'route_constraints_one_current', unique: true, fields: ['UserId'], where: { status: 'current' } },
] });
