const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Registro de cada llamada al proveedor de IA (ES-22): tipo, modelo, versión de la aplicación, tokens, latencia, error y
// costo (solo si hay un precio versionado y verificado). NUNCA contiene mensajes, prompts ni respuestas. Tabla nueva.
const AiUsage = sequelize.define('AiUsage', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  kind: { type: DataTypes.STRING(24), allowNull: false },       // chat | recommendations | matching
  requestId: { type: DataTypes.STRING(64), allowNull: true },
  model: { type: DataTypes.STRING(64), allowNull: false },
  appVersion: { type: DataTypes.STRING(16), allowNull: true },
  periodKey: { type: DataTypes.STRING(16), allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false },     // reserved | completed | failed
  reservedTokens: { type: DataTypes.INTEGER, allowNull: false },
  inputTokens: { type: DataTypes.INTEGER, allowNull: true },
  outputTokens: { type: DataTypes.INTEGER, allowNull: true },
  costMicros: { type: DataTypes.INTEGER, allowNull: true },     // millonésimas de unidad de la moneda del precio
  currency: { type: DataTypes.STRING(8), allowNull: true },
  priceVersion: { type: DataTypes.STRING(32), allowNull: true },
  latencyMs: { type: DataTypes.INTEGER, allowNull: true },
  errorCode: { type: DataTypes.STRING(32), allowNull: true },
}, {
  indexes: [{ fields: ['periodKey'] }, { fields: ['UserId', 'periodKey'] }],
});

module.exports = AiUsage;
