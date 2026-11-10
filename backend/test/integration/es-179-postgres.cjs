// ES-179 (HU-P28) · Sala de sesión del profesional por HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales con sequelize-cli).
// start idempotente y atómico (recargar o dos pestañas = la misma sala; una sola sala creada), UNA nota en vivo por sesión con versión y requestId,
// cierre atómico (409 si ya terminó; una sola recomendación), máximos de longitud y filas antiguas intactas. Datos sintéticos; el proveedor de IA y la sala externa son dobles.
//   ES179_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-179-postgres.cjs
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

test('ES-179 PostgreSQL + HTTP: start idempotente, una nota en vivo, cierre atómico', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES179_TEST_DATABASE_URL, 'Se requiere ES179_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES179_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es179_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const { verificarToken } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  // Doble de la sala externa: cuenta cuántas salas se piden (con retardo, para que las solicitudes simultáneas se solapen).
  const rooms = { created: 0, fail: false };
  global.fetch = async (url, options) => {
    if (String(url).startsWith('https://api.daily.co/')) {
      await sleep(120);
      if (rooms.fail) return { ok: false, status: 500, json: async () => ({ error: 'caído' }) };
      rooms.created += 1;
      const name = JSON.parse(options.body).name;
      return { ok: true, status: 200, json: async () => ({ url: `https://sintetico.daily.test/${name}` }) };
    }
    return realFetch(url, options);
  };

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
  const mkSession = async (therapist, person, status = 'scheduled') => (await q(
    `INSERT INTO "TherapySessions" ("therapistId","patientId","scheduledAt",status,duration,"createdAt","updatedAt") VALUES ($1,$2,now() + interval '1 hour',$3,50,now(),now()) RETURNING id`,
    [therapist.id, person.id, status]))[0].id;
  const row = async (id) => (await q('SELECT status, "meetingUrl", "startedAt", "endedAt", "patientMoodAfter" FROM "TherapySessions" WHERE id=$1', [id]))[0];

  const tA = await mkUser('therapist'); const tB = await mkUser('therapist');
  const p1 = await mkUser('user', { therapistId: tA.id }); const p2 = await mkUser('user', { therapistId: tA.id });
  assert.equal((await http(p1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200); // p1 autoriza a tA; p2 no

  await t.test('la migración es aditiva e idempotente: columnas NULLABLE sin DEFAULT, índice único parcial y las filas antiguas intactas', async () => {
    const cols = await q(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='SessionNotes' AND column_name IN ('isLive','version','requestId') ORDER BY column_name`);
    assert.deepEqual(cols.map((c) => [c.column_name, c.is_nullable, c.column_default]), [['isLive', 'YES', null], ['requestId', 'YES', null], ['version', 'YES', null]]);
    const index = await q(`SELECT indexdef FROM pg_indexes WHERE tablename='SessionNotes' AND indexname='session_notes__live'`);
    assert.equal(index.length, 1); assert.match(index[0].indexdef, /UNIQUE/); assert.match(index[0].indexdef, /"sessionId", "therapistId"/); assert.match(index[0].indexdef, /"isLive" = true/);
    const migration = require('../../migrations/20261111000000-es179-session-note-live.cjs');
    const sid = await mkSession(tA, p1, 'in_progress');
    await q(`INSERT INTO "SessionNotes" ("sessionId","therapistId",content,"timestamp","createdAt","updatedAt") VALUES ($1,$2,'v2:antigua-1',now(),now(),now()),($1,$2,'v2:antigua-2',now(),now(),now())`, [sid, tA.id]);
    await migration.up(app); await migration.up(app); // dos veces: no falla ni cambia nada
    assert.equal((await q('SELECT count(*)::int AS n FROM "SessionNotes" WHERE "sessionId"=$1 AND "isLive" IS NULL', [sid]))[0].n, 2, 'las filas antiguas siguen ahí con isLive NULL');
  });

  await t.test('start: la primera llamada crea la sala y la siguiente (recargar) devuelve LA MISMA sala sin crear otra', async () => {
    const sid = await mkSession(tA, p1); rooms.created = 0;
    const first = await http(tA, 'POST', `/api/sessions/therapist/${sid}/start`);
    assert.equal(first.status, 200); assert.equal(first.body.resumed, false); assert.match(first.body.meetingUrl, /^https:\/\/sintetico\.daily\.test\//); assert.ok(first.body.startedAt);
    const again = await http(tA, 'POST', `/api/sessions/therapist/${sid}/start`);
    assert.equal(again.status, 200); assert.equal(again.body.resumed, true);
    assert.equal(again.body.meetingUrl, first.body.meetingUrl); assert.equal(again.body.startedAt, first.body.startedAt);
    assert.equal(rooms.created, 1, 'una sola sala creada');
    assert.equal((await row(sid)).status, 'in_progress');
  });

  await t.test('start simultáneo (6 solicitudes, dos pestañas / doble clic): UNA sola sala y todas reciben la misma URL', async () => {
    const sid = await mkSession(tA, p1); rooms.created = 0;
    const all = await Promise.all(Array.from({ length: 6 }, () => http(tA, 'POST', `/api/sessions/therapist/${sid}/start`)));
    assert.deepEqual([...new Set(all.map((r) => r.status))], [200], JSON.stringify(all.map((r) => r.body)));
    assert.equal(new Set(all.map((r) => r.body.meetingUrl)).size, 1);
    assert.equal(all.filter((r) => r.body.resumed === false).length, 1, 'solo una inicia de verdad');
    assert.equal(rooms.created, 1, 'una sola sala creada');
  });

  await t.test('start: si la sala no se puede crear NO se registra el inicio (502 estable) y reintentar funciona', async () => {
    const sid = await mkSession(tA, p1); rooms.fail = true;
    const failed = await http(tA, 'POST', `/api/sessions/therapist/${sid}/start`);
    assert.equal(failed.status, 502); assert.equal(failed.body.code, 'room_unavailable'); assert.equal(failed.body.retryable, true);
    assert.deepEqual([(await row(sid)).status, (await row(sid)).meetingUrl], ['scheduled', null]);
    rooms.fail = false;
    assert.equal((await http(tA, 'POST', `/api/sessions/therapist/${sid}/start`)).status, 200);
  });

  await t.test('start: sesión ajena = 404; sin autorización de la persona = 403 y la sesión no cambia; rol incorrecto = 403; sesión terminada = 400', async () => {
    const sid = await mkSession(tA, p1);
    assert.equal((await http(tB, 'POST', `/api/sessions/therapist/${sid}/start`)).status, 404);
    assert.equal((await http(p1, 'POST', `/api/sessions/therapist/${sid}/start`)).status, 403);
    assert.equal((await row(sid)).status, 'scheduled');
    const noConsent = await mkSession(tA, p2);
    const denied = await http(tA, 'POST', `/api/sessions/therapist/${noConsent}/start`);
    assert.equal(denied.status, 403); assert.equal((await row(noConsent)).status, 'scheduled');
    const done = await mkSession(tA, p1, 'completed');
    const r = await http(tA, 'POST', `/api/sessions/therapist/${done}/start`);
    assert.equal(r.status, 400); assert.equal(r.body.code, 'session_not_startable');
  });

  await t.test('notas en vivo: 30 autoguardados = UNA fila (la última), versión 30, filas antiguas intactas', async () => {
    const sid = await mkSession(tA, p1, 'in_progress');
    await q(`INSERT INTO "SessionNotes" ("sessionId","therapistId",content,"timestamp","createdAt","updatedAt") VALUES ($1,$2,$3,now(),now(),now())`, [sid, tA.id, require('../../utils/crypto').encriptar('Nota antigua')]);
    let version = 0;
    for (let i = 1; i <= 30; i++) {
      const r = await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: `Texto ${i}`, version });
      assert.equal(r.status, i === 1 ? 201 : 200, JSON.stringify(r.body)); version = r.body.note.version;
    }
    assert.equal(version, 30);
    const rows = await q('SELECT "isLive", version FROM "SessionNotes" WHERE "sessionId"=$1 ORDER BY id', [sid]);
    assert.equal(rows.length, 2, 'la fila antigua + UNA nota en vivo'); assert.deepEqual(rows.map((r) => r.isLive), [null, true]); assert.equal(rows[1].version, 30);
    const list = await http(tA, 'GET', `/api/sessions/therapist/${sid}/notes`); assert.equal(list.status, 200, JSON.stringify(list.body));
    assert.equal(list.body.find((n) => n.isLive).content, 'Texto 30');
    const stored = (await q('SELECT content FROM "SessionNotes" WHERE "sessionId"=$1 AND "isLive"', [sid]))[0].content;
    assert.doesNotMatch(stored, /Texto 30/, 'la nota se guarda cifrada');
  });

  await t.test('notas: versión vieja (otra pestaña) = 409 note_changed con la versión vigente; requestId repetido = 200 sin cambios', async () => {
    const sid = await mkSession(tA, p1, 'in_progress');
    const a = await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: 'Primera', version: 0, requestId: 'req-aaaaaaaa-1' });
    assert.deepEqual([a.status, a.body.note.version], [201, 1]);
    const b = await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: 'Segunda', version: 1, requestId: 'req-aaaaaaaa-2' });
    assert.deepEqual([b.status, b.body.note.version], [200, 2]);
    const stale = await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: 'Pestaña vieja', version: 1, requestId: 'req-aaaaaaaa-3' });
    assert.equal(stale.status, 409); assert.equal(stale.body.code, 'note_changed'); assert.deepEqual([stale.body.current.content, stale.body.current.version], ['Segunda', 2]);
    const replay = await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: 'Segunda', version: 1, requestId: 'req-aaaaaaaa-2' });
    assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.note.version, 2, 'el reintento no sube la versión');
    const wrongNew = await mkSession(tA, p1, 'in_progress');
    assert.equal((await http(tA, 'POST', `/api/sessions/therapist/${wrongNew}/notes`, { content: 'x', version: 5 })).status, 409, 'versión esperada sin nota previa');
  });

  await t.test('notas: 8 primeras notas simultáneas = UNA fila; cliente sin versión sobrescribe sin duplicar', async () => {
    const sid = await mkSession(tA, p1, 'in_progress');
    const all = await Promise.all(Array.from({ length: 8 }, (_, i) => http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: `Simultánea ${i}` })));
    assert.ok(all.every((r) => [200, 201].includes(r.status)), JSON.stringify(all.map((r) => r.status)));
    assert.equal((await q('SELECT count(*)::int AS n FROM "SessionNotes" WHERE "sessionId"=$1', [sid]))[0].n, 1);
  });

  await t.test('notas: máximo 20.000, requestId/versión inválidos = 400; sesión ajena = 404; no en curso = 400; sin autorización = 403; rol incorrecto = 403', async () => {
    const sid = await mkSession(tA, p1, 'in_progress'); const path = `/api/sessions/therapist/${sid}/notes`;
    const long = await http(tA, 'POST', path, { content: 'x'.repeat(20001) });
    assert.equal(long.status, 400); assert.equal(long.body.code, 'too_long');
    assert.equal((await http(tA, 'POST', path, { content: 'x'.repeat(20000) })).status, 201, '20.000 exactos caben');
    assert.equal((await http(tA, 'POST', path, { content: 'a', requestId: 'corto' })).body.code, 'invalid_request_id');
    assert.equal((await http(tA, 'POST', path, { content: 'a', version: -1 })).body.code, 'invalid_version');
    assert.equal((await http(tA, 'POST', path, { content: 'a', version: 1.5 })).body.code, 'invalid_version');
    assert.equal((await http(tB, 'POST', path, { content: 'a' })).status, 404);
    assert.equal((await http(p1, 'POST', path, { content: 'a' })).status, 403);
    const scheduled = await mkSession(tA, p1, 'scheduled');
    assert.equal((await http(tA, 'POST', `/api/sessions/therapist/${scheduled}/notes`, { content: 'a' })).status, 400);
    const noConsent = await mkSession(tA, p2, 'in_progress');
    assert.equal((await http(tA, 'POST', `/api/sessions/therapist/${noConsent}/notes`, { content: 'a' })).status, 403);
    assert.equal((await q('SELECT count(*)::int AS n FROM "SessionNotes" WHERE "sessionId"=$1', [noConsent]))[0].n, 0);
  });

  await t.test('cierre simultáneo (5 solicitudes): UN solo cierre, el resto 409 already_closed y UNA sola recomendación a la persona', async () => {
    const sid = await mkSession(tA, p1, 'in_progress'); provider.calls = 0;
    const all = await Promise.all(Array.from({ length: 5 }, () => http(tA, 'POST', `/api/sessions/therapist/${sid}/end`, { therapistNote: 'Nota de cierre sintética válida.', patientMoodAfter: 4 })));
    assert.deepEqual(all.map((r) => r.status).sort(), [200, 409, 409, 409, 409], JSON.stringify(all.map((r) => r.body && (r.body.code || r.body.message))));
    assert.ok(all.filter((r) => r.status === 409).every((r) => r.body.code === 'already_closed' && r.body.endedAt));
    assert.equal(provider.calls, 1, 'una sola llamada al proveedor de IA');
    assert.equal((await q(`SELECT count(*)::int AS n FROM "WellnessRecommendations" WHERE "UserId"=$1`, [p1.id]))[0].n, 1);
    const afterwards = await http(tA, 'POST', `/api/sessions/therapist/${sid}/end`, { therapistNote: 'Nota de cierre sintética válida.', patientMoodAfter: 4 });
    assert.equal(afterwards.status, 409);
    assert.deepEqual([(await row(sid)).status, (await row(sid)).patientMoodAfter], ['completed', 4]);
  });

  await t.test('cierre: nota > 4.000 = 400 too_long; ánimo decimal o fuera de 1–5 = 400; nota < 10 = 400; ajena = 404; rol incorrecto = 403; la sesión no cambia', async () => {
    const sid = await mkSession(tA, p1, 'in_progress'); const path = `/api/sessions/therapist/${sid}/end`;
    const long = await http(tA, 'POST', path, { therapistNote: 'x'.repeat(4001), patientMoodAfter: 3 });
    assert.equal(long.status, 400); assert.equal(long.body.code, 'too_long');
    assert.equal((await http(tA, 'POST', path, { therapistNote: 'Nota válida de cierre.', patientMoodAfter: 3.5 })).status, 400);
    assert.equal((await http(tA, 'POST', path, { therapistNote: 'Nota válida de cierre.', patientMoodAfter: 6 })).status, 400);
    assert.equal((await http(tA, 'POST', path, { therapistNote: 'corta', patientMoodAfter: 3 })).status, 400);
    assert.equal((await http(tB, 'POST', path, { therapistNote: 'Nota válida de cierre.', patientMoodAfter: 3 })).status, 404);
    assert.equal((await http(p1, 'POST', path, { therapistNote: 'Nota válida de cierre.', patientMoodAfter: 3 })).status, 403);
    assert.equal((await row(sid)).status, 'in_progress');
    assert.equal((await http(tA, 'POST', path, { therapistNote: 'x'.repeat(4000), patientMoodAfter: 3 })).status, 200, '4.000 exactos caben');
  });

  await t.test('la persona no puede leer las notas de la sesión (ninguna ruta de persona las devuelve)', async () => {
    const sid = await mkSession(tA, p1, 'in_progress');
    await http(tA, 'POST', `/api/sessions/therapist/${sid}/notes`, { content: 'Texto reservado al profesional' });
    for (const route of [`/api/sessions/therapist/${sid}/notes`, '/api/sessions/user', '/api/sessions/user/upcoming']) {
      const r = await http(p1, 'GET', route);
      assert.doesNotMatch(JSON.stringify(r.body), /Texto reservado/, route);
    }
  });
});
