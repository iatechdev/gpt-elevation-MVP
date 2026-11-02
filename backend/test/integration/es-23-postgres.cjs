// Explicit integration command. Creates/drops ONLY its own random database on a loopback test server.
// Never loads .env, never uses DATABASE_URL, and never calls an external provider.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('ES-23 PostgreSQL: migration, ownership, concurrent publication/deletion, rollback and restore replay', { timeout: 60000 }, async t => {
  const source = process.env.ES23_TEST_DATABASE_URL;
  assert.ok(source, 'ES23_TEST_DATABASE_URL must explicitly identify a disposable local PostgreSQL server.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Only loopback PostgreSQL is allowed.');
  const dbName = `es23_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es23_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize;
  let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    // dbName is generated above, never supplied or derived from a user's database name.
    if (created) await admin.query(`DROP DATABASE "${dbName}"`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };

  const { up } = require('../../migrations/20261026-es23-data-rights.cjs');
  await up(sequelize);
  await up(sequelize); // repeat application is additive/idempotent
  require('../../associations')();
  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation',
    'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'AiUsage', 'AiBudgetCounter', 'CareerContextVersion', 'BridgeTransfer', 'Evidence', 'EvidenceVersion', 'ParticipantContext', 'ParticipantResume', 'SkillAssessment']) require('../../' + name);
  for (const name of ['RouteConstraintsVersion', 'RouteChoice', 'RouteReviewRequest']) require('../../' + name);
  for (const name of ['CareerExperiment', 'CareerExperimentVersion', 'CareerPlanVersion', 'CareerExperimentReview', 'CareerReminder']) require('../../' + name);
  await sequelize.sync();
  const rights = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor');
  const { withConsent, hasConsent } = require('../../utils/consent');
  const { sessionProblem } = require('../../utils/sessions');
  const { encriptarV2 } = require('../../utils/crypto');
  const User = require('../../User');
  const Message = require('../../message');
  const Consent = require('../../Consent');
  const DiaryEntry = require('../../DiaryEntry');
  const DeletionRequest = require('../../DeletionRequest');
  const addUser = () => User.create({ name: 'Synthetic', email: `${randomBytes(6).toString('hex')}@example.invalid`,
    password: 'synthetic-not-a-real-password', active: true, role: 'user' });
  const grant = user => Consent.create({ UserId: user.id, purpose: 'professional_bridge', scope: 'default', status: 'granted', version: 1, decidedAt: new Date() });
  async function waitForLock(table) {
    const deadline = Date.now() + 5000;
    do {
      const [rows] = await sequelize.query(`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event_type = 'Lock' AND query LIKE :table
      ) AS waiting`, { replacements: { table: `%"${table}"%` } });
      if (rows[0].waiting) return;
      await wait(20);
    } while (Date.now() < deadline);
    assert.fail(`No observed PostgreSQL lock wait on ${table}`);
  }

  await t.test('real migration matches ORM; preview/download are exact and owner-scoped', async () => {
    const a = await addUser(); const b = await addUser();
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('A private synthetic') });
    await Message.create({ UserId: b.id, role: 'user', content: encriptarV2('B PRIVATE CANARY') });
    const p = await rights.preview(a.id, { type: 'personal', locale: 'en' });
    assert.equal(p.data.messages[0].content, 'A private synthetic');
    assert.doesNotMatch(JSON.stringify(p), /B PRIVATE CANARY|synthetic-not-a-real-password/);
    assert.deepEqual(await rights.download(a.id, p.id, data => data), p.data);
    await assert.rejects(rights.download(b.id, p.id, () => assert.fail('foreign publication')), { code: 'export_not_found' });
    await Message.create({ UserId: a.id, role: 'assistant', content: encriptarV2('new reply') });
    await assert.rejects(rights.download(a.id, p.id, () => assert.fail('outdated publication')), { code: 'export_outdated' });
  });

  await t.test('deletion waits for an authorized download to publish; accepted deletion prevents every subsequent download', async () => {
    const a = await addUser();
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    const entered = deferred(); const release = deferred(); const events = [];
    const downloading = rights.download(a.id, p.id, async () => {
      entered.resolve(); await release.promise; events.push('published');
    });
    await entered.promise;
    const deleting = rights.requestDeletion(a.id).then(r => { events.push('accepted'); return r; });
    try { await waitForLock('Users'); } finally { release.resolve(); }
    await downloading;
    await deleting;
    assert.deepEqual(events, ['published', 'accepted']);
    await assert.rejects(rights.download(a.id, p.id, () => assert.fail('revoked publication')), { code: 'deletion_pending' });
  });

  await t.test('existing consent consumers finish before acceptance; repeated concurrent requests have one durable receipt', async () => {
    const a = await addUser(); await grant(a);
    const entered = deferred(); const release = deferred();
    const consumer = withConsent(a.id, 'professional_bridge', async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    const deleting = rights.requestDeletion(a.id);
    try { await waitForLock('Consents'); } finally { release.resolve(); }
    await consumer;
    const initial = await deleting;
    const repeats = await Promise.all([rights.requestDeletion(a.id), rights.requestDeletion(a.id)]);
    assert.ok(repeats.every(r => r.id === initial.id && r.repeated));
    assert.equal(await DeletionRequest.count({ where: { UserId: a.id } }), 1);
    assert.equal(await hasConsent(a.id, 'professional_bridge'), false);
    await assert.rejects(withConsent(a.id, 'professional_bridge', () => assert.fail('deleted owner')));
  });

  await t.test('SQL failure rolls back purge; retry preserves the other owner; restored records are purged again', async () => {
    const a = await addUser(); const b = await addUser();
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('A synthetic') });
    await Message.create({ UserId: b.id, role: 'user', content: encriptarV2('B synthetic') });
    await DiaryEntry.create({ UserId: a.id, entryDate: '2026-10-01', content: encriptarV2('diary') });
    const request = await rights.requestDeletion(a.id);
    await sequelize.query(`CREATE FUNCTION es23_inject_failure() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'synthetic purge failure'; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es23_inject_failure BEFORE DELETE ON "DiaryEntries"
      FOR EACH ROW EXECUTE FUNCTION es23_inject_failure()`);
    await assert.rejects(processDeletion(request.id, { quiescent: true }), /can be retried/);
    assert.equal(await Message.count({ where: { UserId: a.id } }), 1);
    assert.equal((await DeletionRequest.findByPk(request.id)).status, 'failed');
    await sequelize.query('DROP TRIGGER es23_inject_failure ON "DiaryEntries"');
    const result = await processDeletion(request.id, { quiescent: true });
    assert.equal(result.status, 'awaiting_verification');
    assert.equal(await Message.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Message.count({ where: { UserId: b.id } }), 1);
    await User.update({ active: true, email: 'restored@example.invalid' }, { where: { id: a.id } });
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('RESTORED PRIVATE') });
    assert.equal(await sessionProblem({ id: a.id, jti: 'synthetic-fresh', iat: Date.now() / 1000 }), 'deletion_pending');
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await Message.count({ where: { UserId: a.id } }), 0);
    assert.equal((await User.findByPk(a.id)).active, false);
  });

  await t.test('QA-23-03: 40 vistas previas simultáneas del mismo dueño dejan una sola fila y la misma vista previa', async () => {
    const a = await addUser();
    await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('mensaje sintético') });
    const ExportRequest = require('../../ExportRequest');
    const results = await Promise.all(Array.from({ length: 40 }, () => rights.preview(a.id, { type: 'personal', locale: 'es' })));
    assert.equal(new Set(results.map((r) => r.id)).size, 1);
    assert.equal(results.filter((r) => !r.reused).length, 1);
    assert.equal(await ExportRequest.count({ where: { UserId: a.id } }), 1);
  });

  await t.test('QA-23-04: descarga y aceptación del borrado a la vez, en varias rondas: nunca un error genérico, solo entrega o deletion_pending', async () => {
    for (let round = 0; round < 12; round++) {
      const a = await addUser();
      await Message.create({ UserId: a.id, role: 'user', content: encriptarV2('texto sintético ' + round) });
      const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
      const outcomes = await Promise.allSettled([rights.download(a.id, p.id, (data) => data), rights.requestDeletion(a.id)]);
      const unexpected = outcomes.filter((o) => o.status === 'rejected' && !['deletion_pending', 'export_not_found'].includes(o.reason.code));
      assert.deepEqual(unexpected.map((o) => o.reason.message), [], 'ronda ' + round);
      assert.equal(outcomes[1].status, 'fulfilled');
      // tras aceptar el borrado ninguna descarga nueva empieza
      await assert.rejects(rights.download(a.id, p.id, () => assert.fail('descarga tras el borrado')), { code: 'deletion_pending' });
    }
  });

  await t.test('QA-H1: el uso de IA y el contador de presupuesto se exportan sin contenido y se purgan; la cohorte y B no se tocan', async () => {
    const AiUsage = require('../../AiUsage');
    const AiBudgetCounter = require('../../AiBudgetCounter');
    const a = await addUser(); const b = await addUser();
    await AiUsage.create({ UserId: a.id, kind: 'chat', model: 'm', periodKey: '2026-10', status: 'completed', reservedTokens: 10, inputTokens: 4, outputTokens: 3 });
    await AiUsage.create({ UserId: b.id, kind: 'chat', model: 'm', periodKey: '2026-10', status: 'completed', reservedTokens: 10 });
    await AiBudgetCounter.create({ UserId: a.id, periodKey: '2026-10', used: 7 });
    await AiBudgetCounter.create({ UserId: 0, periodKey: '2026-10', used: 77 });
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    assert.deepEqual(p.data.aiUsage.map((u) => [u.kind, u.inputTokens]), [['chat', 4]]);
    assert.deepEqual(p.data.aiBudget.map((x) => x.used), [7]);
    const request = await rights.requestDeletion(a.id);
    await processDeletion(request.id, { quiescent: true });
    assert.equal(await AiUsage.count({ where: { UserId: a.id } }), 0);
    assert.equal(await AiUsage.count({ where: { UserId: b.id } }), 1);
    assert.equal(await AiBudgetCounter.count({ where: { UserId: a.id } }), 0);
    assert.equal((await AiBudgetCounter.findOne({ where: { UserId: 0, periodKey: '2026-10' } })).used, 77);
  });
  await t.test('QA-25-03: el puente profesional y su auditoría se exportan descifrados al dueño, se purgan con el procesador y el --replay los borra tras una restauración', async () => {
    const CareerContextVersion = require('../../CareerContextVersion');
    const BridgeTransfer = require('../../BridgeTransfer');
    const a = await addUser(); const b = await addUser();
    const payload = (text) => encriptarV2(JSON.stringify([{ key: 'values', text }]));
    const version = (user, text, requestId) => CareerContextVersion.create({ UserId: user.id, version: 1, status: 'active', payload: payload(text), origins: [], consentVersion: null, requestId, approvedAt: new Date() });
    await version(a, 'Valoro aprender (A)', 'req-pg-a-0001'); await version(b, 'B BRIDGE CANARY', 'req-pg-b-0001');
    await BridgeTransfer.create({ UserId: a.id, version: 1, keys: ['values'], hash: 'a'.repeat(64), consumer: 'routes' });
    await BridgeTransfer.create({ UserId: b.id, version: 1, keys: ['values'], hash: 'b'.repeat(64), consumer: 'B-CONSUMER-CANARY' });
    const [raw] = await sequelize.query('SELECT payload FROM "CareerContextVersions" WHERE "UserId" = :id', { replacements: { id: a.id }, type: 'SELECT' });
    assert.match(raw.payload, /^v2:/); // cifrado real
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    assert.deepEqual([p.data.careerContext.length, p.data.careerContext[0].payload[0].text, p.data.bridgeTransfers.length], [1, 'Valoro aprender (A)', 1]);
    assert.doesNotMatch(JSON.stringify(p.data), /B BRIDGE CANARY|B-CONSUMER-CANARY/);
    const request = await rights.requestDeletion(a.id);
    await processDeletion(request.id, { quiescent: true });
    assert.equal(await CareerContextVersion.count({ where: { UserId: a.id } }), 0);
    assert.equal(await BridgeTransfer.count({ where: { UserId: a.id } }), 0);
    assert.equal(await CareerContextVersion.count({ where: { UserId: b.id } }), 1);
    assert.equal(await BridgeTransfer.count({ where: { UserId: b.id } }), 1);
    await version(a, 'RESTORED PRIVATE', 'req-pg-a-0002');
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await CareerContextVersion.count({ where: { UserId: a.id } }), 0);
  });
  await t.test('QA-25-03: la evidencia profesional se exporta descifrada al dueño (sin las borradas), se purga con el procesador y el --replay la borra tras una restauración', async () => {
    const evidence = require('../../utils/evidence');
    const Evidence = require('../../Evidence');
    const EvidenceVersion = require('../../EvidenceVersion');
    const a = await addUser(); const b = await addUser();
    const body = (title) => ({ payload: { title, situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false } }, status: 'confirmed', requestId: `pg-ev-${randomBytes(6).toString('hex')}` });
    const kept = await evidence.create(a.id, body('Evidencia A'));
    const removed = await evidence.create(a.id, body('Evidencia A borrada'));
    await evidence.remove(a.id, removed.id);
    await evidence.create(b.id, body('B EVIDENCE CANARY'));
    const [raw] = await sequelize.query('SELECT payload FROM "EvidenceVersions" WHERE "EvidenceId" = :id', { replacements: { id: kept.id }, type: 'SELECT' });
    assert.match(raw.payload, /^v2:/); // cifrado real
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    assert.deepEqual(p.data.evidence.map((e) => e.id), [kept.id]); // la borrada no aparece
    assert.deepEqual(p.data.evidenceVersions.map((v) => v.payload.title), ['Evidencia A']); // descifrada y sin la versión vaciada de la borrada
    assert.doesNotMatch(JSON.stringify(p.data), /B EVIDENCE CANARY|borrada/);
    const request = await rights.requestDeletion(a.id);
    await processDeletion(request.id, { quiescent: true });
    assert.equal(await Evidence.count({ where: { UserId: a.id } }), 0);
    assert.equal(await EvidenceVersion.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Evidence.count({ where: { UserId: b.id } }), 1);
    await evidence.create(a.id, body('RESTORED PRIVATE')).catch(() => {}); // tras el borrado la cuenta ya no puede crear; se simula la restauración con filas directas
    const restored = await Evidence.create({ UserId: a.id, currentVersion: 1 });
    await EvidenceVersion.create({ EvidenceId: restored.id, UserId: a.id, version: 1, status: 'draft', payload: encriptarV2(JSON.stringify({ title: 'RESTORED PRIVATE' })), origins: [], hasChatOrigin: false, requestId: `pg-restored-${randomBytes(4).toString('hex')}` });
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await Evidence.count({ where: { UserId: a.id } }), 0);
    assert.equal(await EvidenceVersion.count({ where: { UserId: a.id } }), 0);
  });
  await t.test('QA-14-01: el contexto del participante se exporta descifrado al dueño, se purga con el procesador y el --replay lo borra tras una restauración (FK real)', async () => {
    const ParticipantContext = require('../../ParticipantContext');
    const a = await addUser(); const b = await addUser();
    const dto = (profession) => encriptarV2(JSON.stringify({ preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession, interests: null, availabilityMinutesPerWeek: 60, careerGoal: null, careerConstraints: null }));
    await ParticipantContext.create({ UserId: a.id, version: 2, content: dto('Contabilidad sintética A'), completedAt: new Date() });
    await ParticipantContext.create({ UserId: b.id, version: 1, content: dto('B PROFESSION CANARY'), completedAt: null });
    const [raw] = await sequelize.query('SELECT content FROM "ParticipantContexts" WHERE "UserId" = :id', { replacements: { id: a.id }, type: 'SELECT' });
    assert.match(raw.content, /^v2:/); // cifrado real en la base
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    assert.deepEqual([p.data.participantContext.length, p.data.participantContext[0].version, p.data.participantContext[0].content.profession], [1, 2, 'Contabilidad sintética A']);
    assert.doesNotMatch(JSON.stringify(p.data), /B PROFESSION CANARY/);
    const request = await rights.requestDeletion(a.id);
    assert.equal(await ParticipantContext.count({ where: { UserId: a.id } }), 1); // aceptar la solicitud no purga: la purga es el procesador
    await processDeletion(request.id, { quiescent: true });
    assert.equal(await ParticipantContext.count({ where: { UserId: a.id } }), 0);
    assert.equal(await ParticipantContext.count({ where: { UserId: b.id } }), 1);
    assert.equal(await User.count({ where: { id: a.id } }), 1); // la fila del usuario se pseudonimiza, no se borra: el CASCADE no habría bastado
    await ParticipantContext.create({ UserId: a.id, version: 2, content: dto('RESTORED PRIVATE'), completedAt: null });
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await ParticipantContext.count({ where: { UserId: a.id } }), 0);
  });
  await t.test('QA-25-03: las evaluaciones del Skill Map se exportan con la justificación descifrada, se purgan con el procesador y el --replay las borra tras una restauración', async () => {
    const SkillAssessment = require('../../SkillAssessment');
    const a = await addUser(); const b = await addUser();
    const make = (user, over = {}) => SkillAssessment.create({ UserId: user.id, skillKey: 'communication', track: 'self', level: 3, state: 'initial', catalogVersion: 1, rubricHash: 'f'.repeat(64), evidenceRefs: [], confidence: 'low', confidenceReasonCode: 'no_evidence', confidenceRuleVersion: 1, authoring: 'person', status: 'current', requestId: 'req-pg-sk-' + randomBytes(6).toString('hex'), ...over });
    await make(a, { rationale: encriptarV2('Justificación sintética (A)') }); await make(b, { rationale: encriptarV2('B SKILL CANARY') });
    const [raw] = await sequelize.query('SELECT rationale FROM "SkillAssessments" WHERE "UserId" = :id', { replacements: { id: a.id }, type: 'SELECT' });
    assert.match(raw.rationale, /^v2:/); // cifrado real en la base
    const p = await rights.preview(a.id, { type: 'personal', locale: 'es' });
    assert.deepEqual([p.data.skillAssessments.length, p.data.skillAssessments[0].rationale, 'rubricHash' in p.data.skillAssessments[0]], [1, 'Justificación sintética (A)', false]);
    assert.doesNotMatch(JSON.stringify(p.data), /B SKILL CANARY/);
    const request = await rights.requestDeletion(a.id);
    assert.equal(await SkillAssessment.count({ where: { UserId: a.id } }), 1); // aceptar la solicitud no purga: la purga es el procesador
    await processDeletion(request.id, { quiescent: true });
    assert.equal(await SkillAssessment.count({ where: { UserId: a.id } }), 0);
    assert.equal(await SkillAssessment.count({ where: { UserId: b.id } }), 1);
    await make(a, { rationale: encriptarV2('RESTORED PRIVATE') });
    await processDeletion(request.id, { quiescent: true, replay: true });
    assert.equal(await SkillAssessment.count({ where: { UserId: a.id } }), 0);
  });
});
