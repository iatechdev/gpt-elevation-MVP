const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Versión inmutable de una evidencia (ES-27). `payload` va cifrado v2. `origins` son referencias privadas a turnos del chat
// (id, marca de tiempo y hash de la cita; nunca texto) y nunca viajan al motor. `hasChatOrigin` es la copia desnormalizada que usa
// el gancho de revocación del consentimiento. Tabla nueva: sync() la crea.
const EvidenceVersion = sequelize.define('EvidenceVersion', {
  EvidenceId: { type: DataTypes.INTEGER, allowNull: false },
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // draft | confirmed | revoked
  authoring: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'person' }, // person | ai_proposed (este último lo fijará ES-28)
  payload: { type: DataTypes.TEXT, allowNull: false },
  origins: { type: DataTypes.JSON, allowNull: false },
  hasChatOrigin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  consentVersion: { type: DataTypes.INTEGER, allowNull: true },
  requestId: { type: DataTypes.STRING(64), allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ['EvidenceId', 'version'] },
    { unique: true, fields: ['UserId', 'requestId'] },
    { fields: ['UserId', 'status'] },
  ],
});

module.exports = EvidenceVersion;
