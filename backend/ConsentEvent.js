const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Historial de decisiones (solo altas, nunca se edita): propósito, alcance, versión, estado y fecha. Sin contenido privado.
const ConsentEvent = sequelize.define('ConsentEvent', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  purpose: { type: DataTypes.STRING(40), allowNull: false },
  scope: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  decidedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  updatedAt: false,
  indexes: [{ fields: ['UserId'] }],
});

module.exports = ConsentEvent;
