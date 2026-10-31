// ES-115 (ES-59, fase 2) · Adopta el esquema que ya existe en una base creada por `sequelize.sync()` (staging):
// registra en `SequelizeMeta` las migraciones cuyo resultado YA está en la base, comprobándolo por objetos
// (tablas e índices), no por suposición. No crea ni borra tablas de la aplicación.
//   node scripts/adopt-existing-schema.cjs           -> solo diagnostica (no escribe nada)
//   node scripts/adopt-existing-schema.cjs --apply   -> registra las que se pueden adoptar
// Las demás migraciones pendientes son idempotentes (CREATE ... IF NOT EXISTS) y las aplica `npm run db:migrate`.
// Nunca imprime la URL de conexión ni credenciales.
const { Client } = require('pg');

const BASELINE = '20261001000000-baseline.js';
const ES95 = '20261029000000-es95-professional-applications.js';
const baselineTables = require('../migrations/baseline-20261028.json')
  .map((sql) => (sql.match(/^CREATE TABLE IF NOT EXISTS "(\w+)"/) || [])[1])
  .filter(Boolean);

// Objetos que cada migración adoptable deja en la base. Si falta alguno, NO se adopta (se aplicará o se investiga).
const ADOPTABLE = [
  { name: BASELINE, tables: baselineTables, indexes: [] },
  {
    name: ES95,
    tables: ['ProfessionalApplications', 'ProfessionalApplicationFiles'],
    indexes: ['professional_applications_email_open_unique'],
  },
];

async function ensureMeta(client) {
  await client.query('CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)');
}

async function registered(client) {
  const r = await client.query(`SELECT to_regclass('"SequelizeMeta"') AS t`);
  if (!r.rows[0].t) return new Set();
  return new Set((await client.query('SELECT "name" FROM "SequelizeMeta"')).rows.map((x) => x.name));
}

async function diagnose(client) {
  const done = await registered(client);
  const existing = new Set((await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'`)).rows.map((r) => r.tablename));
  const indexes = new Set((await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname='public'`)).rows.map((r) => r.indexname));
  return ADOPTABLE.map((m) => {
    if (done.has(m.name)) return { name: m.name, state: 'registrada' };
    const missing = [...m.tables.filter((t) => !existing.has(t)).map((t) => `tabla ${t}`), ...m.indexes.filter((i) => !indexes.has(i)).map((i) => `índice ${i}`)];
    return missing.length ? { name: m.name, state: 'no_adoptable', missing } : { name: m.name, state: 'adoptable' };
  });
}

// Base con esquema de la aplicación pero sin la línea base registrada = creada por sync() y sin adoptar.
async function needsAdoption(client) {
  const hasUsers = (await client.query(`SELECT to_regclass('"Users"') AS t`)).rows[0].t;
  if (!hasUsers) return false;
  return !(await registered(client)).has(BASELINE);
}

async function main() {
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL.'); process.exit(2); }
  const apply = process.argv.includes('--apply');
  const ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  await client.connect();
  try {
    const plan = await diagnose(client);
    for (const p of plan) console.log(`${p.state.padEnd(13)} ${p.name}${p.missing ? '  (falta: ' + p.missing.join(', ') + ')' : ''}`);
    const toAdopt = plan.filter((p) => p.state === 'adoptable');
    if (!apply) { console.log(`Diagnóstico solamente (no se escribió nada). Adoptables: ${toAdopt.length}. Use --apply para registrarlas.`); return; }
    if (plan.some((p) => p.state === 'no_adoptable')) {
      console.error('Adopción bloqueada: hay migraciones no_adoptable. Repare los objetos faltantes indicados y repita el diagnóstico antes de usar --apply. No se registra nada.'); process.exitCode = 1; return;
    }
    await client.query('BEGIN');
    await ensureMeta(client);
    for (const p of toAdopt) await client.query('INSERT INTO "SequelizeMeta" ("name") VALUES ($1) ON CONFLICT DO NOTHING', [p.name]);
    await client.query('COMMIT');
    console.log(`Registradas: ${toAdopt.length}.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', e.message); process.exitCode = 1;
  } finally { await client.end(); }
}

module.exports = { diagnose, needsAdoption, ADOPTABLE, BASELINE };
if (require.main === module) main();
