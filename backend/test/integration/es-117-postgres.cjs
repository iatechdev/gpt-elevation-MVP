// ES-117 · RLS y privilegios de la API pública de Supabase contra PostgreSQL REAL (clúster desechable en loopback).
// Simula los privilegios por defecto de Supabase (anon/authenticated/service_role con todo) ANTES de migrar y comprueba después:
// todas las tablas con RLS, anon/authenticated sin privilegios, service_role intacto, el worker operativo con RLS y el down reversible.
//   ES117_TEST_DATABASE_URL=postgres://usuario:clave@127.0.0.1:PUERTO/postgres node --test test/integration/es-117-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { findExposure } = require('../../scripts/check-rls.cjs');

const backend = path.resolve(__dirname, '..', '..');
const PREVIOUS = '20261030020000-es43-ai-usage-stop-reason.js';

test('ES-117 PostgreSQL: RLS en todas las tablas, API pública sin privilegios y worker operativo', { timeout: 300000 }, async (t) => {
  assert.ok(process.env.ES117_TEST_DATABASE_URL, 'Se requiere ES117_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES117_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es117_test_${crypto.randomBytes(8).toString('hex')}`;
  const workerPassword = crypto.randomBytes(16).toString('hex');
  const urlFor = (name, user, password) => {
    const u = new URL(target.toString()); u.pathname = `/${name}`;
    if (user) { u.username = user; u.password = password; }
    return u.toString();
  };
  const connect = async (url) => { const c = new Client({ connectionString: url, ssl: false }); await c.connect(); return c; };
  const admin = await connect(target.toString());
  const createdRoles = [];
  let db; let created = false; const extra = [];
  t.after(async () => {
    for (const c of extra) await c.end().catch(() => {});
    if (db) await db.end().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.query('ALTER ROLE elevation_worker PASSWORD NULL').catch(() => {});
    for (const role of createdRoles) await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => {});
    await admin.end().catch(() => {});
  });

  for (const role of ['anon', 'authenticated', 'service_role']) {
    if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rowCount) { await admin.query(`CREATE ROLE ${role} NOLOGIN`); createdRoles.push(role); }
  }
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  db = await connect(urlFor(dbName));
  // Privilegios por defecto de Supabase: todo para los tres roles sobre lo que cree quien migra.
  for (const kind of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) await db.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ${kind} TO anon, authenticated, service_role`);
  const migrate = (...args) => spawnSync('npx', ['sequelize-cli', ...args], {
    cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test', ...(args[0] === 'db:migrate:undo' ? { ALLOW_DESTRUCTIVE_MIGRATION: 'true' } : {}) },
  });
  const before = migrate('db:migrate', '--to', PREVIOUS);
  assert.equal(before.status, 0, `Fallaron las migraciones previas: ${(before.stdout + before.stderr).slice(-800)}`);
  const exposed = await findExposure(db);
  assert.ok(exposed.withoutRls.length > 10 && exposed.granted.length > 10, 'el escenario previo debe reproducir la exposición de Supabase');
  const tablesBefore = (await db.query(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')`)).rows[0].n;

  const applied = migrate('db:migrate');
  assert.equal(applied.status, 0, `Falló la migración ES-117: ${(applied.stdout + applied.stderr).slice(-800)}`);
  await admin.query(`ALTER ROLE elevation_worker PASSWORD '${workerPassword}'`);

  await t.test('todas las tablas con RLS y ningún privilegio para anon/authenticated', async () => {
    assert.deepEqual(await findExposure(db), { withoutRls: [], granted: [] });
    const tables = (await db.query(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND relrowsecurity`)).rows[0].n;
    assert.equal(tables, tablesBefore);
    assert.ok(tables >= 40);
  });

  await t.test('anon y authenticated no leen, no escriben y no ejecutan', async () => {
    for (const role of ['anon', 'authenticated']) {
      const c = await connect(urlFor(dbName)); extra.push(c);
      await c.query(`SET ROLE ${role}`);
      for (const sql of ['SELECT * FROM "Users" LIMIT 1', 'SELECT * FROM "AiJobs" LIMIT 1', 'DELETE FROM "Consents"', 'SELECT ai_jobs_guard()', "SELECT worker_claim('x', 60, 3)"]) {
        await assert.rejects(c.query(sql), (e) => e.code === '42501', `${role} debía recibir permission denied: ${sql}`);
      }
    }
  });

  await t.test('service_role conserva sus privilegios (decisión del equipo)', async () => {
    assert.equal((await db.query(`SELECT has_table_privilege('service_role', '"Users"', 'SELECT') AS ok`)).rows[0].ok, true);
  });

  await t.test('las políticas existen solo para los roles del worker', async () => {
    const policies = (await db.query(`SELECT tablename, policyname, roles::text AS roles FROM pg_policies WHERE schemaname='public' ORDER BY 1,2`)).rows;
    assert.ok(policies.length >= 12);
    for (const p of policies) {
      assert.match(p.policyname, /^es117_/);
      assert.match(p.roles, /^\{elevation_worker(_owner)?\}$/);
    }
    assert.deepEqual([...new Set(policies.filter((p) => p.roles === '{elevation_worker}').map((p) => p.tablename))].sort(), ['AiBudgetCounters', 'AiUsages']);
  });

  await t.test('el worker sigue operando con RLS: funciones worker_* y cifras de presupuesto; el resto sigue denegado', async () => {
    const w = await connect(urlFor(dbName, 'elevation_worker', workerPassword)); extra.push(w);
    assert.equal((await w.query("SELECT worker_claim('worker-117', 120, 3) AS r")).rows[0].r, null); // sin catálogo vigente: la función corre entera bajo RLS
    await db.query(`INSERT INTO "SkillCatalogs" ("version","status","publishedAt","createdAt","updatedAt") VALUES (1,'published',now(),now(),now())`);
    assert.equal((await w.query("SELECT worker_claim('worker-117', 120, 3) AS r")).rows[0].r, null); // ahora lee SkillCatalogs, Consents y AiJobs como dueño de la función
    await w.query(`INSERT INTO "AiBudgetCounters" ("UserId","periodKey","used","createdAt","updatedAt") VALUES (0,'2026-11',1,now(),now())`);
    await w.query(`UPDATE "AiBudgetCounters" SET "used" = 2 WHERE "UserId" = 0 AND "periodKey" = '2026-11'`);
    assert.equal((await w.query('SELECT used FROM "AiBudgetCounters" WHERE "UserId" = 0')).rows[0].used, 2);
    await assert.rejects(w.query('SELECT * FROM "Users" LIMIT 1'), (e) => e.code === '42501');
  });

  await t.test('el down devuelve el estado previo y la migración se puede reaplicar (ensayo)', async () => {
    const undone = migrate('db:migrate:undo');
    assert.equal(undone.status, 0, `Falló el down: ${(undone.stdout + undone.stderr).slice(-800)}`);
    const reverted = await findExposure(db);
    assert.ok(reverted.withoutRls.length > 10 && reverted.granted.length > 10);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'es117\\_%'")).rows[0].n, 0);
    const again = migrate('db:migrate');
    assert.equal(again.status, 0, `Falló reaplicar: ${(again.stdout + again.stderr).slice(-800)}`);
    assert.deepEqual(await findExposure(db), { withoutRls: [], granted: [] });
  });
});
