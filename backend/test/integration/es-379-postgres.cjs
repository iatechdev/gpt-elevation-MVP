// ES-379 · «Enviar enlace de restablecimiento» (administración) dice la verdad: emailSent true/false, y si el correo no sale NO queda ningún enlace vivo.
// HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales). El PROVEEDOR de correo está simulado. Crea y borra SOLO su propia base aleatoria en loopback. Nunca carga .env.
//   ES379_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-379-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

// Contrato con la pantalla: la respuesta REAL del servidor se guarda como fixture del frontend (ES379_WRITE_FIXTURE=1) y cada corrida comprueba que su forma no cambió.
const fixtureFs = require('node:fs');
const FIXTURES = path.join(__dirname, '..', '..', '..', 'frontend', 'test', 'fixtures');
const shapeOf = (v) => (v === null ? null : Array.isArray(v) ? [v.length ? shapeOf(v[0]) : null] : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])])) : typeof v);
function contractFixture(name, status, body) {
  const file = path.join(FIXTURES, name);
  if (process.env.ES379_WRITE_FIXTURE) { fixtureFs.mkdirSync(FIXTURES, { recursive: true }); fixtureFs.writeFileSync(file, JSON.stringify({ status, body }, null, 2) + String.fromCharCode(10)); return; }
  const saved = JSON.parse(fixtureFs.readFileSync(file, 'utf8'));
  assert.equal(saved.status, status, name);
  assert.deepEqual(shapeOf(saved.body), shapeOf(body), `la respuesta cambió de forma respecto de ${name}; regenera con ES379_WRITE_FIXTURE=1 y revisa la pantalla`);
}

test('ES-379 PostgreSQL + HTTP: emailSent veraz y enlace invalidado si el correo no sale', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES379_TEST_DATABASE_URL, 'Se requiere ES379_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES379_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es379_test_${crypto.randomBytes(8).toString('hex')}`;
  const urlFor = (name) => { const u = new URL(target.toString()); u.pathname = `/${name}`; return u.toString(); };
  const admin = new Client({ connectionString: target.toString(), ssl: false }); await admin.connect();
  let created = false; let app; let server; let db;
  t.after(async () => {
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  process.env.PASSWORD_RESET_IP_LIMIT = '100000'; process.env.PASSWORD_RESET_CONFIRM_LIMIT = '100000';
  const BASE = 'https://app.example.invalid';
  process.env.APP_BASE_URL = BASE;
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const mailer = require('../../utils/mailer');
  const sink = { messages: [], mode: 'ok' };
  mailer.providers.test = async (message) => {
    sink.messages.push(message);
    if (sink.mode === 'throw') throw new Error('proveedor caído ' + message.to);
  };
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  api.use('/api', require('../../routes/passwordReset'));
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
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `canario-${seq}-${dbName}@example.invalid` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id, email`, values))[0];
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id.id, role]);
    return { id: id.id, email: id.email, role, token: issueToken({ id: id.id, role }) };
  }
  const http = async (user, method, route, body) => {
    const res = await fetch(base + route, { method, headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const resets = (userId) => q('SELECT "tokenHash", "usedAt", "expiresAt" FROM "PasswordResets" WHERE "UserId"=$1 ORDER BY id', [userId]);
  const tokenFrom = (message) => { const m = /#token=([A-Za-z0-9_-]{43})/.exec(message.text); assert.ok(m, 'el correo lleva el enlace'); return m[1]; };
  const confirm = (token) => http(null, 'POST', '/api/password-reset/confirm', { token, password: 'Clave-nueva-67890!' });
  const captureLogs = async (fn) => {
    const lines = []; const original = { log: console.log, error: console.error, warn: console.warn };
    for (const level of Object.keys(original)) console[level] = (...args) => { lines.push(args.map(String).join(' ')); };
    try { return { result: await fn(), logs: lines.join('\n') }; } finally { Object.assign(console, original); }
  };

  const sup = await mkUser('superadmin');
  const PROVIDER = () => { process.env.MAIL_PROVIDER = 'test'; sink.messages.length = 0; sink.mode = 'ok'; };

  await t.test('correo enviado: emailSent:true con los minutos de vigencia y el enlace sirve UNA vez', async () => {
    PROVIDER();
    const person = await mkUser('user');
    const reply = await http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, { locale: 'es' });
    assert.equal(reply.status, 202); assert.equal(reply.body.emailSent, true); assert.equal(reply.body.expiresInMinutes, 30);
    contractFixture('es-379-reset-link-sent.json', reply.status, reply.body);
    assert.ok(!JSON.stringify(reply.body).includes('token') && !JSON.stringify(reply.body).includes(BASE), 'la respuesta no lleva el enlace');
    assert.equal(sink.messages.length, 1); assert.equal(sink.messages[0].to, person.email);
    const token = tokenFrom(sink.messages[0]);
    assert.equal((await confirm(token)).status, 200);
    assert.equal((await confirm(token)).status, 400, 'segundo uso rechazado');
  });

  await t.test('el proveedor falla: emailSent:false y el enlace queda INVALIDADO (confirmar da error); el log no lleva datos', async () => {
    PROVIDER(); sink.mode = 'throw';
    const person = await mkUser('user');
    const { result: reply, logs } = await captureLogs(() => http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {}));
    assert.equal(reply.status, 202); assert.equal(reply.body.emailSent, false); assert.equal(reply.body.expiresInMinutes, undefined);
    contractFixture('es-379-reset-link-not-sent.json', reply.status, reply.body);
    assert.equal(reply.body.reason, 'unavailable'); assert.equal(reply.body.limitPerHour, undefined);
    assert.match(reply.body.message, /No se pudo enviar el correo/); assert.match(reply.body.message, /could not be sent/);
    assert.equal(sink.messages.length, 1, 'se intentó una vez');
    const token = tokenFrom(sink.messages[0]);
    const rows = await resets(person.id);
    assert.equal(rows.length, 1); assert.ok(rows[0].usedAt, 'la fila quedó usada/invalidada'); assert.equal(rows[0].tokenHash, sha256(token));
    assert.equal((await confirm(token)).status, 400, 'el enlace que no salió no sirve');
    assert.ok(!logs.includes(token) && !logs.includes(person.email) && !logs.includes('example.invalid'), 'el log no lleva token ni correo');
    assert.match(logs, /Correo de recuperación no enviado/);
    const audit = JSON.stringify(await q('SELECT * FROM "AdminAuditEntries" WHERE "targetId"=$1', [person.id]));
    assert.ok(audit.includes('user.reset_link') && !audit.includes(token) && !audit.includes('example.invalid'), 'auditoría sin token ni correo');
  });

  await t.test('sin proveedor (MAIL_PROVIDER vacío o no soportado): emailSent:false y ni siquiera se crea el enlace', async () => {
    for (const value of [undefined, '', 'otro']) {
      sink.messages.length = 0;
      if (value === undefined) delete process.env.MAIL_PROVIDER; else process.env.MAIL_PROVIDER = value;
      const person = await mkUser('user');
      const { result: reply, logs } = await captureLogs(() => http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {}));
      assert.equal(reply.status, 202); assert.equal(reply.body.emailSent, false, String(value));
      assert.equal((await resets(person.id)).length, 0, 'no se creó ninguna fila');
      assert.equal(sink.messages.length, 0);
      assert.match(logs, /sin proveedor de correo configurado/); assert.ok(!logs.includes(person.email));
    }
  });

  await t.test('sin APP_BASE_URL ni FRONTEND_URL: emailSent:false, no se crea el enlace y el aviso del log es de texto fijo', async () => {
    PROVIDER();
    const savedBase = process.env.APP_BASE_URL; const savedFront = process.env.FRONTEND_URL;
    delete process.env.APP_BASE_URL; delete process.env.FRONTEND_URL;
    try {
      const person = await mkUser('user');
      const { result: reply, logs } = await captureLogs(() => http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {}));
      assert.equal(reply.body.emailSent, false); assert.equal((await resets(person.id)).length, 0); assert.equal(sink.messages.length, 0);
      assert.match(logs, /falta APP_BASE_URL o FRONTEND_URL/); assert.ok(!logs.includes(person.email));
    } finally { process.env.APP_BASE_URL = savedBase; if (savedFront !== undefined) process.env.FRONTEND_URL = savedFront; }
  });

  await t.test('FRONTEND_URL sirve como base cuando no hay APP_BASE_URL', async () => {
    PROVIDER();
    const savedBase = process.env.APP_BASE_URL; delete process.env.APP_BASE_URL; process.env.FRONTEND_URL = 'https://front.example.invalid';
    try {
      const person = await mkUser('user');
      assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {})).body.emailSent, true);
      assert.ok(sink.messages[0].text.includes('https://front.example.invalid/reset-password#token='));
    } finally { process.env.APP_BASE_URL = savedBase; delete process.env.FRONTEND_URL; }
  });

  await t.test('el tope de 3 por hora sigue valiendo: el 4.º da emailSent:false y no crea nada', async () => {
    PROVIDER();
    const person = await mkUser('user');
    for (let i = 0; i < 3; i += 1) assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {})).body.emailSent, true);
    const fourth = await http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {});
    assert.equal(fourth.body.emailSent, false); assert.equal((await resets(person.id)).length, 3); assert.equal(sink.messages.length, 3);
    assert.equal(fourth.status, 202); assert.equal(fourth.body.reason, 'rate_limited'); assert.equal(fourth.body.limitPerHour, 3, 'el límite sale del valor real del servidor');
    contractFixture('es-379-reset-link-rate-limited.json', fourth.status, fourth.body);
    const saved = process.env.PASSWORD_RESET_PER_ACCOUNT_HOUR; process.env.PASSWORD_RESET_PER_ACCOUNT_HOUR = '5';
    try {
      const other = await mkUser('user');
      for (let i = 0; i < 5; i += 1) assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${other.id}/reset-link`, {})).body.emailSent, true);
      const sixth = await http(sup, 'POST', `/api/admin/usuarios/${other.id}/reset-link`, {});
      assert.equal(sixth.body.reason, 'rate_limited'); assert.equal(sixth.body.limitPerHour, 5, 'si cambia el límite del servidor, cambia el número');
    } finally { if (saved === undefined) delete process.env.PASSWORD_RESET_PER_ACCOUNT_HOUR; else process.env.PASSWORD_RESET_PER_ACCOUNT_HOUR = saved; }
  });

  await t.test('cuenta inactiva: emailSent:false y sin enlace', async () => {
    PROVIDER();
    const person = await mkUser('user'); await q('UPDATE "Users" SET active=false WHERE id=$1', [person.id]);
    const reply = await http(sup, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {});
    assert.equal(reply.status, 202); assert.equal(reply.body.emailSent, false); assert.equal(reply.body.reason, 'not_eligible'); assert.equal(reply.body.limitPerHour, undefined); assert.equal((await resets(person.id)).length, 0);
    contractFixture('es-379-reset-link-not-eligible.json', reply.status, reply.body);
    assert.ok(!JSON.stringify(reply.body).includes(person.email) && !JSON.stringify(reply.body).includes(String(person.id)), 'la respuesta no lleva datos de la cuenta');
    const pending = await mkUser('user'); await q('INSERT INTO "DeletionRequests" (id, "UserId", status, attempts, "createdAt", "updatedAt") VALUES ($1, $2, $3, 0, now(), now())', [crypto.randomUUID(), pending.id, 'accepted']);
    const gone = await http(sup, 'POST', `/api/admin/usuarios/${pending.id}/reset-link`, {});
    assert.equal(gone.status, 409, 'la baja pendiente la rechaza la ruta antes de llegar al envío (refuseDeletionPending)');
  });

  await t.test('las reglas de acceso no cambian (solo superadmin; no a otro superadmin; 404)', async () => {
    PROVIDER();
    const adm = await mkUser('admin'); const person = await mkUser('user'); const other = await mkUser('superadmin');
    assert.equal((await http(adm, 'POST', `/api/admin/usuarios/${person.id}/reset-link`, {})).status, 403);
    assert.equal((await http(sup, 'POST', `/api/admin/usuarios/${other.id}/reset-link`, {})).status, 403);
    assert.equal((await http(sup, 'POST', '/api/admin/usuarios/999999/reset-link', {})).status, 404);
    assert.equal(sink.messages.length, 0);
  });

  await t.test('la ruta PÚBLICA no cambia: 202 idéntico exista o no la cuenta, falle o no el proveedor, y si el correo no sale el enlace queda invalidado', async () => {
    PROVIDER();
    const person = await mkUser('user');
    const ok = await http(null, 'POST', '/api/password-reset/request', { email: person.email });
    const missing = await http(null, 'POST', '/api/password-reset/request', { email: 'nadie@example.invalid' });
    assert.deepEqual(ok, missing); assert.equal(ok.status, 202); assert.equal(Object.keys(ok.body).join(), 'message');
    await new Promise(r => setTimeout(r, 400)); await require('../../routes/passwordReset').idle();
    assert.equal(sink.messages.length, 1, 'solo la cuenta real recibe correo');
    sink.mode = 'throw'; sink.messages.length = 0;
    const failing = await mkUser('user');
    const reply = await http(null, 'POST', '/api/password-reset/request', { email: failing.email });
    assert.deepEqual(reply, ok);
    await require('../../routes/passwordReset').idle();
    const rows = await resets(failing.id);
    assert.equal(rows.length, 1); assert.ok(rows[0].usedAt, 'enlace invalidado'); assert.equal((await confirm(tokenFrom(sink.messages[0]))).status, 400);
  });
});
