// ES-27 contra Postgres REAL (criptografía real). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES27_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:evidence:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test('ES-27 PostgreSQL: cifrado real, unicidad, ediciones concurrentes y revocación del consentimiento', { timeout: 90000 }, async (t) => {
  const source = process.env.ES27_TEST_DATABASE_URL;
  assert.ok(source, 'ES27_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es27_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es27_test_[a-f0-9]{16}$/);
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

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'DeletionRequest', 'CareerContextVersion', 'BridgeTransfer']) require('../../' + name);
  await sequelize.sync();
  const evidence = require('../../utils/evidence');
  const consent = require('../../utils/consent');
  const Evidence = require('../../Evidence');
  const Version = require('../../EvidenceVersion');
  const Invalidation = require('../../DerivedInvalidation');
  const ChatTurn = require('../../ChatTurn');
  const { encriptarV2 } = require('../../utils/crypto');

  const payload = (title = 'Evidencia sintética', over = {}) => ({
    title, situation: 'Situación sintética', responsibility: { text: 'Mi parte sintética' }, actions: [{ text: 'Acción sintética' }],
    delivered: { text: 'Entrega sintética' }, observedEffect: { known: false }, ...over,
  });
  let seq = 0;
  const rid = () => `pg-req-${String(++seq).padStart(6, '0')}`;
  const body = (over = {}, status = 'confirmed', extra = {}) => ({ payload: payload('t', over), status, requestId: rid(), ...extra });

  await t.test('el contenido se guarda cifrado v2, sin texto plano, y se lee de vuelta; las claves únicas existen', async () => {
    const r = await evidence.create(1, body({ situation: 'Situación MUY específica sintética' }));
    const [row] = await sequelize.query(`SELECT payload FROM "EvidenceVersions" WHERE "UserId" = 1`, { type: 'SELECT' });
    assert.match(row.payload, /^v2:/);
    assert.doesNotMatch(row.payload, /específica/);
    const [delivered] = await evidence.getConfirmedEvidence(1, 'pg-engine');
    assert.equal(delivered.payload.situation, 'Situación MUY específica sintética');
    assert.deepEqual([delivered.evidenceId, delivered.version], [r.id, 1]);
    const indexes = await sequelize.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'EvidenceVersions' AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
    assert.ok(indexes.some((i) => /EvidenceId.*version/.test(i.indexdef)), 'falta el índice único (EvidenceId, version)');
    assert.ok(indexes.some((i) => /UserId.*requestId/.test(i.indexdef)), 'falta el índice único (UserId, requestId)');
  });

  await t.test('ocho ediciones simultáneas con la misma baseVersion: exactamente una gana y el resto recibe version_conflict', async () => {
    const created = await evidence.create(2, body());
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
      evidence.update(2, created.id, body({ learning: `edición ${i}` }, 'confirmed', { baseVersion: 1 }))));
    const wins = results.filter((r) => r.status === 'fulfilled');
    const conflicts = results.filter((r) => r.status === 'rejected' && r.reason.code === 'version_conflict');
    assert.equal(wins.length, 1, JSON.stringify(results.filter((r) => r.status === 'rejected' && r.reason.code !== 'version_conflict').map((r) => r.reason.message)));
    assert.equal(conflicts.length, 7);
    assert.equal((await Evidence.findByPk(created.id)).currentVersion, 2);
    assert.equal(await Version.count({ where: { EvidenceId: created.id } }), 2);
    assert.equal(await Invalidation.count({ where: { UserId: 2, sourceType: 'evidence', sourceId: created.id, reason: 'edited' } }), 1);
  });

  await t.test('crear con el mismo requestId a la vez deja una sola evidencia', async () => {
    const same = body();
    const results = await Promise.all(Array.from({ length: 8 }, () => evidence.create(3, same)));
    assert.equal(await Evidence.count({ where: { UserId: 3 } }), 1);
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal(results.filter((r) => r.created).length, 1);
  });

  await t.test('confirmar con origen del chat mientras se revoca el puente nunca deja evidencia del chat vigente tras la revocación', async () => {
    for (let round = 0; round < 8; round++) {
      const userId = 100 + round;
      await consent.setConsent(userId, 'professional_bridge', 'granted');
      const turn = await ChatTurn.create({ UserId: userId, requestId: `turn-${round}-0001`, status: 'completed', userContent: encriptarV2('Lideré el equipo de ventas sintético'), replyContent: encriptarV2('r') });
      const origins = [{ type: 'chat_turn', id: turn.id, quote: 'lideré el equipo' }];
      const outcomes = await Promise.allSettled([
        evidence.create(userId, body({}, 'confirmed', { origins })),
        consent.setConsent(userId, 'professional_bridge', 'revoked'),
      ]);
      assert.deepEqual(outcomes.filter((o) => o.status === 'rejected' && o.reason.code !== 'consent_required').map((o) => o.reason.message), []);
      assert.equal(await Version.count({ where: { UserId: userId, status: 'confirmed', hasChatOrigin: true } }), 0, `ronda ${round}`);
      assert.deepEqual((await evidence.getConfirmedEvidence(userId, 'pg-engine')).filter((e) => e.version), []);
    }
  });

  await t.test('una revocación durante una lectura del motor espera a que termine y después no se entrega evidencia del chat', async () => {
    const userId = 200;
    await consent.setConsent(userId, 'professional_bridge', 'granted');
    const turn = await ChatTurn.create({ UserId: userId, requestId: 'turn-read-0001', status: 'completed', userContent: encriptarV2('Coordiné el proyecto sintético'), replyContent: encriptarV2('r') });
    await evidence.create(userId, body({}, 'confirmed', { origins: [{ type: 'chat_turn', id: turn.id }] }));
    assert.equal((await evidence.getConfirmedEvidence(userId, 'pg-engine')).length, 1);
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
    assert.deepEqual(await evidence.getConfirmedEvidence(userId, 'pg-engine'), []);
    assert.equal(await Invalidation.count({ where: { UserId: userId, sourceType: 'evidence', reason: 'revoked' } }), 1);
  });

  await t.test('borrar vacía el contenido en la base y lo derivado queda invalidado', async () => {
    const created = await evidence.create(4, body({ situation: 'Texto que debe desaparecer' }));
    await evidence.remove(4, created.id);
    const rows = await sequelize.query(`SELECT payload FROM "EvidenceVersions" WHERE "EvidenceId" = :id`, { replacements: { id: created.id }, type: 'SELECT' });
    assert.ok(rows.length >= 1);
    for (const row of rows) assert.doesNotMatch(row.payload, /desaparecer/);
    await assert.rejects(evidence.get(4, created.id), (e) => e.code === 'evidence_not_found');
  });
});
