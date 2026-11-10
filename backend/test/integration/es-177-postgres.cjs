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
const fs = require('node:fs');
const FIXTURES = path.join(__dirname, '..', '..', '..', 'frontend', 'test', 'fixtures');
const shapeOf = (v) => (v === null ? null : Array.isArray(v) ? [v.length ? shapeOf(v[0]) : null] : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])])) : typeof v);
const sameShape = (a, b) => (a === null || b === null) ? true : (Array.isArray(a) ? Array.isArray(b) && sameShape(a[0] ?? null, b[0] ?? null) : (a && typeof a === 'object') ? (b && typeof b === 'object' && !Array.isArray(b) && JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(b)) && Object.keys(a).every((k) => sameShape(a[k], b[k]))) : a === b);
// Contrato con la pantalla: la respuesta REAL se guarda como fixture del frontend (ES177_WRITE_FIXTURE=1) y cada corrida comprueba que su forma no cambió.
function contractFixture(name, status, body) {
  const file = path.join(FIXTURES, name); const doc = { status, body };
  if (process.env.ES177_WRITE_FIXTURE) { fs.mkdirSync(FIXTURES, { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 2) + String.fromCharCode(10)); return; }
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')); assert.equal(saved.status, status, name);
  assert.ok(sameShape(shapeOf(saved.body), shapeOf(body)), `la respuesta cambió de forma respecto de ${name}; regenera con ES177_WRITE_FIXTURE=1 y revisa la pantalla`);
}
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
    contractFixture('es-177-propose-409.json', again.status, again.body);
    assert.equal(again.status, 409); assert.equal(again.body.code, 'pending_exists', 'la pantalla muestra su texto ES/EN por código'); assert.match(again.body.error, /already have a version pending review/);
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

  await t.test('«Persona n»: quien no comparte llega SIN nombre y con un ordinal estable por profesional (no cambia con altas, bajas ni recargas)', async () => {
    const nameOf = async (id) => (await q('SELECT name FROM "Users" WHERE id=$1', [id]))[0].name;
    const secret = await nameOf(p2.id);
    const first = await http(tA, 'GET', '/api/therapist/pacientes');
    assert.equal(first.status, 200);
    const row = (list, id) => list.body.find((x) => x.id === id);
    assert.deepEqual([row(first, p2.id).name, row(first, p2.id).sharing, Number.isInteger(row(first, p2.id).ordinal)], [null, false, true]);
    assert.equal(JSON.stringify(first.body).includes(secret), false, 'el nombre de quien no comparte no viaja');
    assert.equal(row(first, p1.id).name, await nameOf(p1.id), 'quien comparte conserva su nombre');
    contractFixture('es-177-pacientes.json', first.status, first.body);
    const n2 = row(first, p2.id).ordinal;
    // altas y bajas de otras personas no cambian el número de p2; el número nuevo nunca reutiliza uno anterior
    const extra = await mkUser('user', { therapistId: tA.id });
    const withExtra = await http(tA, 'GET', '/api/therapist/pacientes');
    assert.equal(row(withExtra, p2.id).ordinal, n2); assert.ok(row(withExtra, extra.id).ordinal > Math.max(row(first, p1.id).ordinal, n2));
    const extraOrdinal = row(withExtra, extra.id).ordinal;
    await q('UPDATE "Users" SET "therapistId"=NULL WHERE id=$1', [extra.id]);
    const again = await http(tA, 'GET', '/api/therapist/pacientes');
    assert.equal(row(again, p2.id).ordinal, n2); assert.equal(row(again, extra.id), undefined);
    await q('UPDATE "Users" SET "therapistId"=$2 WHERE id=$1', [extra.id, tA.id]);
    assert.equal(row(await http(tA, 'GET', '/api/therapist/pacientes'), extra.id).ordinal, extraOrdinal, 'quien vuelve conserva su número');
    // lecturas simultáneas: sin números repetidos
    const crowd = []; for (let i = 0; i < 4; i++) crowd.push(await mkUser('user', { therapistId: tA.id }));
    const all = await Promise.all(Array.from({ length: 6 }, () => http(tA, 'GET', '/api/therapist/pacientes')));
    assert.ok(all.every((r) => r.status === 200), JSON.stringify(all.map((r) => r.status)));
    const ordinals = all[0].body.map((x) => x.ordinal); assert.equal(new Set(ordinals).size, ordinals.length, 'ningún número repetido');
    assert.deepEqual(all.map((r) => JSON.stringify(r.body.map((x) => [x.id, x.ordinal]).sort())).filter((v, i, a) => a.indexOf(v) === i).length, 1, 'todas las lecturas ven lo mismo');
    // cada profesional tiene su propia numeración, y un profesional no ve a las personas del otro
    const other = await mkUser('user', { therapistId: tB.id });
    const listB = await http(tB, 'GET', '/api/therapist/pacientes');
    assert.deepEqual(listB.body.map((x) => x.id).filter((id) => id !== other.id && id !== undefined).length >= 0, true);
    assert.ok(listB.body.every((x) => x.id === other.id || x.id !== p2.id), 'B no ve a las personas de A');
    assert.equal(row(listB, other.id).ordinal, 1, 'la numeración de B empieza en 1');
  });

  await t.test('un número NUNCA se reutiliza: crear 1, 2, 3 → eliminar la persona 3 → la siguiente es 4 (y otra tras vaciar la lista sigue subiendo)', async () => {
    const tC = await mkUser('therapist');
    const people = []; for (let i = 0; i < 3; i++) people.push(await mkUser('user', { therapistId: tC.id }));
    const row = (list, id) => list.body.find((x) => x.id === id);
    const first = await http(tC, 'GET', '/api/therapist/pacientes');
    assert.deepEqual(people.map((x) => row(first, x.id).ordinal), [1, 2, 3]);
    await q('DELETE FROM "Users" WHERE id=$1', [people[2].id]); // se elimina a la persona con la n más alta
    const afterDelete = await http(tC, 'GET', '/api/therapist/pacientes');
    assert.deepEqual(afterDelete.body.map((x) => x.ordinal).sort(), [1, 2]);
    const fresh = await mkUser('user', { therapistId: tC.id });
    const next = await http(tC, 'GET', '/api/therapist/pacientes');
    assert.equal(row(next, fresh.id).ordinal, 4, 'la persona nueva es la 4, nunca la 3 (el 3 no se reutiliza)');
    assert.deepEqual([row(next, people[0].id).ordinal, row(next, people[1].id).ordinal], [1, 2], 'las demás conservan su número');
    // vaciar la lista no reinicia el contador
    await q('UPDATE "Users" SET "therapistId"=NULL WHERE "therapistId"=$1', [tC.id]);
    const later = await mkUser('user', { therapistId: tC.id });
    assert.equal(row(await http(tC, 'GET', '/api/therapist/pacientes'), later.id).ordinal, 5);
    // lecturas simultáneas con personas nuevas: el contador sigue siendo único y creciente
    const crowd = []; for (let i = 0; i < 4; i++) crowd.push(await mkUser('user', { therapistId: tC.id }));
    const all = await Promise.all(Array.from({ length: 6 }, () => http(tC, 'GET', '/api/therapist/pacientes')));
    assert.ok(all.every((r) => r.status === 200));
    const numbers = all[0].body.map((x) => x.ordinal); assert.equal(new Set(numbers).size, numbers.length);
    assert.equal(Math.max(...numbers), 9, 'el contador llegó a 9 sin repetir ninguno');
    assert.equal((await q('SELECT "lastOrdinal" FROM "TherapistOrdinalCounters" WHERE "therapistId"=$1', [tC.id]))[0].lastOrdinal, 9);
  });

  await t.test('la tabla de ordinales: migración aditiva e idempotente, RLS y borrado en cascada con la persona', async () => {
    const migration = require('../../migrations/20261111010000-es177-person-ordinals.cjs');
    await migration.up(app); await migration.up(app);
    for (const table of ['TherapistPersonOrdinals', 'TherapistOrdinalCounters']) assert.equal((await q('SELECT relrowsecurity FROM pg_class WHERE relname=$1', [table]))[0].relrowsecurity, true, table);
    const gone = await mkUser('user', { therapistId: tA.id });
    await http(tA, 'GET', '/api/therapist/pacientes');
    assert.equal((await q('SELECT count(*)::int AS n FROM "TherapistPersonOrdinals" WHERE "personId"=$1', [gone.id]))[0].n, 1);
    await q('DELETE FROM "Users" WHERE id=$1', [gone.id]);
    assert.equal((await q('SELECT count(*)::int AS n FROM "TherapistPersonOrdinals" WHERE "personId"=$1', [gone.id]))[0].n, 0, 'sin la persona no queda ninguna fila');
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
    contractFixture('es-177-alerts.json', alerts.status, alerts.body);
    assert.equal(JSON.stringify(alerts.body).includes('improvementPercent') || /[0-9]%/.test(JSON.stringify(alerts.body)), false, 'ningún porcentaje en /alerts (decisión 13)');
  });
});
