// ES-182 (E45-1) contra Postgres REAL: el Manifiesto ético guarda una versión opcional en inglés (`contentEn`, cifrada). Migración aditiva e idempotente sobre una tabla anterior,
// POST con y sin inglés, validación, el editor y la lectura pública devuelven `contentEn` (null si no hay), la lectura pública NO filtra nota ni autor, y el cifrado en reposo.
// La autorización por rol se prueba aparte (p1-3, es-182-roles, es-207): aquí el guardián se sustituye por uno que deja pasar. Datos sintéticos.
// Crea y borra SOLO su base aleatoria en loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES182EN_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:manifest-en:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-182 PostgreSQL: Manifiesto con versión en inglés opcional y cifrada', { timeout: 120000 }, async (t) => {
  const source = process.env.ES182EN_TEST_DATABASE_URL;
  assert.ok(source, 'ES182EN_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es182en_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es182en_test_[a-f0-9]{16}$/);
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
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const authModule = require.resolve('../../middlewares/auth');
  const pass = (req, _res, next) => { req.user = { id: 1, role: 'superadmin' }; next(); };
  require.cache[authModule] = { id: authModule, filename: authModule, loaded: true, exports: { verificarEditorManifiesto: pass, verificarPublicadorManifiesto: pass } };
  const q = (sql, replacements) => sequelize.query(sql, { type: 'SELECT', replacements });
  const hasColumn = async () => (await q(`SELECT 1 AS x FROM information_schema.columns WHERE table_name = 'EthicManifests' AND column_name = 'contentEn'`)).length === 1;

  // Tabla ANTERIOR (sin contentEn) con una versión ya publicada: la migración no debe tocarla.
  await sequelize.query(`CREATE TABLE "EthicManifests" ("id" SERIAL PRIMARY KEY, "content" TEXT NOT NULL, "version" VARCHAR(10) NOT NULL, "isActive" BOOLEAN DEFAULT false, "uploadedBy" INTEGER NOT NULL, "note" TEXT, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL)`);
  await sequelize.query(`INSERT INTO "EthicManifests" ("content","version","isActive","uploadedBy","createdAt","updatedAt") VALUES ('legacy-cipher','v1',true,1,now(),now())`);
  const migration = require('../../migrations/20261120010000-es182-manifest-content-en.cjs');

  await t.test('la migración es aditiva e idempotente: crea la columna nullable sin tocar las filas existentes', async () => {
    assert.equal(await hasColumn(), false);
    await migration.up(sequelize); await migration.up(sequelize); // dos veces
    assert.equal(await hasColumn(), true);
    const rows = await q('SELECT "id","content","version","isActive","contentEn" FROM "EthicManifests"');
    assert.deepEqual(rows, [{ id: 1, content: 'legacy-cipher', version: 'v1', isActive: true, contentEn: null }]);
    const col = (await q(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'EthicManifests' AND column_name = 'contentEn'`))[0];
    assert.deepEqual(col, { is_nullable: 'YES', column_default: null });
  });

  const EthicManifest = require('../../EthicManifest');
  await require('../../PricingPlan').sync();
  const User = require('../../User'); await User.sync(); // el editor incluye al autor de cada versión (asociación real del servidor)
  User.hasMany(EthicManifest, { foreignKey: 'uploadedBy', as: 'manifests' }); EthicManifest.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
  const { desencriptar } = require('../../utils/crypto');
  const router = require('../../routes/board');
  const app = express(); app.use(express.json()); app.use('/api/manifest', router);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/manifest`;
  const call = async (method, path, body) => { const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  const ES = (label) => `Texto sintético del manifiesto ${label}. `.repeat(3) + 'Sin datos personales.';
  const EN = (label) => `Synthetic manifest text ${label}. `.repeat(3) + 'No personal data.';

  await t.test('sin inglés: se publica como antes y contentEn es null en el editor y en la lectura pública', async () => {
    const created = await call('POST', '/manifest', { content: ES('dos'), note: 'nota interna' });
    assert.equal(created.status, 201);
    const pub = await call('GET', '/active');
    assert.equal(pub.body.content, ES('dos')); assert.equal(pub.body.contentEn, null);
    const editor = (await call('GET', '/manifest')).body.find((m) => m.version === created.body.version);
    assert.equal(editor.contentEn, null);
  });

  await t.test('con inglés: se guarda cifrado y se devuelve en el editor y en la lectura pública; la lectura pública no filtra nota ni autor', async () => {
    const created = await call('POST', '/manifest', { content: ES('tres'), contentEn: `  ${EN('three')}  `, note: 'nota interna secreta' });
    assert.equal(created.status, 201);
    const pub = await call('GET', '/active');
    assert.equal(pub.body.content, ES('tres')); assert.equal(pub.body.contentEn, EN('three'), 'se recorta y se descifra');
    assert.deepEqual(Object.keys(pub.body).sort(), ['content', 'contentEn', 'publishedAt', 'version'], 'solo versión, textos y fecha: nunca nota, autor ni ids');
    const raw = (await q('SELECT "content","contentEn" FROM "EthicManifests" WHERE "version" = :v', { v: created.body.version }))[0];
    assert.notEqual(raw.contentEn, EN('three')); assert.ok(!raw.contentEn.includes('Synthetic manifest')); assert.equal(desencriptar(raw.contentEn), EN('three'), 'cifrado en reposo igual que content');
    assert.ok(!raw.content.includes('Texto sintético'));
    const editor = (await call('GET', '/manifest')).body.find((m) => m.version === created.body.version);
    assert.equal(editor.contentEn, EN('three'));
  });

  await t.test('validación: inglés demasiado corto → 400 con campo; vacío o solo espacios = ausente; no-texto → 400; el español sigue exigiendo 50 caracteres', async () => {
    const short = await call('POST', '/manifest', { content: ES('cuatro'), contentEn: 'too short' });
    assert.equal(short.status, 400); assert.equal(short.body.field, 'contentEn');
    const blank = await call('POST', '/manifest', { content: ES('cinco'), contentEn: '   ' });
    assert.equal(blank.status, 201); assert.equal((await call('GET', '/active')).body.contentEn, null);
    assert.equal((await call('POST', '/manifest', { content: ES('seis'), contentEn: 42 })).status, 400);
    assert.equal((await call('POST', '/manifest', { content: 'corto' })).status, 400);
    assert.equal(await EthicManifest.count(), 1 + 1 + 1 + 1, 'las peticiones rechazadas no guardan nada (la anterior, dos, tres y cinco)');
  });

  await t.test('reactivar una versión conserva su inglés; la lectura pública sigue la versión activa', async () => {
    const all = (await call('GET', '/manifest')).body;
    const withEnglish = all.find((m) => m.contentEn === EN('three'));
    assert.equal((await call('PUT', `/manifest/${withEnglish.id}/activate`)).status, 200);
    const pub = (await call('GET', '/active')).body;
    assert.equal(pub.contentEn, EN('three')); assert.equal(pub.version, withEnglish.version);
    const withoutEnglish = all.find((m) => m.contentEn === null && m.content === ES('dos'));
    assert.equal((await call('PUT', `/manifest/${withoutEnglish.id}/activate`)).status, 200);
    assert.equal((await call('GET', '/active')).body.contentEn, null);
  });
});
