// ES-310 (PR 5) · Lo que /admin/users oculta a una cuenta `admin` (no superadmin) TAMBIÉN lo rechaza el servidor. HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales).
// Cubre las acciones que la interfaz no pinta para admin: enviar enlace de restablecimiento, solicitar eliminación y asignar/invitar roles fuera de assignableRoles/invitableRoles.
// La lista esperada sale de frontend/test/fixtures/es-310-admin-permisos.json, la MISMA que exige la prueba del frontend a los ayudantes de la interfaz (una sola fuente).
//   ES310_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-310-admin-403-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const permisos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'frontend', 'test', 'fixtures', 'es-310-admin-permisos.json'), 'utf8'));

test('ES-310 PostgreSQL + HTTP: una cuenta admin recibe 403 en lo que la interfaz le oculta y no cambia nada en la base', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES310_TEST_DATABASE_URL, 'Se requiere ES310_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES310_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es310_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  const realFetch = global.fetch;
  t.after(async () => {
    global.fetch = realFetch;
    if (server) await new Promise((r) => { server.close(r); server.closeAllConnections?.(); });
    if (db) await db.end().catch(() => {});
    if (app) await app.close().catch(() => {});
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
    await admin.end().catch(() => {});
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  const migrated = spawnSync('npx', ['sequelize-cli', 'db:migrate'], { cwd: backend, encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: urlFor(dbName), DB_SSL: 'false', NODE_ENV: 'test' } });
  assert.equal(migrated.status, 0, `Fallaron las migraciones: ${(migrated.stdout + migrated.stderr).slice(-600)}`);

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const mailerModule = require.resolve('../../utils/mailer'); const realMailer = require('../../utils/mailer');
  require.cache[mailerModule] = { id: mailerModule, filename: mailerModule, loaded: true, exports: { ...realMailer, sendInvitation: async () => ({ sent: true }) } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }) },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/invitations', verificarAdmin, require('../../routes/invitations').adminRouter);
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-correo-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed };
  };
  const count = async (table) => (await q(`SELECT count(*)::int AS n FROM "${table}"`))[0].n;
  const roleOf = async (id) => (await q('SELECT role FROM "Users" WHERE id=$1', [id]))[0]?.role;

  const sup = await mkUser('superadmin'); const adm = await mkUser('admin');
  const mine = permisos.admin;

  await t.test('la lista del contrato es coherente: lo que se puede asignar más lo que se rechaza son los cinco roles, sin repetir', () => {
    const all = [...mine.rolesQueSePuedenAsignar, ...mine.rolesQueElServidorRechaza].sort();
    assert.deepEqual(all, ['admin', 'board', 'superadmin', 'therapist', 'user']);
    assert.deepEqual(permisos.superadmin.rolesQueSePuedenAsignar.slice().sort(), all);
  });

  await t.test('enlace de restablecimiento: admin = 403 superadmin_only y no se crea ningún enlace', async () => {
    const victim = await mkUser('user'); const before = await count('PasswordResets');
    const out = await http(adm, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, { locale: 'es' });
    assert.deepEqual([out.status, out.body.code], [403, 'superadmin_only']);
    assert.equal(await count('PasswordResets'), before, 'sin enlace emitido');
  });

  await t.test('solicitar eliminación (persona) y eliminar (profesional): admin = 403, la cuenta sigue activa y no hay solicitud de eliminación', async () => {
    const person = await mkUser('user'); const therapist = await mkUser('therapist'); const before = await count('DeletionRequests');
    for (const who of [person, therapist]) {
      const out = await http(adm, 'DELETE', `/api/admin/usuarios/${who.id}`);
      assert.equal(out.status, 403, `${who.role}: ${out.status}`);
      const row = (await q('SELECT active FROM "Users" WHERE id=$1', [who.id]))[0];
      assert.ok(row && row.active === true, `${who.role}: la cuenta sigue ahí y activa`);
    }
    assert.equal(await count('DeletionRequests'), before, 'sin solicitud de eliminación');
  });

  await t.test('asignar rol: los roles fuera de assignableRoles dan 403 y el rol NO cambia; los de assignableRoles se aplican; la superadministración puede los cinco', async () => {
    for (const role of mine.rolesQueElServidorRechaza) {
      const victim = await mkUser('user');
      const out = await http(adm, 'PUT', `/api/admin/usuarios/${victim.id}`, { role });
      assert.equal(out.status, 403, `${role}: ${out.status}`);
      assert.equal(await roleOf(victim.id), 'user', `${role}: el rol no cambió`);
    }
    for (const role of mine.rolesQueSePuedenAsignar) {
      const victim = await mkUser('user');
      const out = await http(adm, 'PUT', `/api/admin/usuarios/${victim.id}`, { role });
      assert.equal(out.status, 200, `${role}: ${out.status}`);
      assert.equal(await roleOf(victim.id), role);
    }
    for (const role of permisos.superadmin.rolesQueSePuedenAsignar) {
      const victim = await mkUser('user');
      assert.equal((await http(sup, 'PUT', `/api/admin/usuarios/${victim.id}`, { role })).status, 200, `superadmin → ${role}`);
      assert.equal(await roleOf(victim.id), role);
    }
  });

  await t.test('invitar: los roles fuera de invitableRoles dan 403 role_not_allowed y no se crea invitación; los de invitableRoles se registran', async () => {
    for (const role of mine.rolesQueElServidorRechaza) {
      const before = await count('Invitations');
      const out = await http(adm, 'POST', '/api/admin/invitations', { email: `rechazada.${role}@example.test`, role, locale: 'es' });
      assert.deepEqual([out.status, out.body.code], [403, 'role_not_allowed'], role);
      assert.equal(await count('Invitations'), before, `${role}: sin invitación`);
    }
    for (const role of mine.rolesQueSePuedenInvitar) {
      const before = await count('Invitations');
      const out = await http(adm, 'POST', '/api/admin/invitations', { email: `aceptada.${role}@example.test`, role, locale: 'es' });
      assert.equal(out.status, 201, `${role}: ${out.status}`);
      assert.equal(await count('Invitations'), before + 1, `${role}: una invitación`);
    }
  });
});
