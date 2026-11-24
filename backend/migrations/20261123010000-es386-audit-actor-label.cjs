// ES-386 · Auditoría de administración: QUIÉN opera cuando la acción no la hace una cuenta de la aplicación (script de operador, ES-376). Columna `actorLabel` (identificador de operador
// no secreto y sin datos personales, ej. «ops-ana»). ADITIVA, NULL y idempotente: las filas existentes no cambian. Idéntica a lo que genera el modelo (VARCHAR(32) NULL).
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface). El down (solo con permiso explícito, nunca en producción) quita la columna.
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.query('ALTER TABLE "AdminAuditEntries" ADD COLUMN IF NOT EXISTS "actorLabel" VARCHAR(32)');
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261123010000-es386-audit-actor-label');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query('ALTER TABLE "AdminAuditEntries" DROP COLUMN IF EXISTS "actorLabel"');
}

module.exports = { up, down };
