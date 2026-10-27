const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Evidencia profesional (ES-27, RF-05): contenedor estable de una contribución. El contenido vive en EvidenceVersion
// (inmutable y cifrado). `deletedAt` marca el borrado (el contenido de todas las versiones se vacía). Tabla nueva: sync() la crea.
const Evidence = sequelize.define('Evidence', {
  UserId: { type: DataTypes.INTEGER, allowNull: false },
  currentVersion: { type: DataTypes.INTEGER, allowNull: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['UserId'] }],
});

module.exports = Evidence;
