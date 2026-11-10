// ES-187 contra Postgres REAL: control de edición concurrente por elemento del catálogo de rutas (`expectedUpdatedAt` → 409 `item_changed`).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL. Contenido SINTÉTICO.
// Uso (en backend/):  ES187_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:routecatalog-items:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const http = require('node:http');
const { Sequelize } = require('sequelize');

test('ES-187 PostgreSQL: edición concurrente del mismo elemento = una gana y el resto recibe item_changed con la versión vigente', { timeout: 90000 }, async (t) => {
  const source = process.env.ES187_TEST_DATABASE_URL;
  assert.ok(source, 'ES187_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es187_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es187_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize;
  let server;
  let created = false;
  t.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const RouteCatalog = require('../../RouteCatalog');
  const RouteCatalogItem = require('../../RouteCatalogItem');
  await sequelize.sync();
  const catalog = require('../../utils/routeCatalog');
  const { build } = require('../../seeds/routeCatalogSynthetic.cjs');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/route-catalog', require('../../routes/routeCatalogAdmin'));
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/route-catalog`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const draft = await catalog.createDraft();
  const ctx = build().contexts.ctx_educacion_formacion;
  const url = (key) => `/${draft.id}/contexts/${key}`;
  const edited = (suffix) => ({ ...ctx, labels: { es: `Contexto ${suffix}`, en: `Context ${suffix}` } });

  await t.test('crear devuelve updatedAt y la lista lo trae por elemento', async () => {
    const created = await call('PUT', url('ctx_version'), edited('uno'));
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.ok(created.body.updatedAt && !Number.isNaN(Date.parse(created.body.updatedAt)));
    const read = await call('GET', `/${draft.id}`);
    const item = read.body.items.contexts.find((i) => i.itemKey === 'ctx_version');
    assert.equal(item.updatedAt, created.body.updatedAt);
  });

  await t.test('con la versión vigente guarda; con una vieja, 409 item_changed con la versión actual y sin pisar', async () => {
    const first = (await call('GET', `/${draft.id}`)).body.items.contexts.find((i) => i.itemKey === 'ctx_version');
    const ok = await call('PUT', url('ctx_version'), { ...edited('dos'), expectedUpdatedAt: first.updatedAt });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.notEqual(ok.body.updatedAt, first.updatedAt);
    const stale = await call('PUT', url('ctx_version'), { ...edited('tres'), expectedUpdatedAt: first.updatedAt });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, 'item_changed');
    assert.equal(stale.body.current.labels.es, 'Contexto dos');
    assert.equal(stale.body.current.updatedAt, ok.body.updatedAt);
    const row = await RouteCatalogItem.findOne({ where: { catalogId: draft.id, kind: 'contexts', itemKey: 'ctx_version' } });
    assert.equal(row.data.labels.es, 'Contexto dos', 'el 409 no pisa el contenido');
  });

  await t.test('doce guardados simultáneos con la misma versión: exactamente 1×200 y 11×409 item_changed, sin 5xx', async () => {
    const current = (await call('GET', `/${draft.id}`)).body.items.contexts.find((i) => i.itemKey === 'ctx_version');
    const results = await Promise.all(Array.from({ length: 12 }, (_, n) => call('PUT', url('ctx_version'), { ...edited(`carrera ${n}`), expectedUpdatedAt: current.updatedAt })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, ...Array(11).fill(409)], JSON.stringify(results.map((r) => [r.status, r.body && r.body.code])));
    assert.ok(results.filter((r) => r.status === 409).every((r) => r.body.code === 'item_changed'));
    const winner = results.find((r) => r.status === 200);
    const row = await RouteCatalogItem.findOne({ where: { catalogId: draft.id, kind: 'contexts', itemKey: 'ctx_version' } });
    assert.equal(row.data.labels.es, winner.body.labels.es);
  });

  await t.test('sin expectedUpdatedAt gana el último (clientes anteriores); formato raro = 400; elemento quitado con versión = 409 con current null', async () => {
    const legacy = await call('PUT', url('ctx_version'), edited('heredado'));
    assert.equal(legacy.status, 200);
    for (const bad of ['no-es-fecha', 12345, null, {}]) {
      const res = await call('PUT', url('ctx_version'), { ...edited('x'), expectedUpdatedAt: bad });
      assert.equal(res.status, 400, JSON.stringify(bad));
      assert.equal(res.body.code, 'invalid_expected');
    }
    const stamp = legacy.body.updatedAt;
    assert.equal((await call('DELETE', url('ctx_version'))).status, 200);
    const gone = await call('PUT', url('ctx_version'), { ...edited('y'), expectedUpdatedAt: stamp });
    assert.equal(gone.status, 409);
    assert.equal(gone.body.code, 'item_changed');
    assert.equal(gone.body.current, null);
    assert.equal(await RouteCatalogItem.count({ where: { catalogId: draft.id, kind: 'contexts', itemKey: 'ctx_version' } }), 0);
  });

  await t.test('la versión no se cuela en el contenido guardado y un borrador ajeno o una versión publicada siguen sin editarse', async () => {
    const created = await call('PUT', url('ctx_meta'), { ...edited('meta'), updatedAt: '2020-01-01T00:00:00.000Z' });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const row = await RouteCatalogItem.findOne({ where: { catalogId: draft.id, kind: 'contexts', itemKey: 'ctx_meta' } });
    assert.equal(row.data.updatedAt, undefined);
    assert.equal((await call('PUT', `/999999/contexts/ctx_meta`, { ...edited('z'), expectedUpdatedAt: new Date().toISOString() })).status, 404);
    await RouteCatalog.update({ status: 'archived' }, { where: { id: draft.id } });
    const archived = await call('PUT', url('ctx_meta'), { ...edited('w'), expectedUpdatedAt: created.body.updatedAt });
    assert.ok([409, 422, 403].includes(archived.status), String(archived.status));
    assert.equal(archived.body.code, 'catalog_not_editable');
  });
});
