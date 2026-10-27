// Integración ES-23 + ES-25 + ES-27 contra Postgres REAL (QA-25-02): revocar `professional_bridge` debe, en UNA transacción, (1) revocar la
// versión del puente, (2) dejar sin vigencia la evidencia confirmada que sale del chat con su invalidación, y (3) respetar la guarda de
// eliminación de cuenta. Crea y borra SOLO su propia base aleatoria en un servidor de loopback; nunca carga .env ni sale a internet.
// Uso (en backend/):  ES_INTEG_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:integration:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('Integración ES-23/25/27 en PostgreSQL: revocar el puente actúa en las tres piezas a la vez y respeta la guarda de eliminación', { timeout: 90000 }, async (t) => {
  const source = process.env.ES_INTEG_TEST_DATABASE_URL;
  assert.ok(source, 'ES_INTEG_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `esinteg_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^esinteg_test_[a-f0-9]{16}$/);
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

  require('../../associations')();
  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'ExportRequest', 'DeletionRequest', 'RevokedToken', 'AuthRevocation',
    'CareerContextVersion', 'BridgeTransfer', 'Evidence', 'EvidenceVersion']) require('../../' + name);
  await sequelize.sync();
  const consent = require('../../utils/consent');
  const bridge = require('../../utils/careerContext');
  const evidence = require('../../utils/evidence');
  const rights = require('../../utils/dataRights');
  const User = require('../../User');
  const ChatTurn = require('../../ChatTurn');
  const Bridge = require('../../CareerContextVersion');
  const EvVersion = require('../../EvidenceVersion');
  const Invalidation = require('../../DerivedInvalidation');
  const ConsentEvent = require('../../ConsentEvent');
  const { encriptarV2 } = require('../../utils/crypto');

  const addUser = () => User.create({ name: 'Synthetic', email: `${randomBytes(6).toString('hex')}@example.invalid`, password: 'synthetic-not-a-real-password', active: true, role: 'user' });
  let seq = 0;
  const rid = () => `integ-req-${String(++seq).padStart(6, '0')}`;
  const evBody = (origins) => ({
    payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false } },
    status: 'confirmed', requestId: rid(), origins,
  });
  async function setupPerson() {
    const user = await addUser();
    await consent.setConsent(user.id, 'professional_bridge', 'granted');
    const turn = await ChatTurn.create({ UserId: user.id, requestId: `turn-${seq++}-0001`, status: 'completed', userContent: encriptarV2('Dirigí el proyecto sintético con mi equipo durante tres meses.'), replyContent: encriptarV2('r') });
    const fields = [{ key: 'values', text: 'Valoro aprender', origin: { type: 'chat_turn', id: turn.id } }];
    const p = await bridge.preview(user.id, { fields });
    const version = await bridge.confirm(user.id, { fields, token: p.token, requestId: rid() });
    const ev = await evidence.create(user.id, evBody([{ type: 'chat_turn', id: turn.id, quote: 'durante tres meses' }]));
    return { user, turn, version, ev };
  }

  await t.test('revocar el puente: la versión del puente, la evidencia del chat y sus invalidaciones cambian juntas, y el consentimiento queda revocado', async () => {
    const { user, ev } = await setupPerson();
    assert.equal((await bridge.getApprovedContext(user.id, 'integ-engine')).fields.length, 1);
    assert.equal((await evidence.getConfirmedEvidence(user.id, 'integ-engine')).length, 1);
    await consent.setConsent(user.id, 'professional_bridge', 'revoked');
    assert.equal((await Bridge.findOne({ where: { UserId: user.id } })).status, 'revoked');
    assert.equal((await EvVersion.findOne({ where: { EvidenceId: ev.id } })).status, 'revoked');
    assert.equal(await Invalidation.count({ where: { UserId: user.id, sourceType: 'career_context_version', reason: 'revoked' } }), 1);
    assert.equal(await Invalidation.count({ where: { UserId: user.id, sourceType: 'evidence', reason: 'revoked' } }), 1);
    assert.equal((await ConsentEvent.findAll({ where: { UserId: user.id, purpose: 'professional_bridge' }, order: [['id', 'ASC']] })).at(-1).status, 'revoked');
    await assert.rejects(bridge.getApprovedContext(user.id, 'integ-engine'), (e) => e.code === 'no_context');
    assert.deepEqual(await evidence.getConfirmedEvidence(user.id, 'integ-engine'), []);
  });

  await t.test('atomicidad: si falla uno de los ganchos, NO se revoca nada (ni consentimiento, ni puente, ni evidencia, ni invalidaciones)', async () => {
    const { user, ev } = await setupPerson();
    await sequelize.query(`CREATE FUNCTION integ_inject_failure() RETURNS trigger AS $$
      BEGIN IF NEW.status = 'revoked' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER integ_inject_failure BEFORE UPDATE ON "EvidenceVersions" FOR EACH ROW EXECUTE FUNCTION integ_inject_failure()`);
    try {
      await assert.rejects(consent.setConsent(user.id, 'professional_bridge', 'revoked'));
    } finally {
      await sequelize.query('DROP TRIGGER integ_inject_failure ON "EvidenceVersions"');
      await sequelize.query('DROP FUNCTION integ_inject_failure()');
    }
    assert.equal(await consent.hasConsent(user.id, 'professional_bridge'), true); // el consentimiento sigue vigente
    assert.equal((await Bridge.findOne({ where: { UserId: user.id } })).status, 'active');
    assert.equal((await EvVersion.findOne({ where: { EvidenceId: ev.id } })).status, 'confirmed');
    assert.equal(await Invalidation.count({ where: { UserId: user.id, reason: 'revoked' } }), 0);
  });

  await t.test('guarda de eliminación (ES-23): con una solicitud de borrado aceptada ya no se puede volver a autorizar el puente ni confirmar nada con él', async () => {
    const { user, turn } = await setupPerson();
    await rights.requestDeletion(user.id);
    assert.equal(await consent.hasConsent(user.id, 'professional_bridge'), false); // revocado por la eliminación
    await assert.rejects(consent.setConsent(user.id, 'professional_bridge', 'granted'), (e) => e instanceof consent.ConsentRequiredError);
    const fields = [{ key: 'values', text: 'Valoro aprender', origin: { type: 'chat_turn', id: turn.id } }];
    await assert.rejects(bridge.preview(user.id, { fields }), (e) => e.code === 'consent_required');
    await assert.rejects(evidence.create(user.id, evBody([{ type: 'chat_turn', id: turn.id }])), (e) => e.code === 'consent_required');
    assert.equal((await User.findByPk(user.id)).active, false);
  });

  await t.test('carrera: confirmar puente y evidencia con origen del chat mientras se revoca el consentimiento no deja nada privado vigente (10 rondas)', async () => {
    for (let round = 0; round < 10; round++) {
      const user = await addUser();
      await consent.setConsent(user.id, 'professional_bridge', 'granted');
      const turn = await ChatTurn.create({ UserId: user.id, requestId: `race-${round}-0001`, status: 'completed', userContent: encriptarV2('Coordiné el equipo sintético durante seis meses.'), replyContent: encriptarV2('r') });
      const fields = [{ key: 'values', text: 'Valoro coordinar', origin: { type: 'chat_turn', id: turn.id } }];
      const p = await bridge.preview(user.id, { fields });
      const outcomes = await Promise.allSettled([
        bridge.confirm(user.id, { fields, token: p.token, requestId: rid() }),
        evidence.create(user.id, evBody([{ type: 'chat_turn', id: turn.id, quote: 'durante seis meses' }])),
        consent.setConsent(user.id, 'professional_bridge', 'revoked'),
      ]);
      assert.deepEqual(outcomes.filter((o) => o.status === 'rejected' && o.reason.code !== 'consent_required').map((o) => o.reason.message), [], 'ronda ' + round);
      assert.equal(await Bridge.count({ where: { UserId: user.id, status: 'active', consentVersion: 1 } }), 0, `ronda ${round}: puente privado vigente`);
      assert.equal(await EvVersion.count({ where: { UserId: user.id, status: 'confirmed', hasChatOrigin: true } }), 0, `ronda ${round}: evidencia del chat vigente`);
    }
  });
});
