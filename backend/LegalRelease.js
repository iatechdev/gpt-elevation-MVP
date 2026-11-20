const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-336 (F1) · Publicación de documentos legales (borrador / vigente / archivada). Texto público, sin datos personales.
// El modelo existe para que el esquema de sync() y el de las migraciones no deriven (db:drift); la lectura va por SQL crudo (utils/legalDocs.js).
// Los CHECK, los índices únicos parciales y los disparadores de inmutabilidad viven solo en la migración 20261120010000 (ver scripts/drift-allowed.json).
const LegalRelease = sequelize.define('LegalRelease', {
  version: { type: DataTypes.STRING(32), allowNull: false },
  status: { type: DataTypes.STRING(10), allowNull: false },
  changeKind: { type: DataTypes.STRING(10), allowNull: false },
  effectiveFrom: { type: DataTypes.DATE },
  notes: { type: DataTypes.STRING(500) },
  createdBy: { type: DataTypes.INTEGER },
  createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: sequelize.literal('now()') },
  publishedBy: { type: DataTypes.INTEGER },
  publishedAt: { type: DataTypes.DATE },
}, {
  timestamps: false,
  indexes: [{ unique: true, name: 'legal_releases_version', fields: ['version'] }],
});

module.exports = LegalRelease;
