const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Versión del catálogo de habilidades (ES-29). La administra el cliente desde el backoffice. Un catálogo `published` es inmutable;
// para cambiarlo se crea un borrador, se edita y se publica como versión nueva. Tabla nueva: sync() la crea.
const SkillCatalog = sequelize.define('SkillCatalog', {
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(12), allowNull: false }, // draft | published | archived
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  publishedBy: { type: DataTypes.INTEGER, allowNull: true },
}, {
  indexes: [
    { unique: true, fields: ['version'] },
    { name: 'skill_catalogs_one_published', unique: true, fields: ['status'], where: { status: 'published' } }, // un solo catálogo vigente
    { name: 'skill_catalogs_one_draft', unique: true, fields: ['status'], where: { status: 'draft' } }, // un solo borrador abierto (nombres distintos: Sequelize nombra los índices por columna)
  ],
});

module.exports = SkillCatalog;
