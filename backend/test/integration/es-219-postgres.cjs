// ES-219 contra Postgres REAL: migración aditiva con detección de duplicados (no borra nada), índices únicos (clave, versión) y una sola
// activa por clave, y concurrencia (publicar, crear y proponer a la vez). Rutas y vault REALES; sin llamadas a Claude.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES219_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:prompt-unique:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Sequelize } = require('sequelize');

test('ES-219 PostgreSQL: versiones únicas por clave, una sola activa y concurrencia', { timeout: 240000 }, async (t) => {
  const source = process.env.ES219_TEST_DATABASE_URL;
  assert.ok(source, 'ES219_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es219_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es219_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 20, min: 0, acquire: 20000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.PROMPT_PROPOSALS_PER_HOUR = '10';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const AuthRevocation = require('../../AuthRevocation');
  const RevokedToken = require('../../RevokedToken');
  await require('../../PricingPlan').sync();
  await Promise.all([User, DeletionRequest, AuthRevocation, RevokedToken].map((model) => model.sync()));
  const { encryptPrompt, getActivePrompt } = require('../../promptVault');
  // La tabla ANTERIOR a ES-191/ES-219 (sin índices únicos), a la que luego se aplican las migraciones.
  await sequelize.query(`CREATE TABLE "PromptVaults" ("id" SERIAL PRIMARY KEY, "key" VARCHAR(255) NOT NULL, "contentEncrypted" TEXT NOT NULL,
    "version" INTEGER DEFAULT 1, "status" VARCHAR(20) DEFAULT 'active', "isActive" BOOLEAN DEFAULT true, "updatedBy" VARCHAR(255), "proposed_by" VARCHAR(255),
    "approved_by" VARCHAR(255), "rejected_by" VARCHAR(255), "rejection_note" TEXT, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL)`);
  await require('../../migrations/20261107000000-es191-prompt-review.cjs').up(sequelize);
  const GOOD = 'Acompaña a la persona con calma y respeto, sin presionarla, y ayúdala a nombrar lo que ya hace bien. Haz una pregunta a la vez.';
  const legacy = (key, version, status, isActive) => sequelize.query(
    `INSERT INTO "PromptVaults" ("key","contentEncrypted","version","status","isActive","createdAt","updatedAt") VALUES (:key,:c,:version,:status,:isActive,now(),now())`,
    { replacements: { key, c: encryptPrompt(GOOD), version, status, isActive } });
  const migration = require('../../migrations/20261109010000-es219-prompt-version-unique.cjs');
  const count = async () => (await sequelize.query('SELECT count(*)::int AS n FROM "PromptVaults"', { type: 'SELECT' }))[0].n;
  const indexes = async () => (await sequelize.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'PromptVaults' AND indexname LIKE 'prompt_vaults__key_%' ORDER BY 1`, { type: 'SELECT' })).map((r) => r.indexname);

  await t.test('con duplicados la migración NO borra ni cambia nada: lanza un informe con los ids y se detiene', async () => {
    await legacy('g_dup', 1, 'active', true); await legacy('g_dup', 2, 'approved', false); await legacy('g_dup', 2, 'pending_review', false); // (clave, versión) repetida
    await legacy('g_act', 1, 'active', true); await legacy('g_act', 2, 'active', true); // dos activas
    await legacy('g_ok', 1, 'active', true);
    const before = await count();
    const snapshot = JSON.stringify(await sequelize.query('SELECT "id","key","version","status" FROM "PromptVaults" ORDER BY "id"', { type: 'SELECT' }));
    await assert.rejects(migration.up(sequelize), (error) => {
      assert.equal(error.name, 'DuplicatePromptVersionsError');
      assert.deepEqual(error.report.versions.map((r) => [r.key, r.version, r.rows]), [['g_dup', 2, 2]]);
      assert.deepEqual(error.report.active.map((r) => [r.key, r.rows]), [['g_act', 2]]);
      assert.ok(error.report.versions[0].ids.length === 2 && error.report.active[0].ids.length === 2, 'el informe da los ids de las filas');
      assert.ok(!JSON.stringify(error.report).includes(encryptPrompt(GOOD).slice(0, 12)), 'el informe no lleva el texto de las guías');
      return true;
    });
    assert.equal(await count(), before, 'no se borró ninguna fila');
    assert.equal(JSON.stringify(await sequelize.query('SELECT "id","key","version","status" FROM "PromptVaults" ORDER BY "id"', { type: 'SELECT' })), snapshot, 'no se cambió ninguna fila');
    assert.deepEqual(await indexes(), [], 'no se creó ningún índice');
    const report = await migration.findDuplicates(sequelize); // la comprobación de solo lectura da lo mismo
    assert.equal(report.versions.length, 1); assert.equal(report.active.length, 1);
  });

  await t.test('sin duplicados la migración crea los dos índices, es idempotente y rechaza duplicados nuevos', async () => {
    await sequelize.query(`DELETE FROM "PromptVaults" WHERE "key" IN ('g_dup', 'g_act')`); // la persona decidió qué conservar: aquí, nada (base desechable)
    await migration.up(sequelize); await migration.up(sequelize);
    assert.deepEqual(await indexes(), [migration.INDEX_ACTIVE, migration.INDEX_VERSION]);
    await assert.rejects(legacy('g_ok', 1, 'approved', false), /duplicate key|unique/i);
    await assert.rejects(legacy('g_ok', 5, 'active', true), /duplicate key|unique/i); // segunda activa de la misma clave
    await legacy('g_ok', 5, 'pending_review', false); // otra versión que no es activa sí
  });

  await t.test('el down exige permiso explícito y nunca corre en producción; con permiso quita solo los índices', async () => {
    const before = await count();
    const saved = { allow: process.env.ALLOW_DESTRUCTIVE_MIGRATION, env: process.env.NODE_ENV };
    try {
      delete process.env.ALLOW_DESTRUCTIVE_MIGRATION;
      await assert.rejects(migration.down(sequelize), /ALLOW_DESTRUCTIVE_MIGRATION/);
      process.env.ALLOW_DESTRUCTIVE_MIGRATION = 'true'; process.env.NODE_ENV = 'production';
      await assert.rejects(migration.down(sequelize), /NODE_ENV=production/);
      assert.equal((await indexes()).length, 2, 'sin permiso no se quitó nada');
      process.env.NODE_ENV = 'test';
      await migration.down(sequelize);
      assert.deepEqual(await indexes(), []); assert.equal(await count(), before, 'ninguna fila se perdió');
    } finally {
      if (saved.allow === undefined) delete process.env.ALLOW_DESTRUCTIVE_MIGRATION; else process.env.ALLOW_DESTRUCTIVE_MIGRATION = saved.allow;
      if (saved.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.env;
    }
    await migration.up(sequelize); // se vuelve a aplicar para la concurrencia
    assert.equal((await indexes()).length, 2);
  });

  const { issueToken } = require('../../utils/sessions');
  const { verificarAdmin, verificarSuperAdmin } = require('../../middlewares/auth');
  const app = express(); app.use(express.json());
  app.use('/api/admin', verificarAdmin, require('../../routes/adminPrompts'));
  app.use('/api/superadmin', verificarSuperAdmin, require('../../routes/adminPrompts'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const person = (role, name) => User.create({ name, email: `${name.toLowerCase()}@example.invalid`, password: 'x', role });
  const [adm, sup] = [await person('admin', 'Adm'), await person('superadmin', 'Sup')];
  const tokens = new Map();
  const tokenFor = (p) => { if (!tokens.has(p.id)) tokens.set(p.id, issueToken(p)); return tokens.get(p.id); };
  const call = async (p, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(p)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 80) }; }
    return { status: response.status, body: json };
  };
  const rows = (key) => sequelize.query('SELECT * FROM "PromptVaults" WHERE "key" = :key ORDER BY "version", "id"', { type: 'SELECT', replacements: { key } });
  const variant = (i) => `${GOOD} Variante ${i}.`;

  await t.test('10 publicaciones simultáneas de la misma guía: versiones consecutivas únicas y UNA sola activa', async () => {
    assert.equal((await call(sup, 'POST', '/api/superadmin/prompt/create', { key: 'guia_carrera', content: GOOD })).status, 200);
    process.env.PROMPT_PROPOSALS_PER_HOUR = '100';
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => call(sup, 'POST', '/api/superadmin/prompt/publish', { key: 'guia_carrera', content: variant(i) })));
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)));
    const all = await rows('guia_carrera');
    const versions = all.map((r) => r.version);
    assert.equal(new Set(versions).size, versions.length, `versiones repetidas: ${versions}`);
    assert.deepEqual(versions, Array.from({ length: versions.length }, (_, i) => versions[0] + i), 'consecutivas');
    assert.equal(all.length, 11);
    assert.equal(all.filter((r) => r.status === 'active').length, 1); assert.equal(all.filter((r) => r.isActive).length, 1);
    assert.ok((await getActivePrompt('guia_carrera')).startsWith(GOOD));
  });

  await t.test('8 creaciones simultáneas de la misma clave: solo una gana (200) y las demás reciben 409; queda una sola versión y una activa', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => call(sup, 'POST', '/api/superadmin/prompt/create', { key: 'guia_nueva', content: variant(i) })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409, 409, 409, 409, 409, 409, 409], JSON.stringify(statuses));
    assert.ok(results.filter((r) => r.status === 409).every((r) => r.body.code === 'key_exists'));
    const all = await rows('guia_nueva');
    assert.equal(all.length, 1); assert.equal(all[0].status, 'active');
  });

  await t.test('15 propuestas simultáneas con el límite de 10 por hora: se guardan exactamente 10, con versiones distintas, y el resto da 429', async () => {
    process.env.PROMPT_PROPOSALS_PER_HOUR = '10';
    assert.equal((await call(sup, 'POST', '/api/superadmin/prompt/create', { key: 'guia_limite', content: GOOD })).status, 200);
    const results = await Promise.all(Array.from({ length: 15 }, (_, i) => call(adm, 'POST', '/api/admin/prompt/propose', { key: 'guia_limite', content: variant(i) })));
    const ok = results.filter((r) => r.status === 200).length; const limited = results.filter((r) => r.status === 429).length;
    assert.equal(ok + limited, 15, JSON.stringify(results.map((r) => r.status)));
    const all = await rows('guia_limite');
    assert.equal(all.length, 10, `se guardaron ${all.length} (límite 10 por hora incluyendo la creación inicial)`);
    assert.equal(new Set(all.map((r) => r.version)).size, all.length, 'sin versiones repetidas');
  });

  await t.test('aprobar a la vez versiones de la misma clave sigue dejando UNA activa (el índice parcial lo garantiza también en la base)', async () => {
    process.env.PROMPT_PROPOSALS_PER_HOUR = '100';
    const { approvePrompt } = require('../../promptVault');
    const proposals = [];
    for (let i = 0; i < 4; i += 1) proposals.push((await call(adm, 'POST', '/api/admin/prompt/propose', { key: 'guia_carrera', content: variant(100 + i) })).body.version.id);
    await Promise.allSettled(proposals.map((id) => approvePrompt(id, 'super@example.test')));
    assert.equal((await rows('guia_carrera')).filter((r) => r.status === 'active').length, 1);
  });
});
