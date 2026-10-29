// ES-107 contra Postgres REAL: la migración convierte las hojas de vida existentes a binario sin perder datos (y se puede deshacer),
// el tamaño en disco es el del PDF + 29 bytes, la descarga es idéntica y el tope global no se rebasa con envíos simultáneos.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES107_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:pro-cv-binary:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-107: migración de filas existentes, tamaño en disco, descarga idéntica y tope global concurrente (PostgreSQL real)', { timeout: 240000 }, async (t) => {
  const source = process.env.ES107_TEST_DATABASE_URL;
  assert.ok(source, 'ES107_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es107_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es107_test_[a-f0-9]{16}$/);
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
  process.env.PRO_APP_RATE_MAX = '1000'; process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; delete process.env.NODE_ENV;
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const { encriptarV2, desencriptar, desencriptarBuffer } = require('../../utils/crypto');
  const qi = sequelize.getQueryInterface();
  const one = async (sql, replacements) => (await sequelize.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT }))[0];
  const columns = async () => (await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ProfessionalApplicationFiles'`, { type: Sequelize.QueryTypes.SELECT })).map(r => r.column_name);

  // Estado ANTERIOR (ES-95): Users mínima + las dos tablas con la hoja de vida en base64 cifrado (TEXT), como la dejó el PR #70.
  await qi.createTable('Users', { id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true } });
  const es95 = require('../../migrations/20261029000000-es95-professional-applications.js');
  await es95.up(qi, Sequelize);
  const pdfs = [Buffer.from('%PDF-1.4\n% synthetic one\n%%EOF\n'), Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(200 * 1024), Buffer.from('\n%%EOF\n')])];
  for (const [index, pdf] of pdfs.entries()) {
    const [[application]] = await sequelize.query(
      `INSERT INTO "ProfessionalApplications" (name, email, country, profession, locale, status, "consentAt", "createdAt", "updatedAt")
       VALUES ('Persona Sintética', :email, 'Colombia', 'Psicología', 'es', 'pending', now(), now(), now()) RETURNING id`, { replacements: { email: `legacy.${index}@example.invalid` } });
    await sequelize.query(
      `INSERT INTO "ProfessionalApplicationFiles" ("ApplicationId", size, sha256, content, "createdAt", "updatedAt") VALUES (:id, :size, :sha, :content, now(), now())`,
      { replacements: { id: application.id, size: pdf.length, sha: createHash('sha256').update(pdf).digest('hex'), content: encriptarV2(pdf.toString('base64')) } });
  }
  const legacyBytes = Number((await one(`SELECT sum(length(content)) AS n FROM "ProfessionalApplicationFiles"`)).n);

  const es107 = require('../../migrations/20261030000000-es107-cv-binary.js');
  await t.test('la migración convierte las filas existentes a binario sin perder datos y quita la columna anterior', async () => {
    await es107.up(qi, Sequelize);
    const names = await columns(); assert.ok(names.includes('data')); assert.equal(names.includes('content'), false);
    const rows = await sequelize.query(`SELECT "ApplicationId", size, sha256, data FROM "ProfessionalApplicationFiles" ORDER BY "ApplicationId"`, { type: Sequelize.QueryTypes.SELECT });
    assert.equal(rows.length, 2);
    for (const [index, row] of rows.entries()) {
      assert.equal(desencriptarBuffer(row.data).equals(pdfs[index]), true);
      assert.equal(row.size, pdfs[index].length); assert.equal(createHash('sha256').update(desencriptarBuffer(row.data)).digest('hex'), row.sha256);
      assert.equal(row.data.length, pdfs[index].length + 29);
    }
    const binaryBytes = Number((await one(`SELECT sum(octet_length(data)) AS n FROM "ProfessionalApplicationFiles"`)).n);
    assert.ok(binaryBytes < legacyBytes / 2, `binario ${binaryBytes} B vs anterior ${legacyBytes} B`); // el texto anterior ocupaba ≈2,7× el PDF
  });

  await t.test('el down devuelve el formato anterior sin perder datos y se puede volver a aplicar; sin permiso explícito se niega', async () => {
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'false';
    await assert.rejects(es107.down(qi, Sequelize), /ALLOW_DESTRUCTIVE_MIGRATION/);
    assert.ok((await columns()).includes('data')); // no dejó la base a medias
    process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true';
    await es107.down(qi, Sequelize);
    const names = await columns(); assert.ok(names.includes('content')); assert.equal(names.includes('data'), false);
    const rows = await sequelize.query(`SELECT content FROM "ProfessionalApplicationFiles" ORDER BY "ApplicationId"`, { type: Sequelize.QueryTypes.SELECT });
    for (const [index, row] of rows.entries()) assert.equal(Buffer.from(desencriptar(row.content), 'base64').equals(pdfs[index]), true);
    await es107.up(qi, Sequelize);
    assert.equal(Number((await one(`SELECT count(*) AS n FROM "ProfessionalApplicationFiles"`)).n), 2);
  });

  const Application = require('../../ProfessionalApplication'); const File = require('../../ProfessionalApplicationFile');
  const express = require('express'); const app = express(); app.use(express.json());
  app.use('/api/professional-applications', require('../../routes/professionalApplications').publicRouter);
  app.use('/api/admin/professional-applications', (req, res, next) => { req.user = { id: 1, role: 'admin', name: 'Admin Sintético' }; next(); }, require('../../routes/professionalApplications').adminRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), randomBytes(300 * 1024), Buffer.from('\n%%EOF\n')]);
  const send = async (email) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ name: 'Persona Sintética', email, country: 'Colombia', profession: 'Psicología', consent: 'true', locale: 'es' })) data.append(key, value);
    data.append('cv', new Blob([PDF], { type: 'application/pdf' }), 'cv.pdf');
    const response = await fetch(`${base}/professional-applications`, { method: 'POST', body: data });
    return { status: response.status, body: await response.json() };
  };

  await t.test('un envío nuevo ocupa en disco el PDF + 29 bytes y la descarga devuelve exactamente el PDF', async () => {
    assert.equal((await send('synthetic.size@example.invalid')).status, 201);
    const row = await Application.findOne({ where: { email: 'synthetic.size@example.invalid' } });
    const stored = await one(`SELECT octet_length(data) AS n FROM "ProfessionalApplicationFiles" WHERE "ApplicationId" = :id`, { id: row.id });
    assert.equal(Number(stored.n), PDF.length + 29);
    const response = await fetch(`${base}/admin/professional-applications/${row.id}/cv`);
    assert.equal(response.status, 200); assert.equal(Buffer.from(await response.arrayBuffer()).equals(PDF), true);
    const migrated = await File.findOne({ where: { ApplicationId: 1 } }); // fila migrada: también se descarga idéntica
    assert.equal(desencriptarBuffer(migrated.data).equals(pdfs[0]), true);
    const migratedDownload = await fetch(`${base}/admin/professional-applications/1/cv`);
    assert.equal(Buffer.from(await migratedDownload.arrayBuffer()).equals(pdfs[0]), true);
  });

  await t.test('20 envíos simultáneos con tope de 5 pendientes: no se rebasa y el resto recibe el cierre controlado', async () => {
    await sequelize.query(`TRUNCATE "ProfessionalApplicationFiles", "ProfessionalApplications" RESTART IDENTITY CASCADE`);
    process.env.PRO_APP_MAX_PENDING = '5';
    const results = await Promise.all(Array.from({ length: 60 }, (_, i) => send(`synthetic.cap${i}@example.invalid`)));
    assert.equal(results.filter(r => r.status === 201).length, 5);
    assert.equal(results.filter(r => r.status === 503).length, 55);
    for (const r of results.filter(r => r.status === 503)) assert.equal(r.body.code, 'not_accepting');
    assert.equal(await Application.count({ where: { status: 'pending' } }), 5); assert.equal(await File.count(), 5);
    const capacity = await (await fetch(`${base}/admin/professional-applications/capacity`)).json();
    assert.deepEqual([capacity.full, capacity.pending, capacity.maxPending], [true, 5, 5]);
    // Al revisar una, se libera un cupo.
    await Application.update({ status: 'rejected' }, { where: { email: 'synthetic.cap0@example.invalid' } });
    assert.equal((await send('synthetic.after@example.invalid')).status, 201);
    assert.equal((await send('synthetic.after2@example.invalid')).status, 503);
    delete process.env.PRO_APP_MAX_PENDING;
  });

  await t.test('el tope por peso total cierra el formulario aunque haya pocas solicitudes', async () => {
    await sequelize.query(`TRUNCATE "ProfessionalApplicationFiles", "ProfessionalApplications" RESTART IDENTITY CASCADE`);
    process.env.PRO_APP_MAX_BYTES = String(5 * 1024 * 1024 + PDF.length * 2 - 1);
    const results = []; for (let i = 0; i < 3; i++) results.push((await send(`synthetic.bytes${i}@example.invalid`)).status);
    assert.deepEqual(results, [201, 201, 503]);
    delete process.env.PRO_APP_MAX_BYTES;
  });
});
