const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');
module.exports = sequelize.define('RouteReviewRequest', {
  UserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
  status: { type: DataTypes.STRING(12), allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: true },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  inputHash: { type: DataTypes.STRING(64), allowNull: false },
}, { indexes: [
  { name: 'route_reviews_owner_request', unique: true, fields: ['UserId', 'requestId'] },
  { name: 'route_reviews_one_open', unique: true, fields: ['UserId'], where: { status: 'open' } },
] });
