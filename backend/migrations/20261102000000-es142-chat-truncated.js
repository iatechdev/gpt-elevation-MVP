'use strict';
// ES-142 · Marca las respuestas del chat que el modelo dejó cortadas por el tope de salida (stop_reason = max_tokens), para avisar a la persona.
// Aditiva: dos columnas booleanas con valor por defecto (false); lo ya guardado queda como no cortado. Debe coincidir con los modelos Message y ChatTurn (db:drift lo comprueba).
// El down borra las columnas: guarda común de ES-59.
const guardDown = require('../scripts/guard-down.cjs');

const TABLES = ['Messages', 'ChatTurns'];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (!columns.truncated) await queryInterface.addColumn(table, 'truncated', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    }
  },
  async down(queryInterface) {
    guardDown('20261102000000-es142-chat-truncated');
    for (const table of TABLES) {
      const columns = await queryInterface.describeTable(table);
      if (columns.truncated) await queryInterface.removeColumn(table, 'truncated');
    }
  },
};
