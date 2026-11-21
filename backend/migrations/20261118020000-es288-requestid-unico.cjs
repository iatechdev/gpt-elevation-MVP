// ES-288 · Idempotencia en defensa de profundidad: índices únicos PARCIALES con requestId en AiUsages y SessionNotes (la corrección ya no depende solo del código).
//   ai_usages__request_done      UNIQUE ("UserId", "kind", "requestId") WHERE "requestId" IS NOT NULL AND "status" = 'completed'
//   session_notes__request       UNIQUE ("sessionId", "therapistId", "requestId") WHERE "requestId" IS NOT NULL
// En AiUsages el índice es solo sobre consumos COMPLETADOS: un turno fallido se reintenta con el mismo requestId y deja varias filas legítimas (failed + la nueva).
//
// Railway aplica las migraciones en CADA arranque: si ya hubiera duplicados, un índice único fallaría y el servicio no arrancaría. Por eso ANTES de crear cada índice se
// resuelven los duplicados de forma NO DESTRUCTIVA: se conserva la fila más antigua (menor id) tal cual y a las demás se les marca el requestId con el sufijo «~dup<id>»
// (se recorta el original a 50 caracteres: la fila, su consumo y su contenido NO se tocan ni se borran; el requestId original sigue legible en el prefijo). Sin duplicados no cambia nada.
// Todo ocurre en una transacción con la tabla bloqueada (nadie cuela una fila entre la comprobación y el índice). Idempotente. Contrato doble: up(sequelize) o up(queryInterface).
const INDEX_USAGE = 'ai_usages__request_done';
const INDEX_NOTES = 'session_notes__request';
const TARGETS = [
  { table: 'AiUsages', index: INDEX_USAGE, columns: ['UserId', 'kind', 'requestId'], where: `"requestId" IS NOT NULL AND "status" = 'completed'` },
  { table: 'SessionNotes', index: INDEX_NOTES, columns: ['sessionId', 'therapistId', 'requestId'], where: `"requestId" IS NOT NULL` },
];
const quoted = (columns) => columns.map((c) => `"${c}"`).join(', ');

// Solo lectura: filas que NO serían la primera de su grupo (las que habría que marcar). No incluye contenido.
async function findDuplicates(sequelize, target, options = {}) {
  return sequelize.query(
    `SELECT "id", "requestId" FROM (
       SELECT "id", "requestId", row_number() OVER (PARTITION BY ${quoted(target.columns)} ORDER BY "id") AS "n" FROM "${target.table}" WHERE ${target.where}
     ) ranked WHERE "n" > 1 ORDER BY "id"`, { type: 'SELECT', ...options });
}

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  const resolved = {};
  await sequelize.transaction(async (transaction) => {
    for (const target of TARGETS) {
      await sequelize.query(`LOCK TABLE "${target.table}" IN SHARE ROW EXCLUSIVE MODE`, { transaction });
      const duplicates = await findDuplicates(sequelize, target, { transaction });
      if (duplicates.length) {
        // El sufijo incluye el id de la fila: único por construcción. Se recorta el original para caber en VARCHAR(64).
        await sequelize.query(
          `UPDATE "${target.table}" SET "requestId" = left("requestId", 50) || '~dup' || "id" WHERE "id" IN (:ids)`,
          { replacements: { ids: duplicates.map((row) => row.id) }, transaction });
      }
      resolved[target.table] = duplicates.length;
      await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${target.index}" ON "${target.table}" (${quoted(target.columns)}) WHERE ${target.where}`, { transaction });
    }
  });
  const total = Object.values(resolved).reduce((a, b) => a + b, 0);
  if (total) console.log(`ES-288: ${total} fila(s) con requestId repetido conservadas y marcadas con «~dup<id>» (AiUsages ${resolved.AiUsages}, SessionNotes ${resolved.SessionNotes}); no se borró nada.`);
  return resolved;
}

async function down(queryInterface) {
  require('../scripts/guard-down.cjs')('20261118020000-es288-requestid-unico');
  const sequelize = queryInterface.sequelize || queryInterface;
  for (const target of TARGETS) await sequelize.query(`DROP INDEX IF EXISTS "${target.index}"`); // los requestId marcados con «~dup» se conservan (no hay copia aparte que restaurar)
}

module.exports = { up, down, findDuplicates, TARGETS, INDEX_USAGE, INDEX_NOTES };
