// ES-179 · Sala de sesión: UNA nota en vivo por sesión (antes cada autoguardado creaba una fila nueva con el texto completo).
// ADITIVA e idempotente: tres columnas NULLABLE sin DEFAULT (no reescriben la tabla) y un índice único PARCIAL (sessionId, therapistId) donde isLive = true.
// Las filas existentes (isLive NULL) NO se tocan ni se borran: quedan como historial. `requestId` es solo un identificador generado por el cliente; no copia texto.
// La tabla conserva su RLS (ES-117): esta migración no la toca. El down (solo con permiso explícito, nunca en producción) quita el índice y las columnas.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const INDEX = 'session_notes__live';

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('ALTER TABLE "SessionNotes" ADD COLUMN IF NOT EXISTS "isLive" BOOLEAN', { transaction });
    await sequelize.query('ALTER TABLE "SessionNotes" ADD COLUMN IF NOT EXISTS "version" INTEGER', { transaction });
    await sequelize.query('ALTER TABLE "SessionNotes" ADD COLUMN IF NOT EXISTS "requestId" VARCHAR(64)', { transaction });
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "SessionNotes" ("sessionId", "therapistId") WHERE "isLive" = true`, { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261111000000-es179-session-note-live');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`);
  await sequelize.query('ALTER TABLE "SessionNotes" DROP COLUMN IF EXISTS "requestId"');
  await sequelize.query('ALTER TABLE "SessionNotes" DROP COLUMN IF EXISTS "version"');
  await sequelize.query('ALTER TABLE "SessionNotes" DROP COLUMN IF EXISTS "isLive"');
}

module.exports = { up, down, INDEX };
