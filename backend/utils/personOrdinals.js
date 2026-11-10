// ES-177 · «Persona n»: ordinal estable por profesional. Devuelve Map(personId → n). Las personas nuevas reciben el siguiente número libre del profesional
// (nunca se reutiliza el de quien salió); la asignación va dentro de un bloqueo por profesional para que dos lecturas simultáneas no repitan números.
const { sequelize } = require('../database');
const Ordinal = require('../TherapistPersonOrdinal');
require('../TherapistOrdinalCounter'); // carga estática: sync() y la comprobación de deriva (ES-59) conocen también el contador // carga estática: así sync() y la comprobación de deriva (ES-59) conocen la tabla

async function ordinalsFor(therapistId, personIds) {
  const ids = [...new Set((personIds ?? []).map(Number).filter(Number.isSafeInteger))].sort((a, b) => a - b);
  if (!ids.length) return new Map();
  const read = async (transaction) => new Map((await Ordinal.findAll({ where: { therapistId, personId: ids }, attributes: ['personId', 'ordinal'], transaction }) ?? []).map((r) => [Number(r.personId), Number(r.ordinal)]));
  let have = await read();
  if (ids.every((id) => have.has(id))) return have;
  const transaction = await sequelize.transaction();
  try {
    if (sequelize.getDialect() === 'postgres') await sequelize.query("SELECT pg_advisory_xact_lock(hashtext('ordinal:' || :id))", { replacements: { id: String(therapistId) }, transaction });
    have = await read(transaction);
    const missing = ids.filter((id) => !have.has(id));
    const existingMax = Number(await Ordinal.max('ordinal', { where: { therapistId }, transaction })) || 0;
    let next;
    if (sequelize.getDialect() === 'postgres') {
      // Contador MONÓTONO: solo sube (GREATEST con el máximo existente cubre filas anteriores al contador). Nunca max()+1: si se elimina a la persona con la n más
      // alta, su número no se reutiliza y el profesional no confunde a dos personas distintas.
      const [row] = await sequelize.query(`INSERT INTO "TherapistOrdinalCounters" ("therapistId", "lastOrdinal", "createdAt", "updatedAt") VALUES (:t, :max + :n, now(), now())
        ON CONFLICT ("therapistId") DO UPDATE SET "lastOrdinal" = GREATEST("TherapistOrdinalCounters"."lastOrdinal", :max) + :n, "updatedAt" = now() RETURNING "lastOrdinal"`,
        { replacements: { t: therapistId, max: existingMax, n: missing.length }, transaction, type: 'SELECT' });
      next = Number(row.lastOrdinal) - missing.length;
    } else next = existingMax; // sin Postgres (dobles de prueba en memoria)
    for (const id of missing) { next += 1; await Ordinal.create({ therapistId, personId: id, ordinal: next }, { transaction }); have.set(id, next); }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
  return have;
}

module.exports = { ordinalsFor };
