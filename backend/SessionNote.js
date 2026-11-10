const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-179: `isLive` marca la ÚNICA nota en vivo de una sesión (autoguardado); las filas anteriores (isLive NULL) son historial y no se tocan.
// `version` sube en cada guardado de la nota en vivo (control de edición concurrente) y `requestId` hace idempotente el reintento de un guardado incierto.
const SessionNote = sequelize.define('SessionNote', {
  sessionId:   { type: DataTypes.INTEGER, allowNull: false },
  therapistId: { type: DataTypes.INTEGER, allowNull: false },
  content:     { type: DataTypes.TEXT,    allowNull: false },
  timestamp:   { type: DataTypes.DATE,    defaultValue: DataTypes.NOW },
  isLive:      { type: DataTypes.BOOLEAN, allowNull: true },
  version:     { type: DataTypes.INTEGER, allowNull: true },
  requestId:   { type: DataTypes.STRING(64), allowNull: true },
}, {
  indexes: [
    { name: 'session_notes__live', unique: true, fields: ['sessionId', 'therapistId'], where: { isLive: true } },
  ],
});

module.exports = SessionNote;
