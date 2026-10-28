// Comprobación de deriva (ES-59): compara el esquema que crea `sequelize.sync()` con el que crean las
// migraciones, ambos sobre bases nuevas. Si difieren, falta una migración (o sobra una).
// Uso: DATABASE_URL=... DB_SSL=false npm run db:drift   (solo en un Postgres desechable: crea y borra
// las bases es59_drift_sync y es59_drift_migrate en ese servidor).
const { spawnSync } = require('child_process');
const path = require('path');
const { Client } = require('pg');

const base = process.env.DATABASE_URL;
if (!base) { console.error('Falta DATABASE_URL.'); process.exit(2); }
const hostDe = (u) => new URL(u).hostname;
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost', '::1'].includes(hostDe(base)) && process.env.ALLOW_REMOTE_DRIFT !== 'true') {
  console.error('db:drift crea y borra bases: solo en un servidor local o desechable (ALLOW_REMOTE_DRIFT=true en CI con servicio efímero).');
  process.exit(2);
}

const conUrl = (nombre) => { const u = new URL(base); u.pathname = `/${nombre}`; return u.toString(); };
const ssl = process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false };
const DB_SYNC = 'es59_drift_sync';
const DB_MIG = 'es59_drift_migrate';
const backend = path.resolve(__dirname, '..');

const correr = (cmd, args, url, extra = {}) => spawnSync(cmd, args, {
  cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url, ...extra },
});

async function esquema(nombre) {
  const c = new Client({ connectionString: conUrl(nombre), ssl });
  await c.connect();
  const q = async (sql) => (await c.query(sql)).rows.map((r) => JSON.stringify(r));
  const out = {
    columnas: await q(`select table_name, column_name, data_type, udt_name, is_nullable, column_default,
      character_maximum_length, numeric_precision, numeric_scale from information_schema.columns
      where table_schema='public' and table_name <> 'SequelizeMeta' order by 1,2`),
    indices: await q(`select tablename, indexname, indexdef from pg_indexes
      where schemaname='public' and tablename <> 'SequelizeMeta' order by 1,2`),
    restricciones: await q(`select conrelid::regclass::text as tabla, conname, pg_get_constraintdef(oid) as def
      from pg_constraint where connamespace='public'::regnamespace and conrelid::regclass::text <> '"SequelizeMeta"' order by 1,2`),
  };
  await c.end();
  return out;
}

(async () => {
  const admin = new Client({ connectionString: conUrl('postgres'), ssl });
  await admin.connect();
  for (const n of [DB_SYNC, DB_MIG]) {
    await admin.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${n}`);
  }
  let codigo = 0;
  try {
    const a = correr('node', ['scripts/schema-sync-once.cjs'], conUrl(DB_SYNC));
    if (a.status !== 0) { console.error('Falló sync:', (a.stdout + a.stderr).slice(-400)); codigo = 1; }
    const b = correr('npx', ['sequelize-cli', 'db:migrate'], conUrl(DB_MIG));
    if (b.status !== 0) { console.error('Fallaron las migraciones:', (b.stdout + b.stderr).slice(-600)); codigo = 1; }
    const comparar = async (etapa) => {
      const [s, m] = [await esquema(DB_SYNC), await esquema(DB_MIG)];
      let hay = false;
      for (const clave of Object.keys(s)) {
        const soloSync = s[clave].filter((x) => !m[clave].includes(x));
        const soloMig = m[clave].filter((x) => !s[clave].includes(x));
        console.log(`[${etapa}] ${clave}: sync=${s[clave].length} migraciones=${m[clave].length}`);
        if (soloSync.length || soloMig.length) {
          hay = true;
          soloSync.slice(0, 8).forEach((x) => console.error('  solo en sync:', x));
          soloMig.slice(0, 8).forEach((x) => console.error('  solo en migraciones:', x));
        }
      }
      return hay;
    };
    if (codigo === 0 && await comparar('aplicar')) codigo = 1;
    if (codigo === 0) {
      // Ciclo: deshacer todo (solo en esta base desechable) y reaplicar; el esquema debe volver a ser idéntico.
      const d = correr('npx', ['sequelize-cli', 'db:migrate:undo:all'], conUrl(DB_MIG), { ALLOW_DESTRUCTIVE_MIGRATION: 'true' });
      const r = d.status === 0 ? correr('npx', ['sequelize-cli', 'db:migrate'], conUrl(DB_MIG)) : d;
      if (d.status !== 0 || r.status !== 0) { console.error('Falló el ciclo down/up:', (d.stdout + d.stderr + r.stdout + r.stderr).slice(-600)); codigo = 1; }
      else if (await comparar('down y reaplicar')) codigo = 1;
    }
    console.log(codigo === 0
      ? 'SIN DERIVA: las migraciones coinciden con sync, también tras deshacer y reaplicar.'
      : 'HAY DERIVA o fallo entre sync y las migraciones.');
  } finally {
    for (const n of [DB_SYNC, DB_MIG]) await admin.query(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`).catch(() => {});
    await admin.end();
  }
  process.exit(codigo);
})().catch((e) => { console.error('Error:', e.message); process.exit(1); });
