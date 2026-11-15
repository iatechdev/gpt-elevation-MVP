// ES-306 seguimiento (E306-4) · Las bases que YA aplicaron la primera versión de 20261114010000 (cabeza 7b5395af) tienen el índice `users_email_lower_unique` sobre lower(email)
// SIN btrim; esa migración usa IF NOT EXISTS y no lo reemplaza. Esta lee la definición real del índice y lo deja como lower(btrim(email)):
//   - no existe → lo crea solo si no hay duplicados (igual que la migración original);
//   - existe con btrim → no hace nada;
//   - existe sin btrim → lo reemplaza SOLO si no hay duplicados por lower(btrim(email)); con duplicados lo deja como está y lo avisa (solo ids, nunca correos).
// ADITIVA e idempotente: solo cambia un ÍNDICE (en una transacción); no borra, no fusiona ni reescribe ninguna cuenta. Contrato doble: up(sequelize) en pruebas, up(queryInterface) con sequelize-cli (ES-59).
const { INDEX, duplicateGroups, createIndexIfClean } = require('./20261114010000-es306-email-lower-unique.cjs');

async function repairIndex(sequelize, log = console) {
  const [rows] = await sequelize.query(`SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'Users' AND indexname = '${INDEX}'`);
  if (!rows.length) return { action: 'created-or-skipped', ...(await createIndexIfClean(sequelize, log)) };
  if (/btrim/i.test(rows[0].indexdef)) return { action: 'already-correct' };
  return sequelize.transaction(async (transaction) => {
    const groups = await duplicateGroups(sequelize, transaction);
    if (groups.length) {
      log.warn(`ES-306: el índice ${INDEX} existente no recorta espacios (lower sin btrim) y hay ${groups.length} grupo(s) de cuentas duplicadas con espacios/mayúsculas; NO se reemplaza. ` +
        `Ids por grupo: ${groups.map((g) => `[${g.ids.join(',')}]`).join(' ')}. Resolverlos (fusión: decisión de Mauricio/Alejo) y volver a correr la migración.`);
      return { action: 'kept-old', groups };
    }
    await sequelize.query(`DROP INDEX "${INDEX}"`, { transaction });
    await sequelize.query(`CREATE UNIQUE INDEX "${INDEX}" ON "Users" (lower(btrim("email")))`, { transaction });
    return { action: 'replaced', groups: [] };
  });
}

async function up(arg) { await repairIndex(arg.sequelize || arg); }

// Nada que deshacer: el índice correcto (lower(btrim)) lo crea la migración 20261114010000 y su down; reponer el índice débil no tiene sentido.
async function down() {}

module.exports = { up, down, repairIndex };
