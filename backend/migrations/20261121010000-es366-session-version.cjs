// ES-366 (QA-419-2) · Versión de sesión por persona. ADITIVA e idempotente: una columna NOT NULL con DEFAULT 0 (en Postgres ≥ 11 no reescribe la tabla; las filas existentes quedan en 0).
// Idéntica a lo que genera el modelo (INTEGER NOT NULL DEFAULT 0). Los tokens anteriores no llevan `sv` y siguen validándose por tiempo: ninguna sesión vigente se invalida.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface). El down (solo con permiso explícito, nunca en producción) quita la columna.
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.query('ALTER TABLE "AuthRevocations" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0');
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261121010000-es366-session-version');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query('ALTER TABLE "AuthRevocations" DROP COLUMN IF EXISTS "sessionVersion"');
}

module.exports = { up, down };
