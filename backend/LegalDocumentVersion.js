const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// ES-336 (F1) · Un documento legal (clave + idioma) dentro de una publicación. Contenido estructurado y validado (utils/legalContent.js), sin datos personales.
// Modelo solo para que sync() y las migraciones no deriven (db:drift); la lectura va por SQL crudo (utils/legalDocs.js).
// CHECK de clave e idioma, unicidad (releaseId, docKey, lang) como restricción y disparadores de inmutabilidad: solo en la migración (scripts/drift-allowed.json).
const LegalDocumentVersion = sequelize.define('LegalDocumentVersion', {
  releaseId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'LegalReleases', key: 'id' }, onDelete: 'RESTRICT' },
  docKey: { type: DataTypes.STRING(20), allowNull: false },
  lang: { type: DataTypes.STRING(2), allowNull: false },
  content: { type: DataTypes.JSONB, allowNull: false },
  contentHash: { type: DataTypes.CHAR(64), allowNull: false },
}, {
  timestamps: false,
  indexes: [{ unique: true, name: 'legal_document_versions_unique', fields: ['releaseId', 'docKey', 'lang'] }],
});

module.exports = LegalDocumentVersion;
