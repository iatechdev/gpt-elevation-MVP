// ES-31 contra Postgres REAL. Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa
// DATABASE_URL y nunca sale a internet. Todo el contenido del catálogo es SINTÉTICO.
// Uso (en backend/):  ES31_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:routecatalog:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-31 PostgreSQL: índices únicos parciales con nombre, borradores y publicaciones simultáneos, edición concurrente', { timeout: 90000 }, async (t) => {
  const source = process.env.ES31_TEST_DATABASE_URL;
  assert.ok(source, 'ES31_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es31_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es31_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize;
  let created = false;
  t.after(async () => {
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
  await sequelize.sync(); // si dos índices parciales compartieran nombre, esto fallaría (como pasó en ES-29)
  const catalog = require('../../utils/routeCatalog');
  const { build } = require('../../seeds/routeCatalogSynthetic.cjs');

  await t.test('existen los índices únicos parciales de un catálogo vigente y un borrador', async () => {
    const rows = await sequelize.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'RouteCatalogs' AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
    const names = rows.map((r) => r.indexname);
    assert.ok(names.includes('route_catalogs_one_published') && names.includes('route_catalogs_one_draft'), names.join(','));
  });

  await t.test('tres borradores simultáneos: solo uno se crea y el resto recibe draft_exists o conflict', async () => {
    const results = await Promise.allSettled([catalog.createDraft(), catalog.createDraft(), catalog.createDraft()]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['draft_exists', 'conflict'].includes(r.reason.code)), JSON.stringify(results.map((r) => r.reason?.message)));
    assert.equal(await RouteCatalog.count({ where: { status: 'draft' } }), 1);
  });

  const [draft] = await RouteCatalog.findAll({ where: { status: 'draft' } });

  await t.test('ocho ediciones simultáneas de la misma clave dejan una sola fila y ningún error que no sea conflict', async () => {
    const body = build().contexts.ctx_educacion_formacion;
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => catalog.upsertItem(draft.id, 'contexts', 'ctx_concurrente', body)));
    assert.deepEqual(results.filter((r) => r.status === 'rejected' && r.reason.code !== 'conflict').map((r) => r.reason.message), []);
    assert.ok(results.some((r) => r.status === 'fulfilled'));
    assert.equal(await RouteCatalogItem.count({ where: { catalogId: draft.id, kind: 'contexts', itemKey: 'ctx_concurrente' } }), 1);
    await catalog.removeItem(draft.id, 'contexts', 'ctx_concurrente');
  });

  await t.test('con el contenido sintético completo, dos publicaciones simultáneas: una gana y la otra recibe catalog_not_editable', async () => {
    const data = build();
    for (const kind of catalog.KINDS) for (const [key, item] of Object.entries(data[kind])) await catalog.upsertItem(draft.id, kind, key, item);
    assert.deepEqual((await catalog.get(draft.id)).missing, {});
    const results = await Promise.allSettled([catalog.publish(draft.id, 1, { allowSynthetic: true }), catalog.publish(draft.id, 2, { allowSynthetic: true })]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['catalog_not_editable', 'conflict'].includes(r.reason.code)));
    assert.equal(await RouteCatalog.count({ where: { status: 'published' } }), 1);
    const read = await catalog.getPublishedRouteCatalog();
    assert.equal(read.roles.length, 6);
    assert.equal(read.contexts.length, 6);
  });

  await t.test('publicar sin la autorización de pruebas se niega con contenido sintético, y lo publicado no admite ediciones', async () => {
    const next = await catalog.createDraft();
    assert.equal(next.itemCount > 0, true);
    await assert.rejects(catalog.publish(next.id, 1, { allowSynthetic: false }), (e) => e.code === 'synthetic_content_not_allowed');
    const [published] = await RouteCatalog.findAll({ where: { status: 'published' } });
    await assert.rejects(catalog.upsertItem(published.id, 'contexts', 'ctx_tarde', { labels: { es: 'a', en: 'a' } }), (e) => e.code === 'catalog_not_editable');
  });
});
