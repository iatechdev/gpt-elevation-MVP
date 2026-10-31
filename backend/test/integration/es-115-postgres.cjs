// ES-115 (ES-59, fase 2) · Migrar al desplegar y adoptar el esquema de una base creada por sync(), contra PostgreSQL REAL.
// Reproduce staging: esquema de sync() + las dos migraciones de ES-85 ya aplicadas, con un dato de persona sintética.
// Comando explícito: solo una base de nombre aleatorio en un clúster desechable de loopback. Todo dato es sintético.
//   ES115_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres node --test test/integration/es-115-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const backend = path.resolve(__dirname, '..', '..');
const migrationFiles = fs.readdirSync(path.join(backend, 'migrations')).filter((f) => /^\d.*\.(js|cjs)$/.test(f)).sort();
const ES85 = ['20261028190000-es85-ai-jobs-skill-candidates.js', '20261028190100-es85-worker-role-functions.js'];

test('ES-115 PostgreSQL: diagnóstico sin cambios, bloqueo sin adoptar, adopción, migración y repetición', { timeout: 420000 }, async (t) => {
  assert.ok(process.env.ES115_TEST_DATABASE_URL, 'Se requiere ES115_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES115_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const suffix = crypto.randomBytes(6).toString('hex');
  const names = { staging: `es115_staging_${suffix}`, fresh: `es115_fresh_${suffix}` };
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const connect = async (url) => { const c = new Client({ connectionString: url, ssl: false }); c.on('error', () => {}); await c.connect(); return c; };
  const run = (script, args, dbName, extra = {}) => spawnSync(process.execPath, [path.join(backend, 'scripts', script), ...args], {
    cwd: backend, encoding: 'utf8', env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test', ...extra },
  });
  const cli = (args, dbName) => spawnSync('npx', ['--no-install', 'sequelize-cli', ...args], {
    cwd: backend, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' },
  });
  // Se ordena en JS: el orden de ORDER BY depende de la colación del clúster (en CI difiere de la local), y aquí importa el conjunto.
  const meta = async (db) => (await db.query('SELECT "name" FROM "SequelizeMeta"')).rows.map((r) => r.name).sort();

  const admin = await connect(target.toString());
  t.after(async () => {
    for (const n of Object.values(names)) await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`).catch(() => {});
    for (const role of ['elevation_worker', 'elevation_worker_owner']) {
      await admin.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN
        BEGIN EXECUTE 'DROP OWNED BY ${role}'; DROP ROLE ${role}; EXCEPTION WHEN others THEN NULL; END; END IF; END $$`).catch(() => {});
    }
    await admin.end().catch(() => {});
  });
  for (const n of Object.values(names)) await admin.query(`CREATE DATABASE "${n}"`);

  // ── Reproducir staging ────────────────────────────────────────────────────────
  const sync = run('schema-sync-once.cjs', [], names.staging);
  assert.equal(sync.status, 0, 'sync() crea el esquema: ' + (sync.stdout + sync.stderr).slice(-400));
  const db = await connect(urlFor(names.staging));
  t.after(() => db.end().catch(() => {}));
  await db.query('DROP TABLE "SkillCandidates"');
  await db.query('DROP TABLE "AiJobs"');
  for (const m of ES85) {
    const r = cli(['db:migrate', '--name', m], names.staging);
    assert.equal(r.status, 0, `migración ${m}: ` + (r.stdout + r.stderr).slice(-400));
  }
  // Persona sintética: se rellenan solo las columnas obligatorias sin valor por defecto.
  const required = (await db.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='Users' AND is_nullable='NO' AND column_default IS NULL`)).rows;
  const value = ({ column_name: c, data_type: d }) => (/timestamp/.test(d) ? 'now()' : /int|numeric/.test(d) ? '0' : d === 'boolean' ? 'false' : c === 'email' ? "'sintetico-115@example.invalid'" : "'x'");
  await db.query(`INSERT INTO "Users" (${required.map((c) => '"' + c.column_name + '"').join(',')}) VALUES (${required.map(value).join(',')})`);
  const usersBefore = (await db.query('SELECT count(*)::int n FROM "Users"')).rows[0].n;
  assert.deepEqual(await meta(db), [...ES85].sort(), 'estado de staging: solo las dos migraciones de ES-85 registradas');

  // ── 1. Diagnóstico: no escribe nada ───────────────────────────────────────────
  const dry = run('adopt-existing-schema.cjs', [], names.staging);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /adoptable\s+20261001000000-baseline\.js/);
  assert.match(dry.stdout, /adoptable\s+20261029000000-es95-professional-applications\.js/);
  assert.match(dry.stdout, /no se escribió nada/);
  assert.deepEqual(await meta(db), [...ES85].sort(), 'el diagnóstico no escribe');

  // ── 2. Sin adoptar, migrate-deploy se niega y no cambia nada ──────────────────
  const blocked = run('migrate-deploy.cjs', [], names.staging);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /sin adoptar/);
  assert.deepEqual(await meta(db), [...ES85].sort(), 'migrate-deploy bloqueado no escribe');

  // P2: ES-95 parcial no puede registrar siquiera la línea base.
  await db.query('DROP INDEX professional_applications_email_open_unique');
  const partial = run('adopt-existing-schema.cjs', ['--apply'], names.staging);
  assert.equal(partial.status, 1, partial.stdout + partial.stderr);
  assert.match(partial.stdout, /no_adoptable\s+20261029000000-es95-professional-applications\.js/);
  assert.match(partial.stdout, /professional_applications_email_open_unique/);
  assert.match(partial.stderr, /Adopción bloqueada.*No se registra nada/);
  assert.deepEqual(await meta(db), [...ES85].sort(), 'ES-95 parcial no registra baseline ni ninguna otra migración');
  assert.equal((await db.query('SELECT count(*)::int n FROM "Users"')).rows[0].n, usersBefore);
  await db.query(`CREATE UNIQUE INDEX professional_applications_email_open_unique ON "ProfessionalApplications" (email) WHERE status IN ('pending', 'approved')`);

  // ── 3. Adopción ───────────────────────────────────────────────────────────────
  const apply = run('adopt-existing-schema.cjs', ['--apply'], names.staging);
  assert.equal(apply.status, 0, apply.stderr);
  const afterAdopt = await meta(db);
  assert.ok(afterAdopt.includes('20261001000000-baseline.js') && afterAdopt.includes('20261029000000-es95-professional-applications.js'));
  assert.equal(afterAdopt.length, 4, 'las dos de ES-85 más baseline y ES-95');

  // ── 4. migrate-deploy aplica lo pendiente sin errores ─────────────────────────
  const deploy = run('migrate-deploy.cjs', [], names.staging);
  assert.equal(deploy.status, 0, 'migrate-deploy: ' + (deploy.stdout + deploy.stderr).slice(-600));
  assert.deepEqual(await meta(db), migrationFiles, 'todas las migraciones quedan registradas');
  assert.equal((await db.query('SELECT count(*)::int n FROM "Users"')).rows[0].n, usersBefore, 'los datos de las personas no cambian');

  // ── 5. Repetición: sin cambios ────────────────────────────────────────────────
  const again = run('migrate-deploy.cjs', [], names.staging);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.deepEqual(await meta(db), migrationFiles);

  // ── 6. Base nueva (producción empieza ya con migraciones) ────────────────────
  const fresh = run('migrate-deploy.cjs', [], names.fresh);
  assert.equal(fresh.status, 0, 'base nueva: ' + (fresh.stdout + fresh.stderr).slice(-600));
  const dbFresh = await connect(urlFor(names.fresh));
  t.after(() => dbFresh.end().catch(() => {}));
  assert.deepEqual(await meta(dbFresh), migrationFiles);

  // ── 7. Sin DATABASE_URL: error claro, sin tocar nada ──────────────────────────
  const noUrl = spawnSync(process.execPath, [path.join(backend, 'scripts', 'migrate-deploy.cjs')], {
    cwd: backend, encoding: 'utf8', env: { PATH: process.env.PATH },
  });
  assert.equal(noUrl.status, 2);
  assert.match(noUrl.stderr, /falta DATABASE_URL/);
});
