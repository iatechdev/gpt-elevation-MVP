// ES-257 contra PostgreSQL REAL: GET /api/user/progress promedia solo los valores VÁLIDOS (1-5). Una calificación nula no cuenta como 0 ni entra en el divisor
// (4 + NULL -> 4, no 2), solo nulas -> null, sin datos -> null, bordes 1 y 5, ánimo con entrada o salida nulas, valores fuera de escala ignorados y sin cruce entre personas.
// Usa la ruta REAL (routes/progress.js) y los modelos reales; solo el middleware de sesión se sustituye por uno que fija req.user.
// Crea y borra SOLO su propia base aleatoria en loopback. Nunca carga .env ni llama a un proveedor externo.
// Uso (en backend/):  node scripts/testEs257Local.cjs   (o  ES257_TEST_DATABASE_URL=postgres://... node --test test/integration/es-257-postgres.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-257 PostgreSQL: los promedios de /api/user/progress usan solo valores válidos', { timeout: 120000 }, async (t) => {
  const source = process.env.ES257_TEST_DATABASE_URL;
  assert.ok(source, 'ES257_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es257_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es257_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 6, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  for (const name of ['PricingPlan', 'User', 'MoodLog', 'SessionRating', 'WellnessRecommendation']) require('../../' + name);
  await sequelize.sync();
  const User = require('../../User'); const MoodLog = require('../../MoodLog'); const SessionRating = require('../../SessionRating');

  const express = require('express');
  const app = express();
  app.use((req, _res, next) => { req.user = { id: Number(req.headers['x-test-user']) }; next(); });
  app.use('/api/user', require('../../routes/progress'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const progress = async (user) => { const response = await fetch(`${base}/api/user/progress`, { headers: { 'x-test-user': String(user.id) } }); assert.equal(response.status, 200); return response.json(); };
  const person = (n) => User.create({ name: `Persona ${n}`, email: `p${n}-${randomBytes(4).toString('hex')}@example.invalid`, password: 'x', role: 'user' });
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
  const rate = (user, n, rating, options) => SessionRating.create({ UserId: user.id, date: day(n), rating }, options);
  const logMood = (user, n, checkin_mood, checkout_mood) => MoodLog.create({ UserId: user.id, date: day(n), checkin_mood, checkout_mood });

  await t.test('4 + NULL -> 4 (antes 2); la lista conserva la fila nula y la pantalla la filtra', async () => {
    const user = await person(1);
    await rate(user, 0, 4); await rate(user, 1, null);
    const body = await progress(user);
    assert.equal(body.stats.avgRating, 4);
    assert.equal(body.ratings.length, 2);
  });
  await t.test('solo NULL -> null; sin datos -> null y racha 0', async () => {
    const onlyNull = await person(2); await rate(onlyNull, 0, null); await rate(onlyNull, 1, null);
    assert.equal((await progress(onlyNull)).stats.avgRating, null);
    const empty = await person(3);
    const body = await progress(empty);
    assert.equal(body.stats.avgRating, null); assert.equal(body.stats.avgMood, null); assert.equal(body.stats.totalSessions, 0); assert.equal(body.stats.streak, 0);
    assert.deepEqual(body.ratings, []); assert.deepEqual(body.moodLogs, []);
  });
  await t.test('bordes 1 y 5, un decimal, y valores fuera de escala ignorados', async () => {
    const edges = await person(4); await rate(edges, 0, 1); await rate(edges, 1, 5);
    assert.equal((await progress(edges)).stats.avgRating, 3);
    const low = await person(5); await rate(low, 0, 1); assert.equal((await progress(low)).stats.avgRating, 1);
    const high = await person(6); await rate(high, 0, 5); assert.equal((await progress(high)).stats.avgRating, 5);
    const rounded = await person(7); await rate(rounded, 0, 4); await rate(rounded, 1, 4); await rate(rounded, 2, 5);
    assert.equal((await progress(rounded)).stats.avgRating, 4.3);
    const outOfScale = await person(8); await rate(outOfScale, 0, 3); await rate(outOfScale, 1, 9, { validate: false }); await rate(outOfScale, 2, 0, { validate: false });
    assert.equal((await progress(outOfScale)).stats.avgRating, 3);
  });
  await t.test('ánimo: entrada o salida nulas no cuentan como 0; ambos nulos -> null', async () => {
    const user = await person(9); await logMood(user, 0, 2, null); await logMood(user, 1, null, 4); await logMood(user, 2, 3, 3);
    const body = await progress(user);
    assert.equal(body.stats.avgMood, 3); // (2+4+3+3)/4
    assert.equal(body.stats.totalSessions, 3);
    const none = await person(10); await logMood(none, 0, null, null);
    assert.equal((await progress(none)).stats.avgMood, null);
  });
  await t.test('sin cruce entre personas: cada una ve solo sus filas', async () => {
    const a = await person(11); const b = await person(12);
    await rate(a, 0, 5); await rate(b, 0, 1); await logMood(a, 0, 5, 5); await logMood(b, 0, 1, 1);
    const seenByA = await progress(a); const seenByB = await progress(b);
    assert.equal(seenByA.stats.avgRating, 5); assert.equal(seenByA.stats.avgMood, 5); assert.equal(seenByA.ratings.length, 1);
    assert.equal(seenByB.stats.avgRating, 1); assert.equal(seenByB.stats.avgMood, 1);
  });
});
