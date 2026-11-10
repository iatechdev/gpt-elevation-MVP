// ES-177 (HU-P26) · Panel profesional por HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales con sequelize-cli).
// Una sola guía pendiente por profesional AUNQUE lleguen propuestas simultáneas (la regla vive dentro del bloqueo), y /alerts ya trae la palabra «mejoró» (sin depender del porcentaje).
//   ES177_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-179-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('ES-177 PostgreSQL + HTTP: una guía pendiente por profesional y avisos sin porcentaje', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES177_TEST_DATABASE_URL, 'Se requiere ES177_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES177_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es177_test_${crypto.randomBytes(8).toString('hex')}`;
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
  process.env.PROMPT_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.PROMPT_PROPOSALS_PER_HOUR = '50';
  process.env.NODE_ENV = 'test';
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000000'; process.env.AI_BUDGET_PERIOD = 'month';
  process.env.DAILY_API_KEY = 'clave-sintetica-no-real'; // con clave, la ruta llama a la sala externa: aquí la intercepta un doble
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  const anthropicModule = require.resolve('../../utils/anthropic');
  const provider = { calls: 0 };
  require.cache[anthropicModule] = { id: anthropicModule, filename: anthropicModule, loaded: true, exports: {
    MODEL: 'modelo-sintetico', messages: { create: async () => { provider.calls += 1; return { content: [{ type: 'text', text: 'Recomendación sintética.' }], usage: { input_tokens: 10, output_tokens: 5 } }; } },
  } };
  require('../../associations')();
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
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

  const tA = await mkUser('therapist'); const tB = await mkUser('therapist');
  const p1 = await mkUser('user', { therapistId: tA.id }); const p2 = await mkUser('user', { therapistId: tA.id });
  assert.equal((await http(p1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200); // p1 autoriza a tA; p2 no
  const GUIDE = 'Acompaña con calidez y escucha activa, sin juzgar, y pregunta por el ritmo y los límites de cada persona antes de proponer cualquier paso.';
  const pending = async (id) => (await q(`SELECT count(*)::int AS n FROM "PromptVaults" WHERE key=$1 AND status='pending_review'`, [`therapist_prompt_${id}`]))[0].n;

  await t.test('8 propuestas simultáneas del mismo profesional: UNA pendiente, el resto 409 pending_exists', async () => {
    const all = await Promise.all(Array.from({ length: 8 }, () => http(tA, 'POST', '/api/therapist/prompt/propose', { content: GUIDE })));
    const ok = all.filter((r) => r.status >= 200 && r.status < 300);
    assert.equal(ok.length, 1, JSON.stringify(all.map((r) => [r.status, r.body && (r.body.code || r.body.error)])));
    assert.ok(all.filter((r) => r.status !== ok[0].status).every((r) => r.status === 409), JSON.stringify(all.map((r) => r.status)));
    assert.equal(await pending(tA.id), 1, 'una sola fila pendiente');
  });

  await t.test('con una pendiente, otra propuesta secuencial = 409 con el mensaje de siempre; otro profesional propone sin problema (A/B)', async () => {
    const again = await http(tA, 'POST', '/api/therapist/prompt/propose', { content: GUIDE });
    assert.equal(again.status, 409); assert.match(again.body.error, /already have a version pending review/);
    const other = await http(tB, 'POST', '/api/therapist/prompt/propose', { content: GUIDE });
    assert.ok(other.status >= 200 && other.status < 300, JSON.stringify(other.body));
    assert.equal(await pending(tB.id), 1); assert.equal(await pending(tA.id), 1);
  });

  await t.test('roles incorrectos y contenido corto no crean nada', async () => {
    assert.equal((await http(p1, 'POST', '/api/therapist/prompt/propose', { content: GUIDE })).status, 403);
    const tC = await mkUser('therapist');
    assert.equal((await http(tC, 'POST', '/api/therapist/prompt/propose', { content: 'corto' })).status, 400);
    assert.equal(await pending(tC.id), 0);
  });

  await t.test('/alerts: quien mejoró trae improved:true (palabra), solo de quien autorizó; la cifra queda deprecada para la pantalla actual', async () => {
    const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    for (const person of [p1, p2]) {
      for (const [offset, a, b] of [[1, 4, 5], [2, 4, 4], [5, 2, 3], [6, 2, 2]]) {
        await q(`INSERT INTO "MoodLogs" ("UserId","checkin_mood","checkout_mood","date","createdAt","updatedAt") VALUES ($1,$2,$3,$4,now(),now())`, [person.id, a, b, day(offset)]);
      }
    }
    const alerts = await http(tA, 'GET', '/api/therapist/alerts');
    assert.equal(alerts.status, 200);
    assert.deepEqual(alerts.body.notableProgress.map((a) => a.userId), [p1.id], 'p2 no autorizó: no aparece');
    assert.equal(alerts.body.notableProgress[0].improved, true);
    assert.equal(typeof alerts.body.notableProgress[0].improvementPercent, 'number', 'deprecado: lo lee la pantalla actual hasta su PR de frontend');
  });
});
