const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Habilidad con su rúbrica dentro de una versión del catálogo (ES-29). `labels` {es,en}; `rubric` {levels:{1..4:{es,en}}, source,
// verifiedBy, verifiedAt}. No es dato personal. Tabla nueva: sync() la crea.
const SkillDefinition = sequelize.define('SkillDefinition', {
  catalogId: { type: DataTypes.INTEGER, allowNull: false },
  skillKey: { type: DataTypes.STRING(48), allowNull: false },
  type: { type: DataTypes.STRING(12), allowNull: false }, // transversal | domain
  labels: { type: DataTypes.JSON, allowNull: false },
  rubric: { type: DataTypes.JSON, allowNull: false },
  // ES-116: territorios del mapa (ids de utils/skillCatalog.TERRITORIES). Metadato de presentación: NO entra en rubricHash.
  territories: { type: DataTypes.JSON, allowNull: true },
}, {
  indexes: [{ unique: true, fields: ['catalogId', 'skillKey'] }],
});

module.exports = SkillDefinition;
