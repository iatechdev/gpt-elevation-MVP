// ES-273 contra Postgres REAL: GET /api/rating/avg calcula el promedio EN SQL solo con valoraciones válidas (1-5, no nulas), `total` = valoraciones válidas, y aplica el mínimo de 5
// (QA-18-02, utils/minAverageSample.js) para no revelar el promedio de una sola persona. Sin datos o por debajo del mínimo: avg null (nunca 0). Rutas REALES; datos sintéticos.
// Crea y borra SOLO su base aleatoria en loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES273_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:rating-avg:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-273 PostgreSQL: /api/rating/avg con valoraciones válidas, mínimo de 5 y roles', { timeout: 120000 }, async (t) => {
  const source = process.env.ES273_TEST_DATABASE_URL;
  assert.ok(source, 'ES273_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es273_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es273_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  const SessionRating = require('../../SessionRating');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken, SessionRating].map((model) => model.sync()));
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api', verificarToken, require('../../routes/ratings'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const person = (role, name) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role });
  const [adm, sup, plain, pro] = [await person('admin', 'Adm'), await person('superadmin', 'Sup'), await person('user', 'Persona'), await person('therapist', 'Pro')];
  const call = async (p, method = 'GET', path = '/api/rating/avg') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { ...(p ? { Authorization: `Bearer ${issueToken(p)}` } : {}) } });
    const text = await response.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { status: response.status, body, text };
  };
  const set = async (values) => {
    await sequelize.query('DELETE FROM "SessionRatings"');
    for (const [i, value] of values.entries()) await sequelize.query('INSERT INTO "SessionRatings" ("UserId","rating","date","createdAt","updatedAt") VALUES ($1,$2,CURRENT_DATE,now(),now())', { bind: [plain.id + i, value] });
  };

  await t.test('0, 1, 4, 5 y 6 valoraciones: avg null por debajo de 5 (nunca 0 ni el valor de una persona) y promedio desde 5; total = válidas', async () => {
    const SCALE = [2, 5, 4, 1, 3, 5];
    for (const n of [0, 1, 4, 5, 6]) {
      await set(SCALE.slice(0, n));
      const r = await call(adm);
      assert.equal(r.status, 200);
      const expected = n >= 5 ? Math.round((SCALE.slice(0, n).reduce((a, b) => a + b, 0) / n) * 10) / 10 : null;
      assert.deepEqual(r.body, { avg: expected, total: n }, `${n} valoraciones`);
      if (n < 5) assert.notEqual(r.body.avg, 0);
    }
  });

  await t.test('las nulas y las fuera de escala no cuentan ni para el promedio ni para el total ni para el mínimo', async () => {
    await set([4, null, 4, null, 4, 4, 4]); // [4,NULL,4,NULL,…]: cinco válidas de valor 4 → 4 (una nula nunca cuenta como 0)
    assert.deepEqual((await call(adm)).body, { avg: 4, total: 5 });
    await set([null, null, null, null, null]);
    assert.deepEqual((await call(adm)).body, { avg: null, total: 0 });
    await sequelize.query('DELETE FROM "SessionRatings"');
    for (const [i, value] of [1, 5, 3, 30000, 0, -2, 6].entries()) await sequelize.query('INSERT INTO "SessionRatings" ("UserId","rating","date","createdAt","updatedAt") VALUES ($1,$2,CURRENT_DATE,now(),now())', { bind: [plain.id + i, value] });
    assert.deepEqual((await call(adm)).body, { avg: null, total: 3 }, 'solo 3 válidas (1, 5, 3): por debajo del mínimo aunque haya 7 filas');
    await set([1, 5, 3, 3, 3, 30000, 0]);
    assert.deepEqual((await call(adm)).body, { avg: 3, total: 5 }, '1, 5, 3, 3, 3 → 3; 30000 y 0 no cuentan');
  });

  await t.test('roles sin cambios: sin sesión 401/403, persona y profesional 403 sin cifras; admin y superadmin 200', async () => {
    await set([1, 2, 3, 4, 5]);
    assert.ok([401, 403].includes((await call(null)).status));
    for (const who of [plain, pro]) { const r = await call(who); assert.equal(r.status, 403, who.role); assert.ok(!r.text.includes('"avg"')); }
    for (const who of [adm, sup]) assert.equal((await call(who)).status, 200);
  });
});
