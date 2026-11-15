// ES-178 (HU-P27) · Notas de seguimiento por HTTP REAL, JWT real y PostgreSQL REAL (migraciones reales con sequelize-cli).
// Edición concurrente (409 note_changed con la versión vigente), máximo de longitud, texto vacío rechazado, A/B entre profesionales y acceso solo con autorización.
//   ES178_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-179-postgres.cjs
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

test('ES-178 PostgreSQL + HTTP: notas de seguimiento con control de edición concurrente, máximo y texto obligatorio', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES178_TEST_DATABASE_URL, 'Se requiere ES178_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES178_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es178_test_${crypto.randomBytes(8).toString('hex')}`;
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
  const { verificarToken, verificarTerapeuta } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/consents', verificarToken, require('../../routes/consents'));
  api.use('/api/therapist', verificarTerapeuta, require('../../routes/therapistRoutes'));
  api.use('/api/sessions', verificarToken, require('../../routes/sessions')); // ES-178 F2: agendar
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
  const today = new Date().toISOString().slice(0, 10);
  const create = (who, person, content = 'Observación sintética', extra = {}) => http(who, 'POST', `/api/therapist/pacientes/${person.id}/notas`, { content, sessionDate: today, type: 'observation', ...extra });
  const original = await create(tA, p1, 'Texto original');
  assert.equal(original.status, 201);
  const noteId = original.body.note.id;
  const put = (who, body, id = noteId) => http(who, 'PUT', `/api/therapist/notas/${id}`, body);

  await t.test('crear: máximo 10.000 (10.001 = 400 too_long), texto vacío = 400, otro profesional o persona sin autorización no crea nada', async () => {
    const long = await create(tA, p1, 'x'.repeat(10001));
    assert.equal(long.status, 400); assert.equal(long.body.code, 'too_long');
    assert.equal((await create(tA, p1, 'x'.repeat(10000))).status, 201, '10.000 exactos caben');
    assert.equal((await create(tA, p1, '   ')).status, 400);
    assert.equal((await create(tB, p1)).status, 404, 'persona de otro profesional');
    assert.equal((await create(tA, p2)).status, 403, 'persona que no autorizó');
    assert.equal((await q('SELECT count(*)::int AS n FROM "ClinicalNotes" WHERE "UserId"=$1', [p2.id]))[0].n, 0);
  });

  await t.test('editar: texto vacío = 400 content_required (antes se ignoraba en silencio); más de 10.000 = 400; la nota no cambia', async () => {
    const empty = await put(tA, { content: '' });
    assert.equal(empty.status, 400); assert.equal(empty.body.code, 'content_required');
    assert.equal((await put(tA, { content: '   ' })).status, 400);
    assert.equal((await put(tA, { content: 'y'.repeat(10001) })).body.code, 'too_long');
    assert.equal((await put(tA, { type: 'otro' })).body.code, 'invalid_type');
    assert.equal((await put(tA, { content: 'Texto', expectedUpdatedAt: 'no-es-fecha' })).body.code, 'invalid_expected');
    const history = (await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).body.notes.find((n) => n.id === noteId);
    assert.equal(history.content, 'Texto original');
  });

  await t.test('edición concurrente: la segunda edición con la versión vieja = 409 note_changed con la versión vigente; con la nueva = 200', async () => {
    const loaded = (await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).body.notes.find((n) => n.id === noteId);
    const first = await put(tA, { content: 'Primera edición', expectedUpdatedAt: loaded.updatedAt });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const stale = await put(tA, { content: 'Edición desde una pestaña vieja', expectedUpdatedAt: loaded.updatedAt });
    assert.equal(stale.status, 409); assert.equal(stale.body.code, 'note_changed'); assert.equal(stale.body.current.content, 'Primera edición');
    const stored = (await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).body.notes.find((n) => n.id === noteId);
    assert.equal(stored.content, 'Primera edición', 'la edición vieja NO pisó a la nueva');
    const fresh = await put(tA, { content: 'Segunda edición', expectedUpdatedAt: first.body.note.updatedAt });
    assert.equal(fresh.status, 200);
  });

  await t.test('6 ediciones simultáneas con la MISMA versión: exactamente una gana y las demás reciben 409', async () => {
    const note = (await create(tA, p1, 'Base concurrente')).body.note;
    const all = await Promise.all(Array.from({ length: 6 }, (_, i) => put(tA, { content: `Edición ${i}`, expectedUpdatedAt: note.updatedAt }, note.id)));
    assert.deepEqual(all.map((r) => r.status).sort(), [200, 409, 409, 409, 409, 409], JSON.stringify(all.map((r) => r.status)));
  });

  await t.test('sin expectedUpdatedAt (cliente anterior) gana el último, como antes; otro profesional = 404; persona sin autorización o rol incorrecto = 403/404 y la nota no cambia', async () => {
    const legacy = await put(tA, { content: 'Edición de cliente anterior' });
    assert.equal(legacy.status, 200);
    assert.equal((await put(tB, { content: 'Intruso' })).status, 404);
    assert.equal((await put(p1, { content: 'Persona' })).status, 403);
    await q(`UPDATE "Consents" SET status='revoked' WHERE "UserId"=$1 AND purpose='therapist_sharing'`, [p1.id]);
    const revoked = await put(tA, { content: 'Tras revocar' });
    assert.equal(revoked.status, 403, 'revocación: no se edita');
    await q(`UPDATE "Consents" SET status='granted' WHERE "UserId"=$1 AND purpose='therapist_sharing'`, [p1.id]);
    const stored = (await http(tA, 'GET', `/api/therapist/pacientes/${p1.id}/historia`)).body.notes.find((n) => n.id === noteId);
    assert.equal(stored.content, 'Edición de cliente anterior');
  });

  await t.test('XSS: el texto con marcado se guarda y se devuelve como texto (la pantalla lo escapa)', async () => {
    const xss = await create(tA, p1, '<script>alert(1)</script><img src=x onerror=alert(2)>');
    assert.equal(xss.status, 201); assert.equal(xss.body.note.content, '<script>alert(1)</script><img src=x onerror=alert(2)>');
  });

  // ES-178 F2: los 400 de agendar traen `code` y `field` (la pantalla marca el campo); el texto de siempre se conserva.
  await t.test('agendar: errores por campo con code/field; choque 409; sin vínculo o sin autorización 403; creada 201', async () => {
    const soon = (min) => new Date(Date.now() + min * 60000).toISOString();
    const post = (who, body) => http(who, 'POST', '/api/sessions/therapist', body);
    assert.equal((await http(p1, 'PUT', '/api/consents/therapist_sharing', { status: 'granted' })).status, 200);
    const past = await post(tA, { patientId: p1.id, scheduledAt: soon(-60), duration: 50 });
    assert.deepEqual([past.status, past.body.code, past.body.field], [400, 'scheduled_in_past', 'scheduledAt']);
    assert.match(past.body.error, /future/, 'el texto de siempre se conserva');
    for (const duration of [5, 500]) {
      const bad = await post(tA, { patientId: p1.id, scheduledAt: soon(600), duration });
      assert.deepEqual([bad.status, bad.body.code, bad.body.field], [400, 'duration_invalid', 'duration'], String(duration));
    }
    const noDate = await post(tA, { patientId: p1.id, scheduledAt: 'no-es-fecha', duration: 50 });
    assert.deepEqual([noDate.status, noDate.body.code, noDate.body.field], [400, 'scheduled_invalid', 'scheduledAt']); // ES-262: una fecha que no se puede leer tiene su propio código (el campo sigue siendo scheduledAt)
    const noPerson = await post(tA, { patientId: 'abc', scheduledAt: soon(600), duration: 50 });
    assert.deepEqual([noPerson.status, noPerson.body.code, noPerson.body.field], [400, 'invalid_input', 'patientId']);
    assert.doesNotMatch(JSON.stringify(noDate.body), /no-es-fecha/, 'no repite lo recibido');
    const ok = await post(tA, { patientId: p1.id, scheduledAt: soon(1000), duration: 50 });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
    const clash = await post(tA, { patientId: p1.id, scheduledAt: soon(1010), duration: 50 });
    assert.deepEqual([clash.status, clash.body.code], [409, 'session_conflict']);
    assert.equal((await post(tB, { patientId: p1.id, scheduledAt: soon(2000), duration: 50 })).status, 403, 'otro profesional: sin vínculo');
    assert.equal((await post(tA, { patientId: p2.id, scheduledAt: soon(2000), duration: 50 })).status, 403, 'sin autorización de compartir');
    assert.equal((await post(p1, { patientId: p1.id, scheduledAt: soon(2000), duration: 50 })).status, 403, 'una persona no agenda');
  });
});
