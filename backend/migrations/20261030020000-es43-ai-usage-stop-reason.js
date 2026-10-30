'use strict';
// ES-43 (ES43-QA-01) · Registro del motivo de cierre de cada llamada al proveedor de IA (stop_reason), para confirmar si el chat se corta por max_tokens.
// Aditiva: una columna opcional con un código corto del proveedor (end_turn, max_tokens...), nunca contenido. Debe coincidir con el modelo AiUsage (db:drift lo comprueba).
// El down borra la columna: guarda común de ES-59.
const guardDown = require('../scripts/guard-down.cjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('AiUsages');
    if (!columns.stopReason) await queryInterface.addColumn('AiUsages', 'stopReason', { type: Sequelize.STRING(24), allowNull: true });
  },
  async down(queryInterface) {
    guardDown('20261030020000-es43-ai-usage-stop-reason');
    const columns = await queryInterface.describeTable('AiUsages');
    if (columns.stopReason) await queryInterface.removeColumn('AiUsages', 'stopReason');
  },
};
