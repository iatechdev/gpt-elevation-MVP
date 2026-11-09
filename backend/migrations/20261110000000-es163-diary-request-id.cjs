// ES-163 · Diario: guardar una entrada nueva es idempotente con `requestId` (el reintento tras un resultado incierto no duplica).
// ADITIVA e idempotente: una columna NULLABLE sin DEFAULT (no reescribe la tabla) y un índice único PARCIAL (UserId, requestId) donde requestId no es nulo,
// de modo que las filas existentes (sin requestId) no chocan. `requestId` es solo un identificador generado por el cliente: no contiene ni copia texto del diario.
// La tabla conserva su RLS (ES-117): esta migración no la toca. El down (solo con permiso explícito, nunca en producción) quita el índice y la columna.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const INDEX = 'diary_entries__user_request_id';

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('ALTER TABLE "DiaryEntries" ADD COLUMN IF NOT EXISTS "requestId" VARCHAR(64)', { transaction });
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "DiaryEntries" ("UserId", "requestId") WHERE "requestId" IS NOT NULL`, { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261110000000-es163-diary-request-id');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`);
  await sequelize.query('ALTER TABLE "DiaryEntries" DROP COLUMN IF EXISTS "requestId"');
}

module.exports = { up, down, INDEX };
