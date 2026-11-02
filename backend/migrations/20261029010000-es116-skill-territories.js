'use strict';
// ES-116 · Territorios por habilidad del catálogo (mapa de competencias). Aditiva: una columna opcional, sin tocar datos.
// Debe coincidir con el modelo SkillDefinition (db:drift lo comprueba). El down borra la columna: guarda común de ES-59.
const guardDown = require('../scripts/guard-down.cjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('SkillDefinitions');
    if (!columns.territories) await queryInterface.addColumn('SkillDefinitions', 'territories', { type: Sequelize.JSON, allowNull: true });
  },
  async down(queryInterface) {
    guardDown('20261029010000-es116-skill-territories');
    const columns = await queryInterface.describeTable('SkillDefinitions');
    if (columns.territories) await queryInterface.removeColumn('SkillDefinitions', 'territories');
  },
};
