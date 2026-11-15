// ES-276 · TherapistPersonOrdinals («Persona n») entra al registro de ES-23: se exporta (id, ordinal, fecha) y se PURGA con la persona; el contador monótono de ES-177 no reutiliza el número.
// Purga y exportación reales sobre PostgreSQL REAL (migraciones reales), pool de 5.
//   ES276_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-276-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-276 PostgreSQL + HTTP: la purga y la exportación cubren TherapistPersonOrdinals y el contador no reutiliza números', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES276_TEST_DATABASE_URL, 'Se requiere ES276_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES276_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es276_test_${crypto.randomBytes(8).toString('hex')}`;
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

  const { requestDeletion } = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const { personalData } = require('../../utils/personalData');
  const User = require('../../User');
  const therapist = await mkUser('therapist');
  const p1 = await mkUser('user', { therapistId: therapist.id });
  const p2 = await mkUser('user', { therapistId: therapist.id });
  const ordinalsOf = async (personId) => (await q('SELECT "therapistId","personId",ordinal FROM "TherapistPersonOrdinals" WHERE "personId"=$1', [personId]));
  const counter = async () => (await q('SELECT "lastOrdinal" FROM "TherapistOrdinalCounters" WHERE "therapistId"=$1', [therapist.id]))[0]?.lastOrdinal ?? 0;
  const panel = async () => (await http(therapist, 'GET', '/api/therapist/pacientes')).body;
  const purge = async (person) => {
    await requestDeletion(person.id);
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id;
    return processDeletion(request, { quiescent: true });
  };

  await t.test('«Persona n»: el panel del profesional asigna ordinales estables (1 y 2) a quienes no comparten', async () => {
    const list = await panel();
    assert.equal(list.length, 2);
    assert.deepEqual([(await ordinalsOf(p1.id))[0].ordinal, (await ordinalsOf(p2.id))[0].ordinal], [1, 2]);
    assert.equal(await counter(), 2);
  });

  await t.test('exportación: la persona recibe su ordinal (id, ordinal y fecha; sin el id del profesional)', async () => {
    const data = await personalData(await User.findByPk(p1.id), 'es');
    assert.ok(Array.isArray(data.therapistOrdinals) && data.therapistOrdinals.length === 1, JSON.stringify(Object.keys(data)));
    assert.deepEqual(Object.keys(data.therapistOrdinals[0]).sort(), ['createdAt', 'id', 'ordinal']);
    assert.equal(data.therapistOrdinals[0].ordinal, 1);
  });

  await t.test('PURGA (ES-276): al purgar a la persona desaparece su fila de TherapistPersonOrdinals y la de otra persona del mismo profesional NO se toca', async () => {
    assert.equal((await purge(p2)).status, 'awaiting_verification');
    assert.deepEqual(await ordinalsOf(p2.id), [], 'sin fila que enlace a la persona con su profesional');
    assert.equal((await ordinalsOf(p1.id)).length, 1); assert.equal((await ordinalsOf(p1.id))[0].ordinal, 1);
    assert.equal((await q('SELECT count(*)::int n FROM "MoodLogs" WHERE "UserId"=$1', [p2.id]))[0].n, 0);
  });

  await t.test('el contador es MONÓTONO: el número de la persona purgada NO se reutiliza (regla de ES-177)', async () => {
    assert.equal(await counter(), 2, 'el contador no baja al purgar');
    const p3 = await mkUser('user', { therapistId: therapist.id });
    await panel();
    const row = (await ordinalsOf(p3.id))[0];
    assert.equal(row.ordinal, 3, 'la nueva persona recibe 3, no el 2 de quien se purgó');
    assert.equal(await counter(), 3);
  });

  await t.test('una persona sin ordinal (nunca apareció en el panel) se purga sin error y repetir la purga es idempotente', async () => {
    const lonely = await mkUser('user');
    assert.equal((await purge(lonely)).status, 'awaiting_verification');
    const request = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [lonely.id]))[0].id;
    assert.equal((await processDeletion(request, { quiescent: true })).status, 'awaiting_verification');
    assert.deepEqual(await ordinalsOf(lonely.id), []);
  });
});
