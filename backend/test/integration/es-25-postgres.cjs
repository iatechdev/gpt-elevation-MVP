// ES-25 contra Postgres REAL (criptografía real). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES25_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:bridge:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('ES-25 PostgreSQL: unicidad, cifrado real, concurrencia de confirmaciones y revocación del consentimiento', { timeout: 90000 }, async (t) => {
  const source = process.env.ES25_TEST_DATABASE_URL;
  assert.ok(source, 'ES25_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es25_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es25_test_[a-f0-9]{16}$/);
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
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  for (const name of ['Consent', 'ConsentEvent', 'DiaryEntry', 'ChatTurn', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'DeletionRequest', 'Evidence', 'EvidenceVersion']) require('../../' + name);
  await sequelize.sync();
  const bridge = require('../../utils/careerContext');
  const consent = require('../../utils/consent');
  const Version = require('../../CareerContextVersion');
  const Transfer = require('../../BridgeTransfer');
  const Invalidation = require('../../DerivedInvalidation');
  const Diary = require('../../DiaryEntry');
  const { encriptarV2 } = require('../../utils/crypto');

  const confirmDirect = (userId, text, requestId) => {
    const fields = [{ key: 'motivations', text }];
    return bridge.preview(userId, { fields }).then((p) => bridge.confirm(userId, { fields, token: p.token, requestId }));
  };

  await t.test('existe la restricción única de una sola versión activa por persona y el texto se guarda cifrado v2', async () => {
    const indexes = await sequelize.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'CareerContextVersions' AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
    assert.ok(indexes.some((i) => /UserId/.test(i.indexdef) && /active/.test(i.indexdef)), 'falta el índice único parcial');
    await confirmDirect(1, 'Texto sintético de prueba', 'req-cipher-001');
    const [row] = await sequelize.query(`SELECT payload FROM "CareerContextVersions" WHERE "UserId" = 1`, { type: 'SELECT' });
    assert.match(row.payload, /^v2:/);
    assert.doesNotMatch(row.payload, /sintético/);
    assert.deepEqual((await bridge.getApprovedContext(1, 'pg-engine')).fields, [{ key: 'motivations', text: 'Texto sintético de prueba' }]);
    const [audit] = await sequelize.query(`SELECT keys, hash FROM "BridgeTransfers" WHERE "UserId" = 1`, { type: 'SELECT' });
    assert.deepEqual(audit.keys, ['motivations']);
    assert.doesNotMatch(JSON.stringify(audit), /sintético/);
  });

  await t.test('diez confirmaciones simultáneas de una persona nueva dejan versiones consecutivas y una sola activa', async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => confirmDirect(2, `Texto ${i}`, `req-race-${String(i).padStart(3, '0')}`)));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
    const rows = await Version.findAll({ where: { UserId: 2 }, order: [['version', 'ASC']] });
    assert.deepEqual(rows.map((r) => r.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(rows.filter((r) => r.status === 'active').length, 1);
    assert.equal(await Invalidation.count({ where: { UserId: 2, sourceType: 'career_context_version', reason: 'superseded' } }), 9);
  });

  await t.test('el mismo requestId repetido a la vez crea una sola versión y todos reciben la misma', async () => {
    const fields = [{ key: 'values', text: 'Idempotente' }];
    const p = await bridge.preview(3, { fields });
    const results = await Promise.all(Array.from({ length: 8 }, () => bridge.confirm(3, { fields, token: p.token, requestId: 'req-same-0001' })));
    assert.equal(await Version.count({ where: { UserId: 3 } }), 1);
    assert.ok(results.every((r) => r.record.version === 1));
    assert.equal(results.filter((r) => r.created).length, 1);
  });

  await t.test('confirmar con texto privado mientras se revoca el consentimiento nunca deja una versión privada activa tras la revocación', async () => {
    for (let round = 0; round < 8; round++) {
      const userId = 100 + round;
      await consent.setConsent(userId, 'professional_bridge', 'granted');
      const entry = await Diary.create({ UserId: userId, entryDate: '2026-10-01', content: encriptarV2('diario sintético') });
      const fields = [{ key: 'values', text: 'Privado', origin: { type: 'diary_entry', id: entry.id } }];
      const p = await bridge.preview(userId, { fields });
      const outcomes = await Promise.allSettled([
        bridge.confirm(userId, { fields, token: p.token, requestId: `req-cons-${round}0000` }),
        consent.setConsent(userId, 'professional_bridge', 'revoked'),
      ]);
      assert.deepEqual(outcomes.filter((o) => o.status === 'rejected' && o.reason.code !== 'consent_required').map((o) => o.reason.message), []);
      const stillPrivate = await Version.count({ where: { UserId: userId, status: 'active', consentVersion: 1 } });
      assert.equal(stillPrivate, 0, `ronda ${round}: quedó activa una versión privada con el consentimiento revocado`);
      await assert.rejects(bridge.getApprovedContext(userId, 'pg-engine'), (e) => ['no_context', 'consent_required'].includes(e.code));
    }
  });

  await t.test('una revocación durante una lectura del motor espera a que termine y después ya no hay contexto', async () => {
    const userId = 200;
    await consent.setConsent(userId, 'professional_bridge', 'granted');
    const entry = await Diary.create({ UserId: userId, entryDate: '2026-10-01', content: encriptarV2('diario') });
    const fields = [{ key: 'values', text: 'Privado B', origin: { type: 'diary_entry', id: entry.id } }];
    const p = await bridge.preview(userId, { fields });
    await bridge.confirm(userId, { fields, token: p.token, requestId: 'req-read-00001' });
    const entered = deferred();
    const release = deferred();
    const reader = consent.withConsent(userId, 'professional_bridge', async () => { entered.resolve(); await release.promise; return 'leyendo'; });
    await entered.promise;
    let revoked = false;
    const revoking = consent.setConsent(userId, 'professional_bridge', 'revoked').then(() => { revoked = true; });
    await wait(400);
    assert.equal(revoked, false); // la revocación espera al lector que tiene el bloqueo compartido
    release.resolve();
    assert.equal(await reader, 'leyendo');
    await revoking;
    assert.equal((await Version.findOne({ where: { UserId: userId } })).status, 'revoked');
    await assert.rejects(bridge.getApprovedContext(userId, 'pg-engine'), (e) => e.code === 'no_context');
    assert.equal(await Transfer.count({ where: { UserId: userId } }), 0); // nada cruzó
  });
  await t.test('QA-25-01: 10 confirmaciones simultáneas del mismo dueño, 25 rondas con personas nuevas: cero errores, versiones consecutivas y una sola activa', async () => {
    for (let round = 0; round < 25; round++) {
      const userId = 500 + round;
      const fieldsFor = (n) => [{ key: 'motivations', text: `Texto ${round}-${n}` }];
      const previews = await Promise.all(Array.from({ length: 10 }, (_, n) => bridge.preview(userId, { fields: fieldsFor(n) })));
      const results = await Promise.allSettled(previews.map((p, n) => bridge.confirm(userId, { fields: fieldsFor(n), token: p.token, requestId: `req-stress-${round}-${String(n).padStart(2, '0')}` })));
      assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.code || r.reason.message), [], 'ronda ' + round);
      const rows = await Version.findAll({ where: { UserId: userId }, order: [['version', 'ASC']] });
      assert.deepEqual(rows.map((r) => r.version), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'ronda ' + round);
      assert.equal(rows.filter((r) => r.status === 'active').length, 1);
    }
  });

});
