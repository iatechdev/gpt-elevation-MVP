// ES-182 (E45-1) · Manifiesto ético: versión en inglés. ADITIVA e idempotente: una columna NULLABLE sin DEFAULT (no reescribe la tabla, no toca ninguna fila).
// `content` sigue siendo la versión en español; `contentEn` (cifrada igual) es opcional. El down (solo con permiso explícito, nunca en producción) quita la columna.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.query('ALTER TABLE "EthicManifests" ADD COLUMN IF NOT EXISTS "contentEn" TEXT');
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261120010000-es182-manifest-content-en');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query('ALTER TABLE "EthicManifests" DROP COLUMN IF EXISTS "contentEn"');
}

module.exports = { up, down };
