const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Auditoría de la frontera (ES-25): una fila por lectura del motor profesional. Solo claves y un hash de lo entregado;
// nunca texto. Permite verificar qué campos cruzaron. Tabla nueva: sync() la crea.
const BridgeTransfer = sequelize.define('BridgeTransfer', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  keys: { type: DataTypes.JSON, allowNull: false },
  hash: { type: DataTypes.STRING(64), allowNull: false },
  consumer: { type: DataTypes.STRING(32), allowNull: false },
}, {
  updatedAt: false,
  indexes: [{ fields: ['UserId', 'createdAt'] }],
});

module.exports = BridgeTransfer;
