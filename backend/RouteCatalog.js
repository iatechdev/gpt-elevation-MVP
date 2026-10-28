const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Versión del catálogo curado de rutas, fuentes y recursos (ES-31). La escribe y revisa el cliente desde el backoffice. Un catálogo
// `published` es inmutable; para cambiarlo se crea un borrador, se edita y se publica como versión nueva. Sin datos personales.
// Tabla nueva: sync() la crea.
const RouteCatalog = sequelize.define('RouteCatalog', {
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // draft | published | archived
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  publishedBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    { unique: true, fields: ['version'] },
    // Nombres explícitos: Sequelize nombra los índices por columna y dos sobre `status` chocarían (lección de ES-29).
    { name: 'route_catalogs_one_published', unique: true, fields: ['status'], where: { status: 'published' } },
    { name: 'route_catalogs_one_draft', unique: true, fields: ['status'], where: { status: 'draft' } },
  ],
});

module.exports = RouteCatalog;
