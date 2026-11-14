// ES-306 · Correo único sin importar mayúsculas: REPORTA las cuentas duplicadas por lower(email) y crea el índice único SOLO si no hay ninguna.
// ADITIVA e idempotente: no borra, no fusiona ni reescribe cuentas (fusionarlas es decisión de Mauricio/Alejo). Con duplicados NO crea el índice, lo avisa
// (solo ids y conteo: nunca imprime correos) y termina bien; al resolverlos, correr de nuevo esta migración. Informe de solo lectura en cualquier entorno: `npm run check:email-duplicates`.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
const INDEX = 'users_email_lower_unique';

// Grupos de cuentas con el mismo correo ignorando mayúsculas y espacios a los lados. Solo lee.
async function duplicateGroups(sequelize, transaction) {
  const [rows] = await sequelize.query(
    `SELECT count(*)::int AS "accounts", array_agg("id" ORDER BY "id") AS "ids"
       FROM "Users" GROUP BY lower(btrim("email")) HAVING count(*) > 1 ORDER BY min("id")`, { transaction });
  return rows.map((row) => ({ accounts: row.accounts, ids: row.ids }));
}

async function createIndexIfClean(sequelize, log = console) {
  const run = async (transaction) => {
    const groups = await duplicateGroups(sequelize, transaction);
    if (groups.length) {
      log.warn(`ES-306: hay ${groups.length} grupo(s) de cuentas con el mismo correo ignorando mayúsculas; NO se crea el índice único ${INDEX}. ` +
        `Ids por grupo: ${groups.map((g) => `[${g.ids.join(',')}]`).join(' ')}. Resolverlos (fusión: decisión de Mauricio/Alejo) y volver a correr la migración.`);
      return { created: false, groups };
    }
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "Users" (lower(btrim("email")))`, { transaction });
    return { created: true, groups: [] };
  };
  return sequelize.transaction(run);
}

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await createIndexIfClean(sequelize);
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261114010000-es306-email-lower-unique');
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "${INDEX}"`);
}

module.exports = { up, down, duplicateGroups, createIndexIfClean, INDEX };
