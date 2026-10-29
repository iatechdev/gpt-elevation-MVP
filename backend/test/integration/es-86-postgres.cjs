// ES-86 contra Postgres REAL (criptografía real): escritura con la clave profesional, lectura de los dos formatos y migración de datos
// reversible (scripts/reencryptProfessional.js). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo. Todo dato es sintético.
// Uso (en backend/):  ES86_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54339/postgres npm run test:professional-key:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-86 PostgreSQL: clave profesional, doble lectura y re-cifrado reversible', { timeout: 90000 }, async (t) => {
  const source = process.env.ES86_TEST_DATABASE_URL;
  assert.ok(source, 'ES86_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es86_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es86_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });

  const DATA_KEY = randomBytes(32).toString('hex');
  const PRO_KEY = randomBytes(32).toString('hex');
  const NEW_KEY = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = DATA_KEY;
  process.env.NODE_ENV = 'test';
  const setPro = (env = {}) => {
    for (const k of ['PROFESSIONAL_ENCRYPTION_KEY', 'PROFESSIONAL_KEY_ID', 'PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS', 'PROFESSIONAL_KEY_ID_PREVIOUS']) delete process.env[k];
    Object.assign(process.env, env);
  };
  setPro();
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  for (const name of ['Consent', 'ConsentEvent', 'DiaryEntry', 'ChatTurn', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'DeletionRequest', 'Evidence', 'EvidenceVersion']) require('../../' + name);
  await sequelize.sync();
  const bridge = require('../../utils/careerContext');
  const pro = require('../../utils/professionalCrypto');
  const { encriptarV2, desencriptar } = require('../../utils/crypto');
  const { reencrypt } = require('../../scripts/reencryptProfessional');
  const Version = require('../../CareerContextVersion');

  const confirmDirect = (userId, text, requestId) => {
    const fields = [{ key: 'motivations', text }];
    return bridge.preview(userId, { fields }).then((p) => bridge.confirm(userId, { fields, token: p.token, requestId }));
  };
  const stored = async (userId) => (await sequelize.query(`SELECT "payload" FROM "CareerContextVersions" WHERE "UserId" = ${userId} ORDER BY "version"`, { type: 'SELECT' })).map((r) => r.payload);
  const insertLegacy = (userId, text) => Version.create({
    UserId: userId, version: 1, status: 'active', payload: encriptarV2(JSON.stringify([{ key: 'values', text }])), origins: [{ key: 'values', index: 0, type: 'direct' }],
    consentVersion: null, requestId: `legacy-${userId}-0001`, approvedAt: new Date(),
  });

  await t.test('con la clave profesional el contexto se guarda como v2p: (sin texto) y el API lo lee; el motor profesional recibe solo clave y texto', async () => {
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    await confirmDirect(1, 'Texto sintético de prueba', 'req-pro-0001');
    const [payload] = await stored(1);
    assert.match(payload, /^v2p:p1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    assert.doesNotMatch(payload, /sintético/);
    assert.deepEqual((await bridge.getApprovedContext(1, 'pg-engine')).fields, [{ key: 'motivations', text: 'Texto sintético de prueba' }]);
    assert.equal((await bridge.list(1)).active.fields[0].text, 'Texto sintético de prueba');
    // Idempotencia por requestId: repetir devuelve lo mismo sin volver a cifrar.
    assert.equal((await confirmDirect(1, 'Texto sintético de prueba', 'req-pro-0001')).created, false);
    assert.equal((await stored(1)).length, 1);
  });

  await t.test('sin la clave: en producción NO se guarda nada (503, sin degradar en silencio); fuera de producción se conserva el formato v2 de la transición', async () => {
    setPro();
    process.env.NODE_ENV = 'production';
    try {
      await assert.rejects(confirmDirect(2, 'No debe guardarse', 'req-nokey-0001'), (e) => e.status === 503 && e.code === 'professional_key_missing');
    } finally { process.env.NODE_ENV = 'test'; }
    assert.equal((await stored(2)).length, 0);
    await confirmDirect(3, 'Transición sin clave', 'req-nokey-0002');
    assert.match((await stored(3))[0], /^v2:/);
    assert.equal((await bridge.getApprovedContext(3, 'pg-engine')).fields[0].text, 'Transición sin clave');
  });

  await t.test('doble lectura durante la transición: datos v2 y v2p conviven y se leen igual', async () => {
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    await insertLegacy(4, 'Texto heredado v2');
    assert.equal((await bridge.getApprovedContext(4, 'pg-engine')).fields[0].text, 'Texto heredado v2');
    assert.equal((await bridge.getApprovedContext(1, 'pg-engine')).fields[0].text, 'Texto sintético de prueba');
    // Con la clave profesional ausente el API sigue leyendo v2 pero falla (503-style) en v2p: nunca devuelve el texto cifrado.
    setPro();
    assert.equal((await bridge.getApprovedContext(4, 'pg-engine')).fields[0].text, 'Texto heredado v2');
    await assert.rejects(bridge.getApprovedContext(1, 'pg-engine'), (e) => e.code === 'professional_key_missing');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
  });

  const plains = async () => {
    const out = {};
    for (const row of await sequelize.query('SELECT "UserId", "payload" FROM "CareerContextVersions" ORDER BY "UserId", "version"', { type: 'SELECT' })) out[row.UserId] = desencriptar(row.payload);
    return out;
  };
  const prefixes = async () => (await sequelize.query('SELECT "UserId", "payload" FROM "CareerContextVersions" ORDER BY "UserId"', { type: 'SELECT' }))
    .map((r) => [r.UserId, r.payload.split(':').slice(0, r.payload.startsWith('v2p') ? 2 : 1).join(':')]);

  await t.test('migración hacia la clave profesional: simulacro sin escribir, aplicación atómica, idempotente y con el mismo contenido', async () => {
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    const before = await plains();
    const beforePrefixes = await prefixes();
    const dry = await reencrypt(sequelize, { to: 'professional' });
    assert.deepEqual(dry, { to: 'professional', apply: false, total: 3, alreadyTarget: 1, converted: 2, rotated: 0, jobsInvalidated: 0 });
    assert.deepEqual(await prefixes(), beforePrefixes, 'el simulacro no escribe');
    const applied = await reencrypt(sequelize, { to: 'professional', apply: true });
    assert.deepEqual([applied.alreadyTarget, applied.converted], [1, 2]);
    assert.ok((await prefixes()).every(([, p]) => p === 'v2p:p1'));
    assert.deepEqual(await plains(), before, 'el contenido descifrado es idéntico, byte por byte');
    const again = await reencrypt(sequelize, { to: 'professional', apply: true });
    assert.deepEqual([again.alreadyTarget, again.converted, again.rotated], [3, 0, 0]);
    // Los consumidores no notan el cambio.
    assert.equal((await bridge.getApprovedContext(4, 'pg-engine')).fields[0].text, 'Texto heredado v2');
  });

  await t.test('reversa hacia la clave de datos: v2p: vuelve a v2: con el mismo contenido y el ciclo completo es estable', async () => {
    const before = await plains();
    const back = await reencrypt(sequelize, { to: 'data', apply: true });
    assert.deepEqual([back.converted, back.alreadyTarget], [3, 0]);
    assert.ok((await prefixes()).every(([, p]) => p === 'v2'));
    assert.deepEqual(await plains(), before);
    assert.deepEqual([(await reencrypt(sequelize, { to: 'data', apply: true })).alreadyTarget], [3]);
    await reencrypt(sequelize, { to: 'professional', apply: true });
    assert.deepEqual(await plains(), before);
    assert.ok((await prefixes()).every(([, p]) => p === 'v2p:p1'));
  });

  await t.test('rotación: con la clave anterior configurada solo para descifrar, los datos pasan al kid nuevo', async () => {
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: NEW_KEY, PROFESSIONAL_KEY_ID: 'p2', PROFESSIONAL_ENCRYPTION_KEY_PREVIOUS: PRO_KEY, PROFESSIONAL_KEY_ID_PREVIOUS: 'p1' });
    const before = await plains();
    const rotated = await reencrypt(sequelize, { to: 'professional', apply: true });
    assert.deepEqual([rotated.rotated, rotated.converted, rotated.alreadyTarget], [3, 0, 0]);
    assert.ok((await prefixes()).every(([, p]) => p === 'v2p:p2'));
    assert.deepEqual(await plains(), before);
    // Retirada la clave anterior, lo rotado sigue legible; con solo la vieja ya no.
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: NEW_KEY, PROFESSIONAL_KEY_ID: 'p2' });
    assert.equal((await bridge.getApprovedContext(4, 'pg-engine')).fields[0].text, 'Texto heredado v2');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY, PROFESSIONAL_KEY_ID: 'p1' });
    await assert.rejects(bridge.getApprovedContext(4, 'pg-engine'), (e) => e.code === 'unknown_key_id');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    await reencrypt(sequelize, { to: 'data', apply: false }).then(() => assert.fail('debía fallar'), (e) => assert.equal(e.code, 'unknown_key_id'));
  });

  await t.test('todo o nada: sin clave, con un formato desconocido o con una clave equivocada no cambia ninguna fila', async () => {
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: NEW_KEY, PROFESSIONAL_KEY_ID: 'p2' });
    await reencrypt(sequelize, { to: 'data', apply: true }); // deja todo en v2 para forzar una conversión pendiente
    const snapshot = await sequelize.query('SELECT "id", "payload" FROM "CareerContextVersions" ORDER BY "id"', { type: 'SELECT' });
    setPro();
    await assert.rejects(reencrypt(sequelize, { to: 'professional', apply: true }), (e) => e.code === 'professional_key_missing');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: NEW_KEY, PROFESSIONAL_KEY_ID: 'p2' });
    await sequelize.query(`INSERT INTO "CareerContextVersions" ("UserId","version","status","payload","origins","consentVersion","requestId","approvedAt","createdAt","updatedAt")
      VALUES (99,1,'revoked','basura-sin-formato','[]'::json,NULL,'bad-format-0001',now(),now(),now())`);
    await assert.rejects(reencrypt(sequelize, { to: 'professional', apply: true }), /Formato de payload desconocido/);
    await sequelize.query('DELETE FROM "CareerContextVersions" WHERE "UserId" = 99');
    assert.deepEqual(await sequelize.query('SELECT "id", "payload" FROM "CareerContextVersions" ORDER BY "id"', { type: 'SELECT' }), snapshot, 'ninguna fila cambió');
    // Un dato v2 alterado también cancela todo (y no se escribe a medias).
    await sequelize.query(`UPDATE "CareerContextVersions" SET "payload" = regexp_replace("payload", '.$', CASE WHEN right("payload", 1) = '0' THEN '1' ELSE '0' END) WHERE "UserId" = 4`);
    await assert.rejects(reencrypt(sequelize, { to: 'professional', apply: true }), (e) => e.code === 'decryption_failed');
    assert.ok((await prefixes()).every(([, p]) => p === 'v2'), 'ninguna fila se convirtió');
    await sequelize.query(`UPDATE "CareerContextVersions" SET "payload" = :p WHERE "UserId" = 4`, { replacements: { p: snapshot.find((r) => r.payload).payload } }).catch(() => {});
  });

  await t.test('los jobs vivos del worker (si existe AiJobs) que apuntan a una versión re-cifrada quedan INVALIDATED; el resto no se toca', async () => {
    // Restaura las filas y crea un AiJobs mínimo (en producción lo crea la migración de ES-85).
    await sequelize.query('DELETE FROM "CareerContextVersions"');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    await insertLegacy(10, 'Uno'); await insertLegacy(11, 'Dos');
    await sequelize.query(`CREATE TABLE "AiJobs" ("id" SERIAL PRIMARY KEY, "UserId" INTEGER, "contextVersion" INTEGER, "status" VARCHAR(16), "errorCode" VARCHAR(32),
      "leaseOwner" VARCHAR(64), "leaseExpiresAt" TIMESTAMPTZ, "finishedAt" TIMESTAMPTZ, "updatedAt" TIMESTAMPTZ DEFAULT now())`);
    await sequelize.query(`INSERT INTO "AiJobs" ("UserId","contextVersion","status") VALUES (10,1,'PENDING'),(10,1,'RUNNING'),(10,1,'REVIEW_REQUIRED'),(11,1,'PENDING'),(12,1,'PENDING')`);
    const dry = await reencrypt(sequelize, { to: 'professional' });
    assert.equal(dry.jobsInvalidated, 0);
    assert.equal((await sequelize.query(`SELECT count(*)::int n FROM "AiJobs" WHERE "status" = 'INVALIDATED'`, { type: 'SELECT' }))[0].n, 0, 'el simulacro no toca jobs');
    // Solo la persona 10 se re-cifra: dejamos la 11 ya en v2p.
    await sequelize.query(`UPDATE "CareerContextVersions" SET "payload" = :p WHERE "UserId" = 11`, { replacements: { p: pro.encrypt('Dos') } });
    const out = await reencrypt(sequelize, { to: 'professional', apply: true });
    assert.equal(out.jobsInvalidated, 2);
    const jobs = await sequelize.query('SELECT "UserId", "status", "errorCode" FROM "AiJobs" ORDER BY "id"', { type: 'SELECT' });
    assert.deepEqual(jobs.map((j) => [j.UserId, j.status, j.errorCode]), [
      [10, 'INVALIDATED', 'context_reencrypted'], [10, 'INVALIDATED', 'context_reencrypted'], [10, 'REVIEW_REQUIRED', null], [11, 'PENDING', null], [12, 'PENDING', null]]);
  });

  await t.test('re-cifrar mientras llegan confirmaciones nuevas: nada se pierde ni queda ilegible', async () => {
    await sequelize.query('DELETE FROM "CareerContextVersions"');
    setPro({ PROFESSIONAL_ENCRYPTION_KEY: PRO_KEY });
    for (let u = 20; u < 26; u++) await insertLegacy(u, `Heredado ${u}`);
    const results = await Promise.allSettled([
      reencrypt(sequelize, { to: 'professional', apply: true }),
      ...Array.from({ length: 6 }, (_, i) => confirmDirect(30 + i, `Nuevo ${i}`, `req-race-${String(i).padStart(4, '0')}`)),
    ]);
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => String(r.reason)), []);
    await reencrypt(sequelize, { to: 'professional', apply: true }); // por si algún heredado quedó fuera del bloqueo
    const all = await plains();
    assert.equal(Object.keys(all).length, 12);
    for (let u = 20; u < 26; u++) assert.match(all[u], new RegExp(`Heredado ${u}`));
    assert.ok((await prefixes()).every(([, p]) => p === 'v2p:p1'));
  });
});
