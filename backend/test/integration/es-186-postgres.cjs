// ES-186 (parche) · Invitar persona y enviar enlace de restablecimiento por HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales).
// Guarda la respuesta REAL de los endpoints como fixtures del frontend (ES186_WRITE_FIXTURE=1) y falla si cambia su forma; comprueba que las rutas retiradas siguen en 410.
//   ES186_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-179-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const fs = require('node:fs');
const FIXTURES = path.join(__dirname, '..', '..', '..', 'frontend', 'test', 'fixtures');
const shapeOf = (v) => (v === null ? null : Array.isArray(v) ? [v.length ? shapeOf(v[0]) : null] : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])])) : typeof v);
const sameShape = (a, b) => (a === null || b === null) ? true : (Array.isArray(a) ? Array.isArray(b) && sameShape(a[0] ?? null, b[0] ?? null) : (a && typeof a === 'object') ? (b && typeof b === 'object' && !Array.isArray(b) && JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)) && Object.keys(a).every((k) => sameShape(a[k], b[k]))) : a === b);
// Contrato con la pantalla: la respuesta REAL se guarda como fixture del frontend (ES186_WRITE_FIXTURE=1) y cada corrida comprueba que su forma no cambió.
function contractFixture(name, status, body) {
  const file = path.join(FIXTURES, name);
  const doc = { status, body };
  if (process.env.ES186_WRITE_FIXTURE) { fs.mkdirSync(FIXTURES, { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 2) + String.fromCharCode(10)); return; }
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.status, status, name);
  assert.ok(sameShape(shapeOf(saved.body), shapeOf(body)), `la respuesta cambió de forma respecto de ${name}; regenera con ES186_WRITE_FIXTURE=1 y revisa la pantalla`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('ES-186 PostgreSQL + HTTP: invitaciones y enlace de restablecimiento con la forma real de la respuesta', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES186_TEST_DATABASE_URL, 'Se requiere ES186_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES186_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es186_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const mailer = { sent: true }; const mailerModule = require.resolve('../../utils/mailer'); const realMailer = require('../../utils/mailer');
  require.cache[mailerModule] = { id: mailerModule, filename: mailerModule, loaded: true, exports: { ...realMailer, sendInvitation: async () => ({ sent: mailer.sent }) } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/admin/invitations', verificarAdmin, require('../../routes/invitations').adminRouter);
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role, { therapistId = null } = {}) {
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
    await q('UPDATE "Users" SET role=$2, active=true, "therapistId"=$3 WHERE id=$1', [id, role, therapistId]);
    return { id, role, token: issueToken({ id, role }) };
  }
  const http = async (who, method, route, body) => {
    const res = await fetch(`${base}${route}`, { method, headers: { ...(who ? { Authorization: `Bearer ${who.token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); let parsed = null; try { parsed = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body: parsed };
  };

  const sup = await mkUser('superadmin'); const adm = await mkUser('admin'); const person = await mkUser('user');
  const victim = await mkUser('user');
  const inv = (who, body) => http(who, 'POST', '/api/admin/invitations', body);

  await t.test('invitar SIN correo configurado: 201 con emailSent:false (el servidor NO devuelve el enlace) — forma real guardada', async () => {
    delete process.env.APP_BASE_URL; mailer.sent = false;
    const r = await inv(sup, { email: 'nueva.persona@example.test', role: 'therapist', locale: 'es' });
    assert.equal(r.status, 201); assert.equal(r.body.emailSent, false);
    assert.equal(JSON.stringify(r.body).includes('token'), false, 'la respuesta no lleva el enlace ni el token');
    contractFixture('es-186-invite-recorded.json', r.status, r.body);
  });

  await t.test('invitar CON correo: 201 con emailSent:true, expiresAt y email — forma real guardada', async () => {
    process.env.APP_BASE_URL = 'https://app.example.test'; mailer.sent = true;
    const r = await inv(sup, { email: 'otra.persona@example.test', role: 'user', locale: 'en' });
    assert.equal(r.status, 201); assert.equal(r.body.emailSent, true); assert.ok(r.body.expiresAt); assert.equal(r.body.email, 'otra.persona@example.test');
    contractFixture('es-186-invite-sent.json', r.status, r.body);
  });

  await t.test('invitar: correo con cuenta = 409 email_taken; inválido = 400; rol no permitido = 403; sin sesión de administración = 403', async () => {
    const email = (await q('SELECT email FROM "Users" WHERE id=$1', [victim.id]))[0].email;
    const taken = await inv(sup, { email, role: 'user' });
    assert.equal(taken.status, 409); assert.equal(taken.body.code, 'email_taken'); contractFixture('es-186-invite-error.json', taken.status, taken.body);
    assert.equal((await inv(sup, { email: 'no-es-correo', role: 'user' })).body.code, 'invalid_email');
    assert.equal((await inv(adm, { email: 'x.admin@example.test', role: 'superadmin' })).body.code, 'role_not_allowed');
    assert.equal((await inv(person, { email: 'x.user@example.test', role: 'user' })).status, 403);
  });

  await t.test('enlace de restablecimiento: superadmin = 202 sin enlace; admin = 403; cuenta inexistente = 404 — forma real guardada', async () => {
    const ok = await http(sup, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, { locale: 'es' });
    assert.equal(ok.status, 202); assert.equal(Object.keys(ok.body).join(), 'message');
    assert.doesNotMatch(JSON.stringify(ok.body), /token|#/i, 'la respuesta no lleva el enlace');
    contractFixture('es-186-reset-link.json', ok.status, ok.body);
    assert.equal((await http(adm, 'POST', `/api/admin/usuarios/${victim.id}/reset-link`, {})).status, 403);
    assert.equal((await http(sup, 'POST', '/api/admin/usuarios/99999999/reset-link', {})).status, 404);
    const other = await mkUser('superadmin'); // E186-4: el 403 a OTRO superadmin trae un texto propio; la pantalla lo distingue por «otro superadmin»
    const toOther = await http(sup, 'POST', `/api/admin/usuarios/${other.id}/reset-link`, {});
    assert.equal(toOther.status, 403); assert.match(toOther.body.error, /otro superadmin/i);
    contractFixture('es-186-reset-link-superadmin-403.json', toOther.status, toOther.body);
  });

  await t.test('las rutas retiradas por ES-192 siguen en 410 (la pantalla ya no las llama)', async () => {
    const created = await http(sup, 'POST', '/api/admin/usuarios', { name: 'X', email: 'x@example.test', password: 'Abcdef1!', role: 'user' });
    assert.equal(created.status, 410);
    const reset = await http(sup, 'PUT', `/api/admin/usuarios/${victim.id}/reset-password`, { newPassword: 'Abcdef1!' });
    assert.equal(reset.status, 410);
  });
});
