// ES-193 contra Postgres REAL: datos de contacto y ayuda (línea de emergencia) editables desde Contenido. Rutas REALES, JWT reales, sin proveedor.
// Todos los números son SINTÉTICOS (ninguno es una línea real). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES193_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:contact-entries:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-193 PostgreSQL: datos de contacto editables, con procedencia vigente y solo superadministración escribe', { timeout: 180000 }, async (t) => {
  const source = process.env.ES193_TEST_DATABASE_URL;
  assert.ok(source, 'ES193_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es193_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es193_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false; let server;
  t.after(async () => {
    if (server) { server.close(); server.closeAllConnections(); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  await require('../../PricingPlan').sync();
  await Promise.all([User, require('../../DeletionRequest'), require('../../AuthRevocation'), require('../../RevokedToken')].map((model) => model.sync()));

  await t.test('la migración es idempotente, activa RLS y NO siembra ningún número', async () => {
    const migration = require('../../migrations/20261107020000-es193-contact-entries.cjs');
    await migration.up(sequelize); await migration.up(sequelize);
    for (const table of ['ContactEntries', 'ContactEntryAudits']) {
      assert.equal((await sequelize.query('SELECT relrowsecurity FROM pg_class WHERE relname = :table', { type: 'SELECT', replacements: { table } }))[0].relrowsecurity, true, table);
    }
    assert.equal((await sequelize.query('SELECT count(*)::int AS n FROM "ContactEntries"', { type: 'SELECT' }))[0].n, 0);
  });

  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin } = require('../../middlewares/auth');
  const { publicRouter, adminRouter } = require('../../routes/contactEntries');
  const ContactEntry = require('../../ContactEntry');
  const ContactEntryAudit = require('../../ContactEntryAudit');
  const app = express(); app.use(express.json());
  app.use('/api/contact-entries', publicRouter);
  app.use('/api/admin/contact-entries', verificarAdmin, adminRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const person = (role, name) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role });
  const [sup, adm, usr, thr, brd] = [await person('superadmin', 'Sup'), await person('admin', 'Adm'), await person('user', 'Usr'), await person('therapist', 'Thr'), await person('board', 'Brd')];
  const call = async (who, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(who ? { Authorization: `Bearer ${issueToken(who)}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json, headers: response.headers };
  };
  const day = (offset) => new Date(Date.now() - offset * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const NEW = { country: 'zz', name: 'Línea sintética A', contact: '555 0100', descriptionEs: 'Atención de prueba.', descriptionEn: 'Test line.' };
  const VERIFIED = { source: 'https://example.invalid/fuente-oficial', verifiedBy: 'Persona de prueba', verifiedAt: day(1) };
  const publicList = async (country = 'ZZ') => (await call(null, 'GET', `/api/contact-entries?country=${country}`)).body.entries;

  await t.test('sin entradas, la lectura pública devuelve lista vacía (el aviso genérico lo pone la pantalla), sin caché y con país validado', async () => {
    const r = await call(null, 'GET', '/api/contact-entries?country=ZZ');
    assert.equal(r.status, 200); assert.deepEqual(r.body, { entries: [] }); assert.match(r.headers.get('cache-control'), /no-store/);
    assert.equal((await call(null, 'GET', '/api/contact-entries')).status, 200);
    for (const country of ['ZZZ', '1', '', 'Z%20', "Z';--", '<b>']) assert.equal((await call(null, 'GET', `/api/contact-entries?country=${encodeURIComponent(country)}`)).status, 400, country);
    assert.equal((await call(null, 'GET', '/api/contact-entries?country=A&country=B')).status, 400);
  });

  await t.test('solo superadministración escribe (403 a administración y al resto); administración lee con el estado de verificación', async () => {
    for (const [who, label] of [[adm, 'admin'], [usr, 'user'], [thr, 'therapist'], [brd, 'board'], [null, 'sin sesión']]) {
      for (const [method, path, body] of [['POST', '/api/admin/contact-entries', NEW], ['PUT', '/api/admin/contact-entries/1', { version: 1, name: 'x' }], ['PUT', '/api/admin/contact-entries/order', { ids: [1] }]]) {
        assert.equal((await call(who, method, path, body)).status, 403, `${label} ${method} ${path}`);
      }
    }
    for (const [who, label] of [[usr, 'user'], [thr, 'therapist'], [brd, 'board'], [null, 'sin sesión']]) assert.equal((await call(who, 'GET', '/api/admin/contact-entries')).status, 403, label);
    assert.equal(await ContactEntry.count(), 0);
    const made = await call(sup, 'POST', '/api/admin/contact-entries', NEW);
    assert.equal(made.status, 201); assert.equal(made.body.country, 'ZZ'); assert.equal(made.body.active, false); assert.equal(made.body.verification, 'unverified'); assert.equal(made.body.version, 1);
    const read = await call(adm, 'GET', '/api/admin/contact-entries');
    assert.equal(read.status, 200); assert.equal(read.body.entries[0].verification, 'unverified'); assert.equal(read.body.maxAgeDays, 180);
  });

  let entry;
  await t.test('no se activa sin procedencia vigente; con ella se publica en el orden y la forma públicos; al desactivar deja de verse al instante', async () => {
    entry = (await call(adm, 'GET', '/api/admin/contact-entries')).body.entries[0];
    assert.deepEqual(await publicList(), []); // creada pero inactiva y sin verificar
    const blockedOn = await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: 1, active: true });
    assert.equal(blockedOn.status, 409); assert.equal(blockedOn.body.code, 'verification_required');
    assert.equal((await call(sup, 'POST', '/api/admin/contact-entries', { ...NEW, name: 'Otra', active: true })).status, 409);
    const done = await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: 1, ...VERIFIED, active: true });
    assert.equal(done.status, 200); assert.equal(done.body.verification, 'verified'); assert.equal(done.body.version, 2); assert.equal(done.body.active, true);
    const listed = await publicList();
    assert.equal(listed.length, 1);
    assert.deepEqual(Object.keys(listed[0]).sort(), ['contact', 'country', 'description', 'id', 'name']); // sin fuente, verificador, versión ni estado
    assert.deepEqual(listed[0].description, { es: 'Atención de prueba.', en: 'Test line.' }); assert.equal(listed[0].contact, '555 0100');
    assert.deepEqual(await publicList('CO'), []); // otro país
    assert.equal((await call(null, 'GET', '/api/contact-entries')).body.entries.length, 1); // sin país: todas las vigentes
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: 2, active: false })).status, 200);
    assert.deepEqual(await publicList(), []); // desactivada: ya no se ve, sin borrarla
    assert.equal(await ContactEntry.count({ where: { id: entry.id } }), 1);
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: 3, active: true })).status, 200);
  });

  await t.test('una verificación vencida deja de mostrar el número aunque siga activa; cambiar el contacto de una activa exige procedencia vigente', async () => {
    await sequelize.query(`UPDATE "ContactEntries" SET "verifiedAt" = :old WHERE "id" = :id`, { replacements: { old: day(400), id: entry.id } });
    assert.deepEqual(await publicList(), []); // nunca un número viejo
    const row = (await call(adm, 'GET', '/api/admin/contact-entries')).body.entries[0];
    assert.equal(row.verification, 'stale'); assert.equal(row.active, true);
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: row.version, descriptionEs: 'Texto corregido.' })).status, 200); // editar textos no se bloquea
    const v = (await call(adm, 'GET', '/api/admin/contact-entries')).body.entries[0].version;
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: v, contact: '555 0199' })).status, 409); // otro número sin verificar de nuevo
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: v, contact: '555 0199', verifiedAt: day(0) })).status, 200);
    assert.equal((await publicList())[0].contact, '555 0199');
    await sequelize.query(`UPDATE "ContactEntries" SET "verifiedAt" = :future WHERE "id" = :id`, { replacements: { future: day(-30), id: entry.id } });
    assert.deepEqual(await publicList(), []); // una fecha de verificación en el futuro tampoco vale
    await sequelize.query(`UPDATE "ContactEntries" SET "verifiedAt" = :ok WHERE "id" = :id`, { replacements: { ok: day(0), id: entry.id } });
  });

  await t.test('entradas hostiles: HTML, letras en el número, tipos incorrectos, enormes y fechas inválidas dan 400, nunca 500; el texto se guarda como texto', async () => {
    const attempts = [
      { ...NEW, name: '<script>alert(1)</script>' }, { ...NEW, descriptionEs: '<img src=x onerror=alert(1)>' }, { ...NEW, descriptionEn: 'a'.repeat(301) }, { ...NEW, name: 'a'.repeat(81) }, { ...NEW, name: '' }, { ...NEW, name: 5 },
      { ...NEW, contact: 'llama ya' }, { ...NEW, contact: '12' }, { ...NEW, contact: '+++' }, { ...NEW, contact: '1'.repeat(33) }, { ...NEW, contact: '<b>5550100</b>' }, { ...NEW, contact: ['555 0100'] }, { ...NEW, contact: { $ne: null } },
      { ...NEW, country: 'COL' }, { ...NEW, country: '1' }, { ...NEW, country: null }, { ...NEW, verifiedAt: '2026-13-45' }, { ...NEW, verifiedAt: '07/11/2026' }, { ...NEW, verifiedAt: day(-400) }, { ...NEW, active: 'sí' },
      { ...NEW, source: 'x'.repeat(301) }, { ...NEW, name: 'con\u0000nulo' }, {}, { country: 'ZZ' },
    ];
    for (const body of attempts) assert.equal((await call(sup, 'POST', '/api/admin/contact-entries', body)).status, 400, JSON.stringify(body).slice(0, 70));
    for (const body of [[], 'texto', 42, null]) assert.equal((await call(sup, 'POST', '/api/admin/contact-entries', body)).status, 400, JSON.stringify(body));
    assert.equal((await call(sup, 'POST', '/api/admin/contact-entries', undefined)).status, 400);
    const ok = await call(sup, 'POST', '/api/admin/contact-entries', { ...NEW, name: ' Línea & "especial" (ñ) ', contact: '+00 (1) 555-0100 #2', country: 'yy' });
    assert.equal(ok.status, 201); assert.equal(ok.body.name, 'Línea & "especial" (ñ)'); assert.equal(ok.body.contact, '+00 (1) 555-0100 #2');
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${id}`, { version: 1, name: 'x' })).status, 404, id);
    assert.equal((await call(sup, 'PUT', '/api/admin/contact-entries/999999', { version: 1, name: 'x' })).status, 404);
    for (const body of [{ name: 'x' }, { version: 'uno', name: 'x' }, { version: 0, name: 'x' }, { version: 1.5, name: 'x' }, { version: 1, name: '<x>' }, { version: 1, contact: 'abc' }, [], null]) {
      assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await ContactEntry.findOne({ where: { id: entry.id } })).name, 'Línea sintética A'); // ninguno cambió nada
  });

  await t.test('ediciones simultáneas: de ocho cambios con la misma versión gana uno; el resto recibe conflicto con lo vigente', async () => {
    const current = (await call(sup, 'GET', '/api/admin/contact-entries')).body.entries.find((e) => e.id === entry.id);
    const results = await Promise.all(Array.from({ length: 8 }, (_, n) => call(sup, 'PUT', `/api/admin/contact-entries/${entry.id}`, { version: current.version, descriptionEs: `Cambio ${n}` })));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    const losers = results.filter((r) => r.status === 409);
    assert.equal(losers.length, 7); assert.ok(losers.every((r) => r.body.code === 'conflict' && r.body.current.version === current.version + 1));
    assert.equal((await ContactEntry.findOne({ where: { id: entry.id } })).version, current.version + 1);
  });

  await t.test('reordenar cambia el orden público; mezclar países, ids repetidos o ajenos no se acepta', async () => {
    const second = await call(sup, 'POST', '/api/admin/contact-entries', { ...NEW, name: 'Segunda', contact: '555 0111', ...VERIFIED, active: true });
    assert.equal(second.status, 201); assert.equal(second.body.position, 1);
    assert.deepEqual((await publicList()).map((e) => e.name), ['Línea sintética A', 'Segunda']);
    assert.equal((await call(sup, 'PUT', '/api/admin/contact-entries/order', { ids: [second.body.id, entry.id] })).status, 200);
    assert.deepEqual((await publicList()).map((e) => e.name), ['Segunda', 'Línea sintética A']);
    const other = (await call(sup, 'GET', '/api/admin/contact-entries')).body.entries.find((e) => e.country === 'YY');
    for (const ids of [[entry.id, other.id], [entry.id, entry.id], [], [0], ['1'], 'x', [entry.id, 999999]]) {
      assert.ok([400, 404].includes((await call(sup, 'PUT', '/api/admin/contact-entries/order', { ids })).status), JSON.stringify(ids));
    }
    assert.deepEqual((await publicList()).map((e) => e.name), ['Segunda', 'Línea sintética A']); // lo rechazado no cambió nada
  });

  await t.test('cada cambio guarda quién y cuándo (historial); administración lo lee, no lo escribe', async () => {
    const history = await call(adm, 'GET', `/api/admin/contact-entries/${entry.id}/history`);
    assert.equal(history.status, 200);
    const actions = history.body.map((h) => h.action);
    for (const expected of ['create', 'activate', 'deactivate', 'update', 'reorder']) assert.ok(actions.includes(expected), expected);
    assert.ok(history.body.every((h) => h.actorName === 'Sup' && h.createdAt && h.snapshot.id === entry.id));
    assert.ok(!JSON.stringify(history.body).includes('"password"'));
    for (const id of ['abc', '0', '999999x']) assert.equal((await call(adm, 'GET', `/api/admin/contact-entries/${id}/history`)).status, 404, id);
    assert.equal((await call(usr, 'GET', `/api/admin/contact-entries/${entry.id}/history`)).status, 403);
    assert.ok(await ContactEntryAudit.count() >= 5);
  });

  await t.test('la respuesta de seguridad del chat usa solo recursos publicados con procedencia vigente, y sin ellos o con la base caída es la genérica', async () => {
    const { buildSafetyReply, buildSupportNote } = require('../../utils/safety');
    const { loadSafetyRegistry } = require('../../utils/contactEntries');
    const withEntries = buildSafetyReply({ lang: 'es', country: 'ZZ', registry: await loadSafetyRegistry() });
    assert.match(withEntries, /Recursos verificados en tu país/); assert.match(withEntries, /Segunda: 555 0111/); assert.match(withEntries, /Línea sintética A: 555 0199/);
    assert.match(buildSupportNote({ lang: 'en', country: 'ZZ', registry: await loadSafetyRegistry() }), /Segunda: 555 0111/);
    assert.doesNotMatch(buildSafetyReply({ lang: 'es', country: 'CO', registry: await loadSafetyRegistry() }), /555/); // otro país: genérica
    const segunda = await ContactEntry.findOne({ where: { name: 'Segunda' } });
    assert.equal((await call(sup, 'PUT', `/api/admin/contact-entries/${segunda.id}`, { version: segunda.version, active: false })).status, 200);
    assert.deepEqual((await publicList()).map((e) => e.name), ['Línea sintética A']); // una sola desactivada: la otra sigue
    await ContactEntry.update({ active: false }, { where: {} });
    assert.doesNotMatch(buildSafetyReply({ lang: 'es', country: 'ZZ', registry: await loadSafetyRegistry() }), /555/); // sin entradas activas: nunca un número viejo
    await ContactEntry.update({ active: true }, { where: { country: 'ZZ' } });
    const real = ContactEntry.findAll; ContactEntry.findAll = async () => { throw new Error('base caída'); };
    try {
      assert.deepEqual((await loadSafetyRegistry()).countries, {});
      assert.doesNotMatch(buildSafetyReply({ lang: 'es', country: 'ZZ', registry: await loadSafetyRegistry() }), /555/);
      assert.equal((await call(null, 'GET', '/api/contact-entries?country=ZZ')).status, 503); // la pantalla muestra «reintentar», no un número
    } finally { ContactEntry.findAll = real; }
  });
});
