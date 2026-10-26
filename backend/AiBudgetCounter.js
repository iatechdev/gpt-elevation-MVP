const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Contador de tokens de IA por persona y periodo (ES-22). UserId = 0 es el contador de la cohorte (todo el despliegue).
// `used` suma lo reservado y lo consumido: la reserva se ajusta al uso real al terminar la llamada. Tabla nueva: sync() la crea.
const AiBudgetCounter = sequelize.define('AiBudgetCounter', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  periodKey: { type: DataTypes.STRING(16), allowNull: false },
  used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  indexes: [{ unique: true, fields: ['UserId', 'periodKey'] }],
});

module.exports = AiBudgetCounter;
