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

// E385-1 (QA): la marca «<original recortado>~dup<id>» ya podría existir en otra fila del mismo grupo (p. ej. un requestId que la persona o el cliente puso exactamente así): el índice único fallaría y el arranque se detendría.
// Se comprueba por fila y, si choca, se añade «_<n>» (y se recorta más el original para seguir cabiendo en VARCHAR(64)) hasta encontrar una libre. Sin choques el resultado es el mismo de siempre.
async function markDuplicate(sequelize, target, row, transaction) {
  const join = target.columns.filter((c) => c !== 'requestId').map((c) => `a."${c}" = b."${c}"`).join(' AND ');
  for (let n = 0; n < 1000; n += 1) {
    const base = String(row.requestId).slice(0, n === 0 ? 50 : 40);
    const candidate = n === 0 ? `${base}~dup${row.id}` : `${base}~dup${row.id}_${n}`;
    const taken = await sequelize.query(
      `SELECT 1 FROM "${target.table}" a JOIN "${target.table}" b ON ${join} WHERE a."id" = :id AND b."id" <> :id AND b."requestId" = :candidate LIMIT 1`,
      { type: 'SELECT', replacements: { id: row.id, candidate }, transaction });
    if (!taken.length) {
      await sequelize.query(`UPDATE "${target.table}" SET "requestId" = :candidate WHERE "id" = :id`, { replacements: { id: row.id, candidate }, transaction });
      return candidate;
    }
  }
  throw new Error(`ES-288: no se encontró una marca libre para ${target.table}.${row.id}`);
}

async function up(arg) {
  const sequelize = arg.sequelize || arg;
  const resolved = {};
  await sequelize.transaction(async (transaction) => {
    for (const target of TARGETS) {
      await sequelize.query(`LOCK TABLE "${target.table}" IN SHARE ROW EXCLUSIVE MODE`, { transaction });
      const duplicates = await findDuplicates(sequelize, target, { transaction });
      for (const row of duplicates) await markDuplicate(sequelize, target, row, transaction);
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
