const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Estado vigente de cada decisión de consentimiento (ES-19): una fila por persona + propósito + alcance.
// Tabla nueva: sync() la crea. El historial completo está en ConsentEvent.
const Consent = sequelize.define('Consent', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  purpose: { type: DataTypes.STRING(40), allowNull: false },
  scope: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'default' },
  status: { type: DataTypes.STRING(16), allowNull: false }, // granted | revoked
  version: { type: DataTypes.INTEGER, allowNull: false },
  decidedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['UserId', 'purpose', 'scope'] }],
});

module.exports = Consent;
