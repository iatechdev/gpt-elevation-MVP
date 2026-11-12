// ES-229 contra PostgreSQL REAL: retirar un permiso `insights_*` marca «para revisión» lo derivado de esa fuente (privacidad), en la misma
// transacción, sin borrar lo confirmado, sin cruce entre personas, de forma idempotente y concurrente; el profesional pierde esos textos en la siguiente lectura.
// Crea y borra SOLO su propia base aleatoria en loopback. Nunca carga .env ni llama a un proveedor externo.
// Uso (en backend/):  ES229_TEST_DATABASE_URL=postgres://... npm run test:insights-revoke:pg   (o  node scripts/testEs229Local.cjs)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-229 PostgreSQL: retirar insights_* marca para revisión lo derivado de esa fuente', { timeout: 120000 }, async (t) => {
  const source = process.env.ES229_TEST_DATABASE_URL;
  assert.ok(source, 'ES229_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es229_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es229_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo
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

  for (const name of ['Consent', 'ConsentEvent', 'DiaryEntry', 'ChatTurn', 'DerivedInvalidation', 'CareerContextVersion', 'BridgeTransfer', 'DeletionRequest', 'Evidence', 'EvidenceVersion', 'PricingPlan', 'User', 'AiJob', 'SkillCandidate', 'ParticipantResume']) require('../../' + name);
  await sequelize.sync();
  const bridge = require('../../utils/careerContext');
  const consent = require('../../utils/consent');
  const Version = require('../../CareerContextVersion');
  const Invalidation = require('../../DerivedInvalidation');
  const Transfer = require('../../BridgeTransfer');
  const Diary = require('../../DiaryEntry');
  const Turn = require('../../ChatTurn');
  const { encriptarV2 } = require('../../utils/crypto');

  const diaryEntry = (userId) => Diary.create({ UserId: userId, entryDate: '2026-10-01', content: encriptarV2('diario sintético') });
  const turn = (userId, n) => Turn.create({ UserId: userId, requestId: `turn-${userId}-${n}-aaaa`, status: 'completed', userContent: encriptarV2('mensaje sintético'), replyContent: encriptarV2('respuesta sintética') });
  const confirm = async (userId, fields, requestId) => {
    const preview = await bridge.preview(userId, { fields });
    return bridge.confirm(userId, { fields, token: preview.token, requestId });
  };
  const grant = async (userId, ...purposes) => { for (const p of purposes) await consent.setConsent(userId, p, 'granted'); };
  const delivered = async (userId) => (await bridge.getApprovedContext(userId, 'pg-engine')).fields.map((f) => f.text);

  // Persona 1: un texto directo, uno del diario y uno del chat.
  await grant(1, 'professional_bridge', 'insights_diary', 'insights_chat');
  const d1 = await diaryEntry(1); const c1 = await turn(1, 1);
  const fields1 = [
    { key: 'motivations', text: 'Texto directo' },
    { key: 'values', text: 'Texto del diario', origin: { type: 'diary_entry', id: d1.id } },
    { key: 'interests', text: 'Texto del chat', origin: { type: 'chat_turn', id: c1.id } },
  ];
  await confirm(1, fields1, 'req-es229-p1-0001');
  assert.deepEqual(await delivered(1), ['Texto directo', 'Texto del diario', 'Texto del chat']);

  // Persona 2 (A/B): misma estructura; su revocación no toca a la persona 1 ni al revés.
  await grant(2, 'professional_bridge', 'insights_diary');
  const d2 = await diaryEntry(2);
  await confirm(2, [{ key: 'values', text: 'Diario de B', origin: { type: 'diary_entry', id: d2.id } }, { key: 'motivations', text: 'Directo de B' }], 'req-es229-p2-0001');

  await t.test('(1) retirar el diario marca «para revisión» solo lo del diario; el profesional deja de recibirlo en la siguiente lectura; lo confirmado no se borra', async () => {
    const before = await Version.findOne({ where: { UserId: 1, status: 'active' } });
    const payloadBefore = before.payload;
    await consent.setConsent(1, 'insights_diary', 'revoked');
    assert.deepEqual(await delivered(1), ['Texto directo', 'Texto del chat']);
    const record = (await bridge.list(1)).active;
    assert.equal(record.needsReview, true); assert.equal(record.reviewReason, 'source_revoked');
    assert.deepEqual(record.fields.map((f) => f.text), ['Texto directo', 'Texto del diario', 'Texto del chat'], 'lo confirmado sigue en la versión de la persona');
    const after = await Version.findOne({ where: { UserId: 1, status: 'active' } });
    assert.equal(after.id, before.id); assert.equal(after.status, 'active'); assert.equal(after.payload, payloadBefore, 'el contenido cifrado no se reescribe');
    assert.equal(await Invalidation.count({ where: { UserId: 1, reason: 'source_revoked' } }), 1);
    // la marca privada nunca sale al cliente ni al motor
    assert.doesNotMatch(JSON.stringify(record), /sourceRevokedAt/);
  });

  await t.test('(2) usuarios A/B: la revocación de la persona 1 no cambia nada de la persona 2', async () => {
    assert.deepEqual(await delivered(2), ['Diario de B', 'Directo de B']);
    assert.equal((await bridge.list(2)).active.needsReview, false);
    assert.equal(await Invalidation.count({ where: { UserId: 2, reason: 'source_revoked' } }), 0);
    await consent.setConsent(2, 'insights_diary', 'revoked');
    assert.deepEqual(await delivered(2), ['Directo de B']);
    assert.deepEqual(await delivered(1), ['Texto directo', 'Texto del chat'], 'la persona 1 sigue igual');
  });

  await t.test('(3) revocar dos veces, o a la vez, no duplica registros ni marcas', async () => {
    await consent.setConsent(1, 'insights_diary', 'revoked'); // segunda vez: sin cambio
    assert.equal(await Invalidation.count({ where: { UserId: 1, reason: 'source_revoked' } }), 1);
    await consent.setConsent(1, 'insights_chat', 'granted');
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => consent.setConsent(1, 'insights_chat', 'revoked')));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => String(r.reason && r.reason.message)), []);
    assert.equal(await Invalidation.count({ where: { UserId: 1, reason: 'source_revoked' } }), 2, 'una por fuente retirada, no una por intento');
    assert.deepEqual(await delivered(1), ['Texto directo']);
    const origins = (await Version.findOne({ where: { UserId: 1, status: 'active' } })).origins;
    assert.equal(origins.filter((o) => o.sourceRevokedAt).length, 2);
  });

  await t.test('(4) volver a otorgar el permiso NO limpia la marca; reconfirmar crea una versión nueva y vigente', async () => {
    await consent.setConsent(1, 'insights_diary', 'granted');
    await consent.setConsent(1, 'insights_chat', 'granted'); // ES-233: reconfirmar un texto del chat exige también el permiso del chat
    assert.deepEqual(await delivered(1), ['Texto directo'], 'sigue en revisión hasta que la persona reconfirme');
    assert.equal((await bridge.list(1)).active.needsReview, true);
    await confirm(1, fields1, 'req-es229-p1-0002');
    const active = (await bridge.list(1)).active;
    assert.equal(active.version, 2); assert.equal(active.needsReview, false);
    assert.deepEqual(await delivered(1), ['Texto directo', 'Texto del diario', 'Texto del chat']);
    assert.equal((await Version.findOne({ where: { UserId: 1, version: 1 } })).status, 'superseded');
  });

  await t.test('(5) si todo lo derivado venía de la fuente retirada, el profesional no recibe nada (404 no_context) y no se registra una entrega', async () => {
    await grant(3, 'professional_bridge', 'insights_diary');
    const d3 = await diaryEntry(3);
    await confirm(3, [{ key: 'values', text: 'Solo diario', origin: { type: 'diary_entry', id: d3.id } }], 'req-es229-p3-0001');
    assert.deepEqual(await delivered(3), ['Solo diario']);
    const transfers = await Transfer.count({ where: { UserId: 3 } });
    await consent.setConsent(3, 'insights_diary', 'revoked');
    await assert.rejects(() => bridge.getApprovedContext(3, 'pg-engine'), (error) => error.status === 404 && error.code === 'no_context');
    assert.equal(await Transfer.count({ where: { UserId: 3 } }), transfers);
  });

  await t.test('(6) retirar una fuente que ningún texto usa, o un permiso que no es insights_*, no marca nada', async () => {
    await grant(4, 'professional_bridge', 'insights_resume', 'insights_chat', 'research');
    await confirm(4, [{ key: 'motivations', text: 'Solo directo' }], 'req-es229-p4-0001');
    await consent.setConsent(4, 'insights_resume', 'revoked');
    await consent.setConsent(4, 'research', 'revoked');
    assert.equal((await bridge.list(4)).active.needsReview, false);
    assert.equal(await Invalidation.count({ where: { UserId: 4, reason: 'source_revoked' } }), 0);
    assert.deepEqual(await delivered(4), ['Solo directo']);
  });

  await t.test('(7) una versión retirada o sustituida no se toca', async () => {
    const old = await Version.findOne({ where: { UserId: 1, version: 1 } });
    assert.equal(old.status, 'superseded');
    assert.equal((old.origins || []).filter((o) => o.sourceRevokedAt).length, 2, 'la marca de la versión sustituida queda como historia');
  });
});
