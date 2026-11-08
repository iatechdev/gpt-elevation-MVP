// ES-211 contra Postgres REAL: reactivar la versión ya activa la deja activa, y siempre queda exactamente 1 versión activa,
// también con envíos dobles concurrentes (activar+activar, activar+subir). La autorización se prueba aparte (p1-3, es-207): aquí
// el guardián del router se sustituye por uno que deja pasar. Crea y borra SOLO su propia base aleatoria en loopback.
// Uso (en backend/):  ES211_TEST_DATABASE_URL=postgres://... npm run test:manifest:pg   (o  node scripts/testEs211Local.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-211 PostgreSQL: activar es idempotente y atómico; nunca 0 ni 2 versiones activas', { timeout: 120000 }, async (t) => {
  const source = process.env.ES211_TEST_DATABASE_URL;
  assert.ok(source, 'ES211_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es211_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es211_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 10, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const authModule = require.resolve('../../middlewares/auth');
  const pass = (req, _res, next) => { req.user = { id: 1, role: 'admin' }; next(); };
  require.cache[authModule] = { id: authModule, filename: authModule, loaded: true, exports: { verificarEditorManifiesto: pass } };

  const EthicManifest = require('../../EthicManifest');
  await EthicManifest.sync();
  const router = require('../../routes/board');
  const app = express(); app.use(express.json()); app.use('/api/manifest', router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/manifest`;
  const call = (method, path, body) => fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const body = label => ({ content: `Synthetic manifest ${label}. `.repeat(4) + 'No personal data.' });
  const state = async () => (await EthicManifest.findAll({ order: [['id', 'ASC']] })).map(m => ({ id: m.id, v: m.version, active: m.isActive }));
  const activeCount = async () => (await state()).filter(m => m.active).length;

  for (const label of ['uno', 'dos', 'tres']) assert.equal((await call('POST', '/manifest', body(label))).status, 201);
  let rows = await state();
  assert.deepEqual(rows.map(r => r.active), [false, false, true], 'subir deja solo la última activa');
  const [first, second, third] = rows.map(r => r.id);

  // 1) La versión ya activa: reactivarla la deja activa (antes quedaban 0).
  assert.equal((await call('PUT', `/manifest/${third}/activate`)).status, 200);
  assert.deepEqual((await state()).map(r => r.active), [false, false, true]);
  const pub = await (await call('GET', '/active')).json();
  assert.equal(pub.version, rows[2].v, 'el manifiesto público no queda vacío');

  // 2) Activar otra anterior mueve la activa; id inexistente = 404 sin tocar nada.
  assert.equal((await call('PUT', `/manifest/${first}/activate`)).status, 200);
  assert.deepEqual((await state()).map(r => r.active), [true, false, false]);
  assert.equal((await call('PUT', '/manifest/999999/activate')).status, 404);
  assert.deepEqual((await state()).map(r => r.active), [true, false, false]);

  // 3) Doble envío concurrente de lo mismo: exactamente 1 activa, en cada repetición.
  for (let i = 0; i < 15; i++) {
    const statuses = (await Promise.all(Array.from({ length: 6 }, () => call('PUT', `/manifest/${second}/activate`)))).map(r => r.status);
    assert.deepEqual([...new Set(statuses)], [200]);
    assert.equal(await activeCount(), 1, `activar×6, vuelta ${i}`);
    assert.equal((await state()).find(r => r.id === second).active, true);
    await call('PUT', `/manifest/${first}/activate`);
  }

  // 4) Activaciones cruzadas concurrentes (A y B a la vez): siempre exactamente 1 activa.
  for (let i = 0; i < 15; i++) {
    await Promise.all([call('PUT', `/manifest/${first}/activate`), call('PUT', `/manifest/${second}/activate`), call('PUT', `/manifest/${third}/activate`)]);
    assert.equal(await activeCount(), 1, `cruzadas, vuelta ${i}`);
  }

  // 5) Subir una versión y reactivar otra a la vez: 1 activa y números de versión únicos.
  for (let i = 0; i < 8; i++) {
    const [up] = await Promise.all([call('POST', '/manifest', body(`carrera ${i}`)), call('PUT', `/manifest/${first}/activate`), call('PUT', `/manifest/${second}/activate`)]);
    assert.equal(up.status, 201);
    assert.equal(await activeCount(), 1, `subir+activar, vuelta ${i}`);
  }
  rows = await state();
  assert.equal(new Set(rows.map(r => r.v)).size, rows.length, 'números de versión únicos');
});
