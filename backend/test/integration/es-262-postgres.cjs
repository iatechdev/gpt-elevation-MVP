// ES-262 (E227-1) · Fechas hostiles (fuera del rango de JavaScript o de la base, inexistentes, vacías, de otro tipo o enormes) en sesiones y notas del profesional: 400 con `code`/`field`,
// nunca 500, y nada se guarda. HTTP REAL, JWT real, PostgreSQL REAL (migraciones reales), pool de 5.
//   ES262_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-262-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-262 PostgreSQL + HTTP: entradas hostiles de fecha (E227-1) responden 400 y nunca 5xx', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES262_TEST_DATABASE_URL, 'Se requiere ES262_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES262_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es262_test_${crypto.randomBytes(8).toString('hex')}`;
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

  app = new Sequelize(urlFor(dbName), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
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
  const { setConsent } = require('../../utils/consent');
  const { verificarToken, verificarAdmin, verificarSuperAdmin, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/matching', verificarAdmin, require('../../routes/matching'));
  api.use('/api/admin/plan-requests', verificarAdmin, require('../../routes/planRequests'));
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  api.use('/api/admin/invitations', verificarAdmin, require('../../routes/invitations').adminRouter);
  api.use('/api/superadmin/audit', verificarSuperAdmin, require('../../routes/adminAudit'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  api.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
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

  const therapist = await mkUser('therapist'); const other = await mkUser('therapist');
  const person = await mkUser('user', { therapistId: therapist.id });
  await setConsent(person.id, 'therapist_sharing', 'granted', `therapist-${therapist.id}`);
  const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
  const sessionsCount = async () => (await q('SELECT count(*)::int n FROM "TherapySessions"'))[0].n;
  const notesCount = async () => (await q('SELECT count(*)::int n FROM "ClinicalNotes"'))[0].n;

  // Entradas hostiles de fecha: fuera del rango de JavaScript o de la base, inexistentes, vacías, de otro tipo o enormes.
  const HOSTILE = ['+275760-09-13T00:00:00.000Z', '+275760-09-13', '-271821-04-20T00:00:00.000Z', '+010000-01-01T00:00:00.000Z', '10000-01-01T00:00:00Z', '9999-12-31T23:59:59.999Z ', '1899-12-31T23:59:59Z',
    '0000-01-01T00:00:00Z', '2026-13-45T10:00:00Z', '2026-02-30T10:00:00Z', 'mañana', 'Invalid Date', '', '   ', 'NaN', 'null', 'undefined', '0', '99999999999999999', `${'9'.repeat(70)}`, `2030-01-01T10:00:00Z${' '.repeat(64)}`, '2030-01-01T10:00:00Z\u0000', '<script>alert(1)</script>', "2030-01-01'; DROP TABLE \"TherapySessions\";--"];
  const NOT_STRINGS = [12345, 1e21, -1, true, false, null, {}, [], ['2030-01-01T10:00:00Z'], { $date: '2030-01-01' }];

  await t.test('E227-1: POST /api/sessions/therapist con una fecha hostil responde 400 scheduled_invalid (campo scheduledAt), nunca 5xx, y no crea la sesión', async () => {
    const before = await sessionsCount();
    for (const scheduledAt of HOSTILE) {
      const out = await http(therapist, 'POST', '/api/sessions/therapist', { patientId: person.id, scheduledAt });
      assert.equal(out.status, 400, `${JSON.stringify(scheduledAt).slice(0, 40)} → ${out.status} ${JSON.stringify(out.body).slice(0, 80)}`);
      assert.ok(out.body.code === 'scheduled_invalid' || out.body.code === 'invalid_input' || out.body.error, 'respuesta de error controlada');
      if (scheduledAt.trim() !== '') assert.equal(out.body.code, 'scheduled_invalid', JSON.stringify(scheduledAt).slice(0, 40));
      assert.ok(!JSON.stringify(out.body).includes(scheduledAt.slice(0, 20)) || scheduledAt.length < 3, 'no repite lo recibido');
    }
    for (const scheduledAt of NOT_STRINGS) {
      const out = await http(therapist, 'POST', '/api/sessions/therapist', { patientId: person.id, scheduledAt });
      assert.equal(out.status, 400, `${JSON.stringify(scheduledAt)} → ${out.status}`);
    }
    assert.equal(await sessionsCount(), before, 'ninguna sesión creada');
    // una fecha válida sigue funcionando
    const ok = await http(therapist, 'POST', '/api/sessions/therapist', { patientId: person.id, scheduledAt: future(3) });
    assert.equal(ok.status, 201);
  });

  await t.test('E227-1: PUT /api/sessions/therapist/:id con una fecha hostil responde 400 scheduled_invalid y la sesión no cambia', async () => {
    const created = await http(therapist, 'POST', '/api/sessions/therapist', { patientId: person.id, scheduledAt: future(10) });
    assert.equal(created.status, 201); const id = created.body.session.id;
    const original = (await q('SELECT "scheduledAt" FROM "TherapySessions" WHERE id=$1', [id]))[0].scheduledAt;
    for (const scheduledAt of HOSTILE.filter((v) => v.trim() !== '')) {
      const out = await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt });
      assert.equal(out.status, 400, `${JSON.stringify(scheduledAt).slice(0, 40)} → ${out.status}`);
      assert.equal(out.body.code, 'scheduled_invalid');
    }
    assert.equal(String((await q('SELECT "scheduledAt" FROM "TherapySessions" WHERE id=$1', [id]))[0].scheduledAt), String(original));
    assert.equal((await http(therapist, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt: future(11) })).status, 200);
    assert.equal((await http(other, 'PUT', `/api/sessions/therapist/${id}`, { scheduledAt: '+275760-09-13T00:00:00.000Z' })).status < 500, true);
  });

  await t.test('E227-1 (mismo patrón): las notas con una fecha de sesión hostil responden 400, nunca 5xx (alta y edición)', async () => {
    const before = await notesCount();
    for (const sessionDate of [...HOSTILE, ...NOT_STRINGS.filter((v) => v !== null)]) {
      const out = await http(therapist, 'POST', `/api/therapist/pacientes/${person.id}/notas`, { content: 'Nota sintética', sessionDate });
      assert.equal(out.status, 400, `alta ${JSON.stringify(sessionDate)?.slice(0, 40)} → ${out.status}`);
    }
    assert.equal(await notesCount(), before);
    const good = await http(therapist, 'POST', `/api/therapist/pacientes/${person.id}/notas`, { content: 'Nota sintética', sessionDate: '2026-11-01T10:00:00Z' });
    assert.equal(good.status, 201, JSON.stringify(good.body));
    const noteId = good.body.id ?? good.body.note?.id;
    assert.ok(noteId, 'id de la nota');
    for (const sessionDate of HOSTILE.filter((v) => v.trim() !== '')) {
      const out = await http(therapist, 'PUT', `/api/therapist/notas/${noteId}`, { sessionDate });
      assert.equal(out.status, 400, `edición ${JSON.stringify(sessionDate).slice(0, 40)} → ${out.status}`);
    }
  });

  await t.test('rango exacto: 1900-01-01 y 2999-12-31 son los límites; la validación no depende de la zona horaria ni de espacios', async () => {
    const { parseBoundedDate } = require('../../utils/safeDate');
    assert.ok(parseBoundedDate('1900-01-01T00:00:00Z')); assert.ok(parseBoundedDate('2999-12-31T23:59:59.999Z')); assert.equal(parseBoundedDate('3000-01-01T00:00:00Z'), null);
    assert.equal(parseBoundedDate('1899-12-31T23:59:59.999Z'), null); assert.equal(parseBoundedDate('+010000-01-01T00:00:00Z'), null);
    assert.equal(parseBoundedDate(undefined), null); assert.equal(parseBoundedDate(new Date()), null); assert.equal(parseBoundedDate(1700000000000), null);
  });
});
