// ES-341 (E323-1) · GET /api/admin/usuarios sin N+1: mismo resultado que la implementación anterior, número de consultas FIJO y guardas de rol intactas.
// HTTP REAL, JWT real, PostgreSQL REAL (migraciones reales, incluida la del índice por UserId). Datos SINTÉTICOS (@example.test).
//   ES341_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54367/postgres node --test test/integration/es-341-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

const backend = path.resolve(__dirname, '..', '..');

test('ES-341 PostgreSQL + HTTP: lista de usuarios con agregados por lote, idéntica a la implementación anterior y con consultas fijas', { timeout: 240000 }, async (t) => {
  assert.ok(process.env.ES341_TEST_DATABASE_URL, 'Se requiere ES341_TEST_DATABASE_URL (clúster desechable en loopback)');
  const target = new URL(process.env.ES341_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo loopback');
  const dbName = `es341_test_${crypto.randomBytes(8).toString('hex')}`;
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

  const queries = { on: false, list: [] };
  app = new Sequelize(urlFor(dbName), { logging: (sql) => { if (queries.on) queries.list.push(sql); }, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  process.env.NODE_ENV = 'test';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize: app } };
  require('../../associations')();
  const MoodLog = require('../../MoodLog');
  const SessionRating = require('../../SessionRating');
  const { averageOf } = require('../../utils/minAverageSample');
  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const express = require('express');
  const api = express(); api.use(express.json());
  api.use('/api/admin/usuarios', verificarAdmin, require('../../routes/adminUsers'));
  server = api.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  db = new Client({ connectionString: urlFor(dbName), ssl: false }); await db.connect();
  const q = async (text, params) => (await db.query(text, params)).rows;

  // Índice de la migración: existe, y correr la migración otra vez no falla (idempotente).
  const indexRows = () => q("SELECT 1 FROM pg_indexes WHERE tablename = 'SessionRatings' AND indexname = 'session_ratings__user_id'");
  assert.equal((await indexRows()).length, 1);
  await require('../../migrations/20261119010000-es341-session-ratings-userid-index.cjs').up(app);
  assert.equal((await indexRows()).length, 1);

  const columns = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users'
    AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0;
  async function mkUser(role) {
    seq += 1; const names = []; const values = [];
    for (const c of columns) {
      let v;
      if (c.column_name === 'role') v = role;
      else if (c.column_name === 'name') v = `Sintético ${seq}`;
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? `es341-${seq}-${dbName}@example.test` : `sintetico-${seq}-${c.column_name}`;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push(`"${c.column_name}"`); values.push(v);
    }
    const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, values))[0].id;
    await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]);
    return { id, role, token: issueToken({ id, role }) };
  }
  // pairs: [check-in, check-out] (null y 0 permitidos); una fila por día distinto (hay un índice único UserId+date).
  const addMoods = async (userId, pairs) => {
    for (let i = 0; i < pairs.length; i += 1) {
      await q('INSERT INTO "MoodLogs" ("UserId","date","checkin_mood","checkout_mood","createdAt","updatedAt") VALUES ($1, DATE \'2026-01-01\' + $2::int, $3, $4, now(), now())', [userId, i, pairs[i][0], pairs[i][1]]);
    }
  };
  const addRatings = async (userId, ratings) => {
    for (let i = 0; i < ratings.length; i += 1) await q('INSERT INTO "SessionRatings" ("UserId","date","rating","createdAt","updatedAt") VALUES ($1, DATE \'2026-01-01\' + $2::int, $3, now(), now())', [userId, i, ratings[i]]);
  };
  const http = async (who, route) => {
    const res = await fetch(`${base}${route}`, { headers: who ? { Authorization: `Bearer ${who.token}` } : {} });
    const text = await res.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
    return { status: res.status, body };
  };
  // Implementación ANTERIOR (3 consultas por cuenta), copiada tal cual como oráculo de equivalencia.
  const oracle = async (id) => {
    const sesiones = await MoodLog.count({ where: { UserId: id } });
    const ratings = await SessionRating.findAll({ where: { UserId: id }, attributes: ['rating'] });
    const moodLogs = await MoodLog.findAll({ where: { UserId: id }, attributes: ['checkin_mood', 'checkout_mood'] });
    return { sesiones, ratingPromedio: averageOf(ratings.map((r) => r.rating)), moodPromedio: averageOf(moodLogs.flatMap((m) => [m.checkin_mood, m.checkout_mood]).filter(Boolean)) };
  };

  const adm = await mkUser('admin');
  // Casos límite a mano: nada, 4 / 5 / 6 entradas (umbral del mínimo de 5), ceros y nulos en los ánimos, calificaciones NULL (cuentan y suman 0, comportamiento histórico).
  const hand = {};
  hand.vacia = await mkUser('user');
  hand.cuatroRatings = await mkUser('user'); await addRatings(hand.cuatroRatings.id, [5, 4, 3, 2]);
  hand.cincoRatings = await mkUser('user'); await addRatings(hand.cincoRatings.id, [5, 4, 3, 2, 2]);
  hand.seisRatings = await mkUser('user'); await addRatings(hand.seisRatings.id, [5, 4, 3, 2, 2, 1]);
  hand.ratingNulo = await mkUser('user'); await addRatings(hand.ratingNulo.id, [5, 5, 5, 5, null]);
  hand.moodsMixtos = await mkUser('user'); await addMoods(hand.moodsMixtos.id, [[3, 4], [0, 2], [null, 5], [1, null], [4, 0]]);
  hand.moodsCuatro = await mkUser('user'); await addMoods(hand.moodsCuatro.id, [[3, 4], [2, 2], [5, 5], [1, null]]);
  hand.solo2Filas = await mkUser('user'); await addMoods(hand.solo2Filas.id, [[1, 2], [3, 4]]);
  hand.redondeo = await mkUser('user'); await addMoods(hand.redondeo.id, [[1, 2], [2, 2], [3, 3], [4, 1], [5, 1]]); await addRatings(hand.redondeo.id, [1, 2, 2, 3, 3, 3, 4]);
  // Cuentas con datos propios (pseudoaleatorios y repetibles) para que el agrupado no mezcle personas.
  let rng = 341; const rand = (n) => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng % n; };
  const bulk = [];
  const pickMood = () => [null, 0, 1, 2, 3, 4, 5][rand(7)];
  const mkBulk = async (n) => {
    for (let i = 0; i < n; i += 1) {
      const u = await mkUser(i % 7 === 0 ? 'therapist' : 'user');
      await addMoods(u.id, Array.from({ length: rand(9) }, () => [pickMood(), pickMood()]));
      await addRatings(u.id, Array.from({ length: rand(9) }, () => [null, 1, 2, 3, 4, 5][rand(6)]));
      bulk.push(u);
    }
  };
  await mkBulk(10);

  const list = async () => {
    queries.list = []; queries.on = true;
    const r = await http(adm, '/api/admin/usuarios');
    queries.on = false;
    return { ...r, count: queries.list.filter((s) => /SELECT/.test(s)).length };
  };
  const small = await list();
  assert.equal(small.status, 200);
  const countSmall = small.count;
  assert.ok(countSmall <= 8, `consultas con ~20 cuentas: ${countSmall}`); // 4 de la lista (usuarios+plan, solicitudes de eliminación, 2 agregados) + las de la guarda de sesión; con la implementación anterior eran 3N+3 (más de 60 con 20 cuentas)

  await mkBulk(190);
  const big = await list();
  assert.equal(big.status, 200);
  assert.equal(big.count, countSmall, `el número de consultas debe ser fijo: ${countSmall} con pocas cuentas y ${big.count} con ${big.body.length}`);
  assert.ok(big.body.length >= 200);

  // Equivalencia con la implementación anterior, cuenta por cuenta (casos a mano y las aleatorias).
  const byId = new Map(big.body.map((u) => [u.id, u]));
  for (const u of [...Object.values(hand), ...bulk]) {
    const got = byId.get(u.id); const want = await oracle(u.id);
    assert.deepEqual({ sesiones: got.sesiones, ratingPromedio: got.ratingPromedio, moodPromedio: got.moodPromedio }, want, `cuenta ${u.id}`);
  }
  // Casos con valor conocido (umbral de 5 y NULL que cuenta y suma 0: 20/5 = 4).
  assert.equal(byId.get(hand.vacia.id).ratingPromedio, null);
  assert.equal(byId.get(hand.cuatroRatings.id).ratingPromedio, null);
  assert.equal(byId.get(hand.cincoRatings.id).ratingPromedio, 3.2);
  assert.equal(byId.get(hand.ratingNulo.id).ratingPromedio, 4);
  assert.equal(byId.get(hand.solo2Filas.id).moodPromedio, null);
  assert.equal(byId.get(hand.vacia.id).sesiones, 0);
  // ES-355 (E367-1): `deletionRequested` es true SOLO para la cuenta con solicitud de eliminación y false (booleano) para las demás; si la lista lo pierde, esto falla.
  await q("INSERT INTO \"DeletionRequests\" (\"id\",\"UserId\",\"status\",\"attempts\",\"createdAt\",\"updatedAt\") VALUES (gen_random_uuid(), $1, 'accepted', 0, now(), now())", [hand.cincoRatings.id]);
  const withRequest = (await http(adm, '/api/admin/usuarios')).body;
  assert.ok(withRequest.every((u) => typeof u.deletionRequested === 'boolean'), 'deletionRequested debe ser booleano en todas las cuentas');
  assert.deepEqual(withRequest.filter((u) => u.deletionRequested).map((u) => u.id), [hand.cincoRatings.id]);

  // Forma del contrato: mismos campos y mismo orden de cuentas (createdAt descendente).
  assert.deepEqual(Object.keys(big.body[0]).sort(), ['active', 'createdAt', 'deletionRequested', 'email', 'id', 'isLocked', 'lockedUntil', 'loginAttempts', 'moodPromedio', 'name', 'plan', 'ratingPromedio', 'role', 'sesiones', 'therapistId']);
  const stamps = big.body.map((u) => Date.parse(u.createdAt));
  assert.ok(stamps.every((v, i) => i === 0 || stamps[i - 1] >= v));
  // Filtros existentes intactos.
  const onlyTherapists = await http(adm, '/api/admin/usuarios?role=therapist');
  assert.ok(onlyTherapists.body.length > 0 && onlyTherapists.body.every((u) => u.role === 'therapist'));

  // ES-355 (E367-2): therapistId válido filtra; hostil o mal formado = 400 estable (invalid_id, texto ES/EN), nunca 500.
  const pro = bulk.find((u) => u.role === 'therapist');
  await q('UPDATE "Users" SET "therapistId"=$2 WHERE id=$1', [hand.vacia.id, pro.id]);
  const mine = await http(adm, `/api/admin/usuarios?therapistId=${pro.id}`);
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.map((u) => u.id), [hand.vacia.id]);
  for (const bad of ["'%20OR%201=1", "1%20OR%201=1", 'abc', '0', '-1', '1.5', '99999999999', '2147483648', '', '1&therapistId=2', '%00']) {
    const r = await http(adm, `/api/admin/usuarios?therapistId=${bad}`);
    assert.equal(r.status, 400, `therapistId=${bad}`);
    assert.equal(r.body.code, 'invalid_id');
    assert.equal(r.body.error, "Identificador inválido. / Invalid identifier.");
  }
  assert.equal((await http(adm, '/api/admin/usuarios?therapistId=2147483647')).status, 200); // el máximo int32 es válido (lista vacía)

  // Guardas de rol: sin sesión 401 (ES-332; antes 403), personas y profesionales 403; nunca la lista.
  assert.equal((await http(null, '/api/admin/usuarios')).status, 401);
  for (const who of [hand.vacia, bulk.find((u) => u.role === 'therapist')]) {
    const r = await http(who, '/api/admin/usuarios');
    assert.equal(r.status, 403); assert.ok(!Array.isArray(r.body));
  }
});
