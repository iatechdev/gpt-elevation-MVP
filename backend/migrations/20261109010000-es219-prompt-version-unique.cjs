// ES-219 · Guías de la IA: una versión por (clave, versión) y una sola activa por clave (E181-1 / E191-3).
// ADITIVA: solo crea dos índices únicos. ANTES de crearlos busca duplicados existentes y, si los hay, NO borra ni cambia nada:
// lanza un error con el informe y se detiene (lo decide una persona). Idempotente: si los índices ya existen no hace nada.
// Contrato doble: la prueba la llama con up(sequelize); sequelize-cli (ES-59) con up(queryInterface).
//
//   prompt_vaults__key_version  UNIQUE ("key", "version")
//   prompt_vaults__key_active   UNIQUE ("key") WHERE "status" = 'active'
const INDEX_VERSION = 'prompt_vaults__key_version';
const INDEX_ACTIVE = 'prompt_vaults__key_active';

class DuplicatePromptVersionsError extends Error {
  constructor(report) {
    super(`ES-219: hay ${report.versions.length} (clave, versión) repetidas y ${report.active.length} claves con más de una versión activa en "PromptVaults". `
      + 'No se creó ningún índice y no se cambió nada. Revisa el informe (error.report) y decide qué filas conservar antes de repetir la migración.');
    this.name = 'DuplicatePromptVersionsError'; this.report = report;
  }
}

// Solo lectura: devuelve los duplicados sin tocarlos. Los ids permiten decidir qué fila conservar; no incluye el texto de las guías.
async function findDuplicates(sequelize, options = {}) {
  const versions = await sequelize.query(`SELECT "key", "version", count(*)::int AS "rows", array_agg("id" ORDER BY "id") AS "ids"
    FROM "PromptVaults" GROUP BY "key", "version" HAVING count(*) > 1 ORDER BY "key", "version"`, { type: 'SELECT', ...options });
  const active = await sequelize.query(`SELECT "key", count(*)::int AS "rows", array_agg("id" ORDER BY "id") AS "ids"
    FROM "PromptVaults" WHERE "status" = 'active' GROUP BY "key" HAVING count(*) > 1 ORDER BY "key"`, { type: 'SELECT', ...options });
  return { versions, active };
}

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  await sequelize.transaction(async (transaction) => {
    // Un bloqueo que impide escrituras concurrentes mientras se comprueba y se crea el índice (sin él, una fila nueva podría colarse en medio).
    await sequelize.query('LOCK TABLE "PromptVaults" IN SHARE ROW EXCLUSIVE MODE', { transaction });
    const report = await findDuplicates(sequelize, { transaction });
    if (report.versions.length || report.active.length) throw new DuplicatePromptVersionsError(report);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_VERSION}" ON "PromptVaults" ("key", "version")`, { transaction });
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_ACTIVE}" ON "PromptVaults" ("key") WHERE "status" = 'active'`, { transaction });
  });
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261109010000-es219-prompt-version-unique');
  const sequelize = queryInterface.sequelize || queryInterface;
  await sequelize.query(`DROP INDEX IF EXISTS "${INDEX_VERSION}"`);
  await sequelize.query(`DROP INDEX IF EXISTS "${INDEX_ACTIVE}"`);
}

module.exports = { up, down, findDuplicates, DuplicatePromptVersionsError, INDEX_VERSION, INDEX_ACTIVE };
