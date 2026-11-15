const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-173 (HU-P22): la opinión de la persona sobre el piloto. UNA fila por persona y ventana (`day7` | `day30`), con control de versión (`version`) e idempotencia por `lastRequestId`.
// `answers` guarda SOLO claves y valores de un catálogo cerrado (sin texto libre); al retirar la respuesta se SOBRESCRIBE con `{}` (no se oculta). Tabla nueva: RLS desde la migración.
// La columna se llama `windowKey` porque WINDOW es palabra reservada de PostgreSQL; la API la expone como `window`.
const PilotFeedback = sequelize.define('PilotFeedback', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  windowKey: { type: DataTypes.STRING(8), allowNull: false },
  questionnaireVersion: { type: DataTypes.INTEGER, allowNull: false },
  answers: { type: DataTypes.JSONB, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // active | withdrawn
  lastRequestId: { type: DataTypes.STRING(64), allowNull: true },
}, {
  indexes: [{ name: 'pilot_feedbacks__user_window', unique: true, fields: ['UserId', 'windowKey'] }],
});

module.exports = PilotFeedback;
