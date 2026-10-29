// ES-95 — Retención: elimina las solicitudes de profesionales RECHAZADAS con más de REJECTED_RETENTION_DAYS desde su revisión
// (la hoja de vida se borra en cascada). Comando de operador: nunca carga .env solo ni imprime datos personales.
// Uso: DATABASE_URL=... node scripts/purgeProfessionalApplications.js [--dry-run]
const { Op } = require('sequelize');
const { REJECTED_RETENTION_DAYS } = require('../utils/professionalApplication');

const cutoffFor = (now, days = REJECTED_RETENTION_DAYS) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

async function purgeExpired({ now = new Date(), dryRun = false, model = require('../ProfessionalApplication') } = {}) {
  const where = { status: 'rejected', reviewedAt: { [Op.lt]: cutoffFor(now) } };
  const count = dryRun ? await model.count({ where }) : await model.destroy({ where });
  return { count, dryRun };
}

async function main() {
  const { sequelize } = require('../database');
  try {
    await sequelize.authenticate();
    const result = await purgeExpired({ dryRun: process.argv.includes('--dry-run') });
    console.log(JSON.stringify(result)); // solo la cifra, nunca identificadores ni contenido
  } catch {
    console.error('Purga no completada.'); process.exitCode = 1;
  } finally { await sequelize.close(); }
}
if (require.main === module) main();

module.exports = { purgeExpired, cutoffFor };
