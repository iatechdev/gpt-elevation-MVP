const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Versión aprobada del contexto profesional (ES-25, RF-04). Copia inmutable de los campos que la persona vio y confirmó.
// `payload` (campos aprobados) va cifrado v2. `origins` son referencias privadas (tipo, id, marca de tiempo): nunca viajan
// al motor profesional ni contienen texto. Tabla nueva: sync() la crea.
const CareerContextVersion = sequelize.define('CareerContextVersion', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // active | superseded | revoked
  payload: { type: DataTypes.TEXT, allowNull: false },
  origins: { type: DataTypes.JSON, allowNull: false },
  consentVersion: { type: DataTypes.INTEGER, allowNull: true }, // solo si algún campo viene del espacio privado
  requestId: { type: DataTypes.STRING(64), allowNull: false },
  approvedAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [
    { unique: true, fields: ['UserId', 'version'] },
    { unique: true, fields: ['UserId', 'requestId'] },
    { unique: true, fields: ['UserId'], where: { status: 'active' } }, // a lo sumo una versión activa por persona
  ],
});

module.exports = CareerContextVersion;
