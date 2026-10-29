// ES-95 (QA M2) contra Postgres REAL: envíos simultáneos del mismo correo crean UNA sola solicitud (índice único parcial), la hoja de vida
// queda cifrada y una solicitud rechazada deja volver a solicitar. Rutas, modelos y consultas reales; sin simulaciones.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES95_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:pro-applications:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-95: 10 envíos simultáneos del mismo correo crean una sola solicitud y el resto responde igual (PostgreSQL real)', { timeout: 180000 }, async (t) => {
  const source = process.env.ES95_TEST_DATABASE_URL;
  assert.ok(source, 'ES95_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es95_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es95_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.PRO_APP_RATE_MAX = '1000';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../associations')();
  const { CORE } = require('../../utils/personalData');
  for (const [, model] of CORE) require('../../' + model);
  require('../../ProfessionalApplication'); require('../../ProfessionalApplicationFile'); // antes de sync(): crea sus tablas e índices
  await sequelize.sync();

  const Application = require('../../ProfessionalApplication'); const File = require('../../ProfessionalApplicationFile');
  const { desencriptar } = require('../../utils/crypto');
  const express = require('express'); const app = express(); app.use(express.json());
  app.use('/api/professional-applications', require('../../routes/professionalApplications').publicRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/professional-applications`;
  const PDF = Buffer.from('%PDF-1.4\n% synthetic test document\n%%EOF\n');
  const send = async (email, extra = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ name: 'Persona Sintética', email, country: 'Colombia', profession: 'Psicología', consent: 'true', locale: 'es', ...extra })) data.append(key, value);
    data.append('cv', new Blob([PDF], { type: 'application/pdf' }), 'cv.pdf');
    const response = await fetch(url, { method: 'POST', body: data });
    return { status: response.status, body: await response.json() };
  };

  await t.test('10 envíos simultáneos del mismo correo (con mayúsculas distintas): una sola solicitud, una sola hoja de vida y la misma respuesta para todos', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => send(i % 2 ? 'SYNTHETIC.Race@Example.INVALID' : 'synthetic.race@example.invalid')));
    assert.deepEqual(results.map(r => r.status), Array(10).fill(201));
    assert.equal(new Set(results.map(r => JSON.stringify(r.body))).size, 1);
    const rows = await Application.findAll({ where: { email: 'synthetic.race@example.invalid' } });
    assert.equal(rows.length, 1); assert.equal(rows[0].status, 'pending');
    assert.equal(await File.count({ where: { ApplicationId: rows[0].id } }), 1);
    assert.equal(await File.count(), 1); // ni hojas de vida huérfanas de los envíos que perdieron la carrera
  });

  await t.test('la hoja de vida se guarda cifrada y se recupera idéntica; el tamaño y la huella corresponden al archivo', async () => {
    const row = await Application.findOne({ where: { email: 'synthetic.race@example.invalid' } });
    const file = await File.findOne({ where: { ApplicationId: row.id } });
    assert.notEqual(file.content, PDF.toString('base64')); assert.match(file.content, /^v2:/);
    assert.equal(Buffer.from(desencriptar(file.content), 'base64').equals(PDF), true);
    assert.equal(file.size, PDF.length); assert.match(file.sha256, /^[0-9a-f]{64}$/);
  });

  await t.test('correos distintos en simultáneo no se bloquean entre sí; aprobada también bloquea duplicados; rechazada permite volver a solicitar', async () => {
    const many = await Promise.all(Array.from({ length: 6 }, (_, i) => send(`synthetic.${i}@example.invalid`)));
    assert.deepEqual(many.map(r => r.status), Array(6).fill(201));
    assert.equal(await Application.count(), 7);
    const first = await Application.findOne({ where: { email: 'synthetic.race@example.invalid' } });
    await first.update({ status: 'approved' });
    assert.equal((await send('synthetic.race@example.invalid')).status, 201); assert.equal(await Application.count({ where: { email: 'synthetic.race@example.invalid' } }), 1);
    await first.update({ status: 'rejected' });
    assert.equal((await send('synthetic.race@example.invalid')).status, 201); assert.equal(await Application.count({ where: { email: 'synthetic.race@example.invalid' } }), 2);
    const again = await Promise.all([send('synthetic.race@example.invalid'), send('synthetic.race@example.invalid')]); // ahora hay una pendiente: no entra otra
    assert.deepEqual(again.map(r => r.status), [201, 201]); assert.equal(await Application.count({ where: { email: 'synthetic.race@example.invalid', status: 'pending' } }), 1);
  });

  await t.test('la base impide por sí sola dos solicitudes abiertas del mismo correo (el índice, no solo la ruta)', async () => {
    const now = new Date();
    await assert.rejects(Application.create({ name: 'X', email: 'synthetic.0@example.invalid', country: 'CO', profession: 'P', consentAt: now, status: 'pending' }),
      error => error.name === 'SequelizeUniqueConstraintError');
  });
});
