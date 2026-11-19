// ES-260 contra Postgres REAL: el catálogo de rutas publicado trae `skillLabels` {clave: {es, en}} de las habilidades que referencia (capacidades de roles y
// recurso vinculado), tomadas del catálogo de habilidades VIGENTE. Solo nombres; las claves que no existen se omiten. Contenido SINTÉTICO. Crea y borra SOLO su base aleatoria en loopback.
//   ES260_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-260-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-260 PostgreSQL: skillLabels del catálogo de rutas desde el catálogo de habilidades vigente, solo nombres', { timeout: 120000 }, async (t) => {
  const source = process.env.ES260_TEST_DATABASE_URL;
  assert.ok(source, 'ES260_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es260_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es260_test_[a-f0-9]{16}$/);
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
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const RouteCatalog = require('../../RouteCatalog');
  require('../../RouteCatalogItem'); // registrar el modelo antes de sync()
  const SkillCatalog = require('../../SkillCatalog');
  const SkillDefinition = require('../../SkillDefinition');
  await sequelize.sync();
  const catalog = require('../../utils/routeCatalog');
  const { build } = require('../../seeds/routeCatalogSynthetic.cjs');
  const data = build();

  // ---- catálogo de rutas sintético publicado ----
  const draft = await catalog.createDraft();
  for (const kind of catalog.KINDS) for (const [key, item] of Object.entries(data[kind])) await catalog.upsertItem(draft.id, kind, key, item);
  await catalog.publish(draft.id, 1, { allowSynthetic: true });
  const referenced = new Set([...Object.values(data.roles).flatMap((r) => r.capabilities.map((c) => c.skillKey)), ...Object.values(data.resources).map((r) => r.linkedSkillKey)]);
  assert.ok(referenced.size >= 5, [...referenced].join(','));
  const [kept, absent, ...rest] = [...referenced];
  const rubric = { levels: { 1: { es: 'Nivel 1 secreto', en: 'Secret level 1' } }, source: 'x', verifiedBy: 'Revisor sintético', verifiedAt: '2026-01-01' };
  const def = (catalogId, skillKey, es, en) => ({ catalogId, skillKey, type: 'transversal', labels: { es, en }, rubric });

  await t.test('sin catálogo de habilidades vigente: skillLabels vacío y el resto del payload igual', async () => {
    const out = await catalog.getPublishedRouteCatalog();
    assert.deepEqual(out.skillLabels, {});
    assert.deepEqual(Object.keys(out).sort(), ['contexts', 'offers', 'publishedAt', 'resources', 'roles', 'skillLabels', 'sources', 'version']);
    assert.equal(out.roles.length, 6);
  });

  // un catálogo ARCHIVADO (versión 1) con otro nombre, y el VIGENTE (versión 2) sin la clave `absent`
  const old = await SkillCatalog.create({ version: 1, status: 'archived', publishedAt: new Date() });
  const current = await SkillCatalog.create({ version: 2, status: 'published', publishedAt: new Date() });
  await SkillDefinition.bulkCreate([
    def(old.id, kept, 'Nombre viejo', 'Old name'), def(old.id, absent, 'Solo en el archivado', 'Only archived'),
    def(current.id, kept, 'Nombre vigente', 'Current name'), ...rest.map((k) => def(current.id, k, `Nombre ${k}`, `Name ${k}`)),
    def(current.id, 'clave_no_referenciada', 'No referenciada', 'Not referenced'),
  ]);

  await t.test('trae el nombre vigente de las claves referenciadas; omite las inexistentes en el vigente y las no referenciadas; no usa archivados', async () => {
    const out = await catalog.getPublishedRouteCatalog();
    assert.deepEqual(out.skillLabels[kept], { es: 'Nombre vigente', en: 'Current name' });
    assert.equal(Object.hasOwn(out.skillLabels, absent), false, 'la clave que solo existe en un catálogo archivado se omite (no se inventa)');
    assert.equal(Object.hasOwn(out.skillLabels, 'clave_no_referenciada'), false);
    assert.deepEqual(Object.keys(out.skillLabels).sort(), [kept, ...rest].sort());
    for (const v of Object.values(out.skillLabels)) assert.deepEqual(Object.keys(v).sort(), ['en', 'es']);
  });

  await t.test('solo nombres: el payload no filtra rúbrica, niveles ni quién la verificó', async () => {
    const text = JSON.stringify(await catalog.getPublishedRouteCatalog());
    for (const leak of ['Nivel 1 secreto', 'Secret level 1', 'Revisor sintético', 'rubric', 'verifiedBy']) assert.equal(text.includes(leak), false, leak);
  });

  await t.test('el resto del payload no cambia: mismas claves por rol, recursos y ofertas que sin skillLabels', async () => {
    const out = await catalog.getPublishedRouteCatalog();
    const { skillLabels, ...others } = out; void skillLabels;
    assert.equal(others.roles.length, 6); assert.equal(others.resources.length, Object.keys(data.resources).length); assert.equal(others.offers.length, Object.keys(data.offers).length);
    assert.ok(others.roles.every((r) => r.capabilities.every((c) => Object.keys(c).sort().join() === 'importance,skillKey')), 'las capacidades siguen con skillKey e importance');
  });

  await t.test('una definición con nombre vacío o incompleto no se publica', async () => {
    await SkillDefinition.update({ labels: { es: 'Solo español', en: '' } }, { where: { catalogId: current.id, skillKey: kept } });
    const out = await catalog.getPublishedRouteCatalog();
    assert.equal(Object.hasOwn(out.skillLabels, kept), false);
  });

  await t.test('GET /api/route-catalog/roles/:roleKey: skillLabels solo de ese rol y sus recursos', async () => {
    await SkillDefinition.update({ labels: { es: 'Nombre vigente', en: 'Current name' } }, { where: { catalogId: current.id, skillKey: kept } });
    const app = express(); app.use('/api/route-catalog', require('../../routes/routeCatalog'));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/route-catalog`;
    const roleKey = 'formador_corporativo';
    const body = await (await fetch(`${base}/roles/${roleKey}`)).json();
    const wanted = new Set([...data.roles[roleKey].capabilities.map((c) => c.skillKey), ...Object.values(data.resources).filter((r) => r.roleKeys.includes(roleKey)).map((r) => r.linkedSkillKey)]);
    assert.ok(Object.keys(body.skillLabels).length > 0);
    assert.ok(Object.keys(body.skillLabels).every((k) => wanted.has(k)), JSON.stringify(Object.keys(body.skillLabels)));
    const whole = await (await fetch(base)).json();
    assert.deepEqual(Object.keys(whole.skillLabels).sort(), [kept, ...rest].sort());
    assert.equal(await RouteCatalog.count({ where: { status: 'published' } }), 1);
  });
  // ES-271: skillLabels es decorativo; si su lectura falla (tabla ausente), el catálogo se sirve igual con skillLabels:{} y las demás partes idénticas.
  for (const table of ['SkillDefinitions', 'SkillCatalogs']) await t.test(`ES-271: con la tabla ${table} ausente, GET /api/route-catalog y /roles/:roleKey responden 200 con skillLabels:{} y el resto igual; se registra solo el nombre del error`, async () => {
    const base = `http://127.0.0.1:${server.address().port}/api/route-catalog`;
    const roleKey = 'formador_corporativo';
    const healthy = await (await fetch(base)).json(); const healthyRole = await (await fetch(`${base}/roles/${roleKey}`)).json();
    assert.ok(Object.keys(healthy.skillLabels).length > 0, 'con la consulta sana hay etiquetas (payload de hoy)');
    await sequelize.query(`ALTER TABLE "${table}" RENAME TO "${table}_ausente"`);
    const logged = []; const original = console.error; console.error = (...args) => { logged.push(args.map(String).join(' ')); };
    try {
      const whole = await fetch(base); const role = await fetch(`${base}/roles/${roleKey}`);
      assert.equal(whole.status, 200); assert.equal(role.status, 200);
      const [wholeBody, roleBody] = [await whole.json(), await role.json()];
      assert.deepEqual(wholeBody.skillLabels, {}); assert.deepEqual(roleBody.skillLabels, {});
      const { skillLabels: a, ...restWhole } = wholeBody; const { skillLabels: b, ...restHealthy } = healthy; void a; void b;
      assert.deepEqual(restWhole, restHealthy, 'el resto del catálogo no cambia');
      const { skillLabels: c, ...restRole } = roleBody; const { skillLabels: d, ...restHealthyRole } = healthyRole; void c; void d;
      assert.deepEqual(restRole, restHealthyRole);
    } finally { console.error = original; await sequelize.query(`ALTER TABLE "${table}_ausente" RENAME TO "${table}"`); }
    assert.ok(logged.length >= 2 && logged.every((line) => /Etiquetas de habilidades no disponibles/.test(line) && !/relation|SELECT|Skill(Definitions|Catalogs)/.test(line)), `se registra solo el nombre del error: ${logged.join(' | ')}`);
    assert.deepEqual((await (await fetch(base)).json()).skillLabels, healthy.skillLabels, 'restaurada la tabla, vuelve el payload de siempre');
  });

});
