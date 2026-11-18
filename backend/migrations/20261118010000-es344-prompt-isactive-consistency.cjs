// ES-344 · Guías de la IA: limpia las filas inconsistentes que dejó la carrera aprobar+rechazar (status distinto de 'active' pero isActive=true).
// NO destructiva: no borra filas ni toca el texto ni el status; solo pone isActive=false donde la fila NO es la versión activa. Es idempotente.
// Una versión rechazada, archivada o pendiente nunca debe figurar como activa (getActivePrompt ya solo lee status='active').
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const WHERE = `"status" IS DISTINCT FROM 'active' AND "isActive" IS TRUE`;

// Solo lectura: ids y claves de las filas que la migración cambiaría (sin el texto de las guías).
async function findInconsistent(sequelize, options = {}) {
  return sequelize.query(`SELECT "id", "key", "version", "status" FROM "PromptVaults" WHERE ${WHERE} ORDER BY "id"`, { type: 'SELECT', ...options });
}

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  const [, result] = await sequelize.query(`UPDATE "PromptVaults" SET "isActive" = false WHERE ${WHERE}`);
  const changed = typeof result === 'number' ? result : (result && result.rowCount) || 0;
  if (changed) console.log(`ES-344: ${changed} fila(s) de PromptVaults con isActive=true sin ser la versión activa pasaron a isActive=false (no se borró nada).`);
  return changed;
}

async function down() {
  require('../scripts/guard-down.cjs')('20261118010000-es344-prompt-isactive-consistency');
}

module.exports = { up, down, findInconsistent };
