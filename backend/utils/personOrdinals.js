// ES-177 · «Persona n»: ordinal estable por profesional. Devuelve Map(personId → n). Las personas nuevas reciben el siguiente número libre del profesional
// (nunca se reutiliza el de quien salió); la asignación va dentro de un bloqueo por profesional para que dos lecturas simultáneas no repitan números.
const { sequelize } = require('../database');
const Ordinal = require('../TherapistPersonOrdinal'); // carga estática: así sync() y la comprobación de deriva (ES-59) conocen la tabla

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
    let next = Number(await Ordinal.max('ordinal', { where: { therapistId }, transaction })) || 0;
    for (const id of ids) if (!have.has(id)) { next += 1; await Ordinal.create({ therapistId, personId: id, ordinal: next }, { transaction }); have.set(id, next); }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
  return have;
}

module.exports = { ordinalsFor };
