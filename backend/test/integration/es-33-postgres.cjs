// PostgreSQL, HTTP, JWT, cifrado, evidencia, consentimiento y derechos reales.
// ÚNICOS puertos simulados: ES-14 disponibilidad/zona y ES-32 elección/ruta, aún no integrados en main.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');
test('ES-33 PostgreSQL + HTTP con puertos ES-14/32 simulados explícitos', { timeout: 180000 }, async t => {
  const source = process.env.ES33_TEST_DATABASE_URL; assert.ok(source, 'Configura solo PostgreSQL local desechable.');
  const target = new URL(source); assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  const name = `es33_test_${randomBytes(8).toString('hex')}`;
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } if (sequelize) await sequelize.close(); if (created) await admin.query(`DROP DATABASE "${name}"`); await admin.close(); });
  await admin.query(`CREATE DATABASE "${name}"`); created = true; target.pathname = '/' + name;
  // QA-33-01: el pool por defecto del backend es pequeño (5); un pool holgado esconde el agotamiento de conexiones.
  const poolMax = Number(process.env.ES33_TEST_POOL_MAX) || 5;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: poolMax, min: 0, acquire: 10000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const database = require.resolve('../../database'); require.cache[database] = { id: database, filename: database, loaded: true, exports: { sequelize } };
  require('../../associations')(); const { CORE } = require('../../utils/personalData');
  const names = ['CareerExperiment', 'CareerExperimentVersion', 'CareerPlanVersion', 'CareerExperimentReview', 'CareerReminder'];
  for (const [, model] of CORE) if (!names.includes(model)) require('../../' + model);
  for (const model of ['ProfessionalApplication', 'ProfessionalApplicationFile', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest']) require('../../' + model);
  await sequelize.sync();
  const migration = require('../../migrations/20261028-es33-career-plan.cjs'); await migration.up(sequelize); await migration.up(sequelize);
  for (const model of names) require('../../' + model); await sequelize.sync();
  const User = require('../../User'), Experiment = require('../../CareerExperiment'), Versions = require('../../CareerExperimentVersion'), Plans = require('../../CareerPlanVersion'), Reviews = require('../../CareerExperimentReview'), Reminders = require('../../CareerReminder');
  const { encriptarV2, desencriptar } = require('../../utils/crypto');
  const { context, route } = require('../es-33-fixture.cjs');
  const contracts = require('../../utils/careerPlanContracts'); const originalContracts = { ...contracts };
  const { problem } = require('../../utils/careerPlanRules');
  // Los puertos de ES-14 y ES-32 ya son REALES (están en main): ante un titular que no existe responden owner_required, no «contrato pendiente».
  // Esta prueba los sustituye más abajo por simulaciones solo para recorrer el ciclo de vida; la integración real está en es-33-integration-postgres.cjs.
  await assert.rejects(contracts.getContext(1), { code: 'owner_required' });
  await assert.rejects(contracts.getRoute(1, 1), { code: 'owner_required' });
  const users = {};
  for (const role of ['user', 'other', 'admin', 'therapist', 'board', 'superadmin']) users[role] = await User.create({ name: `SYNTHETIC ${role}`, email: `${role}@example.invalid`, password: randomBytes(32).toString('hex'), active: true, role: role === 'other' ? 'user' : role });
  const a = users.user, b = users.other, state = { routeVersion: 1, ruleVersion: 1, context: context(), capabilities: [{ skillKey: 'communication', importance: 'essential', tracks: [{ track: 'self', level: 2, evidenceCount: 1 }] }, { skillKey: 'analysis', importance: 'useful', tracks: [] }] };
  // QA-33-02: la ruta simulada lleva las capacidades y la versión de reglas de ES-32; routeVersion es el hash GLOBAL de ES-32, que ES-33 ya no usa.
  const routeOf = () => ({ ...route(), slot: 'continuity', dimensions: { demonstratedTransfer: { capabilities: structuredClone(state.capabilities) } } });
  const stubRoute = async (userId, choiceId) => { if (choiceId !== userId) throw problem('resource_not_found', 'No encontrado.', 'Not found.', 404); return { basisHash: `synthetic-${state.routeVersion}`, route: routeOf(), rules: { ruleVersion: state.ruleVersion, catalogVersion: 1, constraintsVersion: 1 } }; };
  contracts.getRoute = stubRoute;
  contracts.getContext = async () => structuredClone(state.context);
  const consent = require('../../utils/consent'), evidence = require('../../utils/evidence'), rights = require('../../utils/dataRights');
  const { processDeletion } = require('../../utils/deletionProcessor'); const { issueToken, revokeToken } = require('../../utils/sessions');
  const ev = await evidence.create(a.id, { requestId: randomUUID(), status: 'confirmed', payload: { title: 'SYNTHETIC professional sample', situation: 'Synthetic', responsibility: { text: 'Synthetic' }, actions: [{ text: 'Synthetic' }], delivered: { text: 'Synthetic' }, observedEffect: { known: false }, autonomy: 'assisted' } });
  const refs = [{ evidenceId: ev.id, version: 1 }];
  await require('../../message').create({ UserId: a.id, role: 'user', content: encriptarV2('PRIVATE_CHAT_CANARY') });
  await require('../../DiaryEntry').create({ UserId: a.id, entryDate: '2026-10-28', content: encriptarV2('PRIVATE_DIARY_CANARY') });
  const express = require('express'), app = express(); app.use(express.json()); const auth = require('../../middlewares/auth').verificarToken, routers = require('../../routes/careerPlan');
  app.use('/api/experiments', auth, routers.experiments); app.use('/api/career-plan', auth, routers.plans);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}/api`;
  const jwt = Object.fromEntries(Object.entries(users).map(([role, user]) => [role, issueToken(user)]));
  const http = async (path, { actor = 'user', method = 'GET', body, token } = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(actor === null ? {} : { Authorization: 'Bearer ' + (token || jwt[actor]) }), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.ok) assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data: await response.json() };
  };
  const propose = (actor = 'user') => http('/experiments/proposals', { actor, method: 'POST', body: { choiceId: users[actor].id, taskIndex: 0, minutes: 20 } });
  const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const selections = () => [7, 30, 90].map((horizon, i) => ({ actionKey: `step_${horizon}`, chosenDate: future([3, 20, 70][i]), estimatedMinutes: 20, resourceRefs: [] }));
  let experimentId, otherExperimentId, v = 1, planId, planBody, reminderId;
  const change = async (operation, expectedVersion = v) => { const response = await http(`/experiments/${experimentId}/versions`, { method: 'POST', body: { requestId: randomUUID(), expectedVersion, change: operation } }); if (response.status === 201) v = response.data.version.version; return response; };
  await t.test('migración repetible con once índices y FK compuestos: B no inserta versiones del contenedor de A', async () => {
    const indexes = await sequelize.query(`SELECT indexname FROM pg_indexes WHERE tablename IN ('CareerExperiments','CareerExperimentVersions','CareerPlanVersions','CareerExperimentReviews','CareerReminders') AND indexname LIKE 'career_%'`, { type: 'SELECT' }); assert.equal(indexes.length, 11);
    assert.equal(await User.count(), 6);
  });
  await t.test('propuesta firmada ES/EN sin persistencia; confirmación idempotente y manipulación/propietario bloqueados', async () => {
    const proposed = await propose(); assert.equal(proposed.status, 200); assert.equal(await Experiment.count(), 0);
    assert.ok(!JSON.stringify(proposed.data).includes('PRIVATE_')); assert.ok(proposed.data.proposal.content.title.es && proposed.data.proposal.content.title.en);
    const input = { requestId: randomUUID(), proposal: proposed.data.proposal, token: proposed.data.token };
    state.context.version++;
    assert.equal((await http('/experiments', { method: 'POST', body: input })).status, 409); state.context.version--;
    const modified = structuredClone(input); modified.proposal.minutes = 45; assert.equal((await http('/experiments', { method: 'POST', body: modified })).status, 409);
    assert.equal((await http('/experiments', { actor: 'other', method: 'POST', body: input })).status, 409);
    const first = await http('/experiments', { method: 'POST', body: input }); assert.equal(first.status, 201); experimentId = first.data.experimentId;
    assert.equal((await http('/experiments', { method: 'POST', body: input })).data.experimentId, experimentId);
    assert.equal((await http('/experiments', { method: 'POST', body: { ...input, token: 'changed' } })).status, 409);
    const next = await propose('other'); const other = await http('/experiments', { actor: 'other', method: 'POST', body: { requestId: randomUUID(), proposal: next.data.proposal, token: next.data.token } }); otherExperimentId = other.data.experimentId;
    await assert.rejects(Versions.create({ UserId: b.id, experimentId, version: 50, lifecycle: 'ready', payload: encriptarV2('{}'), basisHash: 'a'.repeat(64), requestId: randomUUID(), inputHash: 'a'.repeat(64) }), error => error.name === 'SequelizeForeignKeyConstraintError');
    assert.match((await Versions.findOne({ where: { UserId: a.id } })).payload, /^v2:/);
  });
  await t.test('token vencido no persiste una propuesta; no hay fallback ni dueño elegido por cliente', async () => {
    const now = Date.now;
    let response;
    try { Date.now = () => now() - 11 * 60000; response = await propose(); } finally { Date.now = now; }
    assert.equal(response.status, 200);
    const before = await Experiment.count();
    assert.equal((await http('/experiments', { method: 'POST', body: { requestId: randomUUID(), proposal: response.data.proposal, token: response.data.token } })).status, 409);
    assert.equal(await Experiment.count(), before);
  });
  await t.test('propiedad en cada recurso y rol actual: A/B 404, roles 403, sin sesión 403 y token revocado 401', async () => {
    assert.equal((await http(`/experiments/${experimentId}`, { actor: 'other' })).status, 404);
    assert.equal((await http('/experiments?UserId=' + b.id)).status, 400);
    for (const actor of ['admin', 'therapist', 'board', 'superadmin']) for (const [path, method, body] of [[`/experiments/${experimentId}`, 'GET'], ['/career-plan', 'GET'], ['/experiments/proposals', 'POST', { choiceId: a.id, taskIndex: 0, minutes: 20 }], ['/career-plan/reminders', 'POST', { requestId: randomUUID(), action: 'accept' }]])
      assert.equal((await http(path, { actor, method, body })).status, 403);
    assert.equal((await http('/experiments', { actor: null })).status, 403);
    await a.update({ role: 'admin' }); assert.equal((await http('/experiments')).status, 403); await a.update({ role: 'user' });
    const token = issueToken(a); await revokeToken(require('jsonwebtoken').decode(token)); assert.equal((await http('/experiments', { token })).status, 401);
    assert.equal((await http('/experiments/proposals', { method: 'POST', body: { choiceId: a.id, taskIndex: 0, minutes: 20, UserId: b.id } })).status, 400);
  });
  await t.test('versiones concurrentes y reintento: una modificación durable, sin pérdida de versión', async () => {
    const body = { requestId: randomUUID(), expectedVersion: 1, change: { action: 'start' } };
    const responses = await Promise.all(Array.from({ length: 3 }, () => http(`/experiments/${experimentId}/versions`, { method: 'POST', body })));
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 200, 201]); v = 2;
    assert.equal(await Versions.count({ where: { UserId: a.id } }), 2);
    assert.equal((await http(`/experiments/${experimentId}/versions`, { method: 'POST', body: { ...body, change: { action: 'reflect' } } })).status, 409);
    assert.equal((await change({ action: 'start' }, 1)).status, 409);
  });
  await t.test('entrega y reflexión propias conservan ayuda; referencias ajenas y suplantación humana rechazadas', async () => {
    assert.equal((await change({ action: 'submit', evidenceRefs: [{ evidenceId: 999999, version: 1 }], assistance: 'none' })).status, 422);
    assert.equal((await change({ action: 'submit', sample: 'SYNTHETIC SAMPLE', evidenceRefs: refs, assistance: 'drafting' })).status, 201);
    assert.equal((await change({ action: 'reflect', observation: 'SYNTHETIC observation', interpretation: 'SYNTHETIC interpretation' })).status, 201);
    assert.equal((await change({ action: 'human_review', reviewerId: a.id })).status, 400);
    const result = await http(`/experiments/${experimentId}`); assert.equal(result.data.current.payload.lifecycle, 'self_reviewed'); assert.equal(result.data.current.payload.submission.assistance.degree, 'drafting');
    assert.equal(await require('../../SkillAssessment').count({ where: { UserId: a.id } }), 0);
  });
  await t.test('revisión solicitada es pending_authorization y no comparte material; retirada propia sin permiso nuevo', async () => {
    const body = { requestId: randomUUID(), expectedVersion: v, action: 'request', submissionVersion: 3, evidenceRefs: refs, includeSample: true };
    const response = await http(`/experiments/${experimentId}/review-requests`, { method: 'POST', body }); assert.equal(response.status, 201); assert.equal(response.data.reviewRequest.status, 'pending_authorization'); assert.equal(response.data.reviewRequest.shared, false);
    assert.equal((await http(`/experiments/${experimentId}/review-requests`, { method: 'POST', body })).status, 200);
    assert.equal((await http(`/experiments/${experimentId}/review-requests`, { actor: 'other', method: 'POST', body })).status, 404);
    assert.equal((await http(`/experiments/${experimentId}/review-requests`, { method: 'POST', body: { ...body, reviewerId: users.admin.id } })).status, 400);
    assert.equal((await http(`/experiments/${experimentId}`)).data.humanReview.status, 'pending_authorization');
    const withdraw = { requestId: randomUUID(), expectedVersion: v, action: 'withdraw', reviewId: response.data.reviewRequest.id };
    assert.equal((await http(`/experiments/${experimentId}/review-requests`, { method: 'POST', body: withdraw })).status, 201);
    assert.equal((await http(`/experiments/${experimentId}`)).data.humanReview.status, 'not_requested');
  });
  await t.test('decisión razonada y propuesta 7/30/90: guardar solo acciones/fechas confirmadas', async () => {
    assert.equal((await change({ action: 'decide', decision: 'continue', reason: 'SYNTHETIC decision' })).status, 201);
    const response = await http('/career-plan/proposals', { method: 'POST', body: { experimentId, expectedVersion: v } }); assert.equal(response.status, 200);
    assert.equal(await Plans.count(), 0); assert.ok(response.data.proposal.actions.every(a => a.chosenDate === null));
    planBody = { requestId: randomUUID(), action: 'accept', expectedVersion: 0, proposal: response.data.proposal, token: response.data.token, selections: selections() };
    const saved = await http('/career-plan/versions', { method: 'POST', body: planBody }); assert.equal(saved.status, 201); planId = saved.data.plan.id;
    assert.equal((await http('/career-plan/versions', { method: 'POST', body: planBody })).data.plan.id, planId);
    assert.equal((await http(`/career-plan/versions/${planId}`, { actor: 'other' })).status, 404);
    for (const [path, method, body] of [
      [`/experiments/${experimentId}/versions`, 'POST', { requestId: randomUUID(), expectedVersion: v, change: { action: 'start' } }],
      [`/experiments/${experimentId}/review-requests`, 'GET'],
      ['/career-plan/proposals', 'POST', { experimentId, expectedVersion: v }],
      ['/career-plan/versions', 'POST', { requestId: randomUUID(), planId, expectedVersion: 1, action: 'complete', actionKey: 'step_7', completionEvidence: 'synthetic' }],
    ]) assert.equal((await http(path, { actor: 'other', method, body })).status, 404);
    assert.equal((await http('/career-plan/versions', { method: 'POST', body: { ...planBody, requestId: randomUUID(), expectedVersion: 1, selections: [{ ...selections()[0], chosenDate: '2026-02-30' }] } })).status, 400);
  });
  await t.test('recordatorios: sin consentimiento no activa; fecha ajena, falta de aceptación y dueño ajeno se rechazan', async () => {
    const reminder = { requestId: randomUUID(), action: 'accept', planVersionId: planId, actionKey: 'step_7', localDateTime: `${selections()[0].chosenDate}T09:00`, timeZone: context().timeZone, accepted: true };
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body: reminder })).status, 403);
    await consent.setConsent(a.id, 'notifications', 'granted');
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body: { ...reminder, accepted: false } })).status, 400);
    assert.equal((await http('/career-plan/reminders', { actor: 'other', method: 'POST', body: reminder })).status, 404);
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body: { ...reminder, timeZone: 'Europe/Copenhagen' } })).status, 400);
    const saved = await http('/career-plan/reminders', { method: 'POST', body: reminder }); assert.equal(saved.status, 201); reminderId = saved.data.reminder.id;
    assert.equal((await http('/career-plan/reminders', { actor: 'other', method: 'POST', body: { requestId: randomUUID(), action: 'cancel', reminderId } })).status, 404);
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body: reminder })).status, 200);
    assert.deepEqual((await http('/career-plan/reminders')).data.reminders, []); // futuro, GET no consume
  });
  await t.test('planes simultáneos comparten disponibilidad: rechaza sobrecarga y solo una aceptación gana con la misma base', async () => {
    const proposed = await propose();
    const created = await http('/experiments', { method: 'POST', body: { requestId: randomUUID(), proposal: proposed.data.proposal, token: proposed.data.token } });
    assert.equal(created.status, 201); const extraId = created.data.experimentId;
    let version = 1;
    for (const operation of [{ action: 'start' }, { action: 'submit', sample: 'Synthetic second trial', evidenceRefs: [], assistance: 'none' }, { action: 'reflect', observation: 'Synthetic', interpretation: 'Synthetic' }, { action: 'decide', decision: 'adjust', reason: 'Synthetic' }]) {
      const result = await http(`/experiments/${extraId}/versions`, { method: 'POST', body: { requestId: randomUUID(), expectedVersion: version, change: operation } });
      assert.equal(result.status, 201); version = result.data.version.version;
    }
    const response = await http('/career-plan/proposals', { method: 'POST', body: { experimentId: extraId, expectedVersion: version } }); assert.equal(response.status, 200);
    const envelope = { action: 'accept', expectedVersion: 0, proposal: response.data.proposal, token: response.data.token };
    const over = await http('/career-plan/versions', { method: 'POST', body: { ...envelope, requestId: randomUUID(), selections: selections().map(s => ({ ...s, estimatedMinutes: 45 })) } });
    assert.equal(over.status, 422); assert.equal(over.data.code, 'needs_scope_reduction');
    const responses = await Promise.all(Array.from({ length: 3 }, () => http('/career-plan/versions', { method: 'POST', body: { ...envelope, requestId: randomUUID(), selections: selections() } })));
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 409, 409]);
    assert.equal(await Plans.count({ where: { UserId: a.id, experimentId: extraId, status: 'accepted' } }), 1);
  });
  await t.test('GET pendiente no consume; acuse explícito idempotente entrega una vez, cero envíos externos', async () => {
    const row = await Reminders.findByPk(reminderId), data = JSON.parse(desencriptar(row.payload));
    // Avance sintético del vencimiento en DB de prueba; no espera real ni scheduler simulado.
    data.dueAt = new Date(Date.now() - 1000).toISOString(); await row.update({ payload: encriptarV2(JSON.stringify(data)) });
    assert.equal((await http('/career-plan/reminders')).data.reminders.length, 1); assert.equal((await http('/career-plan/reminders')).data.reminders.length, 1);
    const body = { requestId: randomUUID(), action: 'acknowledge', reminderId };
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body })).status, 201); assert.equal((await http('/career-plan/reminders', { method: 'POST', body })).status, 200);
    assert.deepEqual((await http('/career-plan/reminders')).data.reminders, []);
  });
  await t.test('revocar/reotorgar notificaciones no resucita recordatorio; cancelar/historial no exige nuevo permiso', async () => {
    const body = { requestId: randomUUID(), action: 'accept', planVersionId: planId, actionKey: 'step_30', localDateTime: `${selections()[1].chosenDate}T09:00`, timeZone: context().timeZone, accepted: true };
    const response = await http('/career-plan/reminders', { method: 'POST', body }); assert.equal(response.status, 201); const target = response.data.reminder.id;
    const row = await Reminders.findByPk(target), data = JSON.parse(desencriptar(row.payload)); data.dueAt = new Date(Date.now() - 1000).toISOString(); await row.update({ payload: encriptarV2(JSON.stringify(data)) });
    await consent.setConsent(a.id, 'notifications', 'revoked'); assert.equal((await http('/career-plan/reminders')).status, 403);
    assert.ok((await http('/career-plan/reminders?history=true')).data.reminders.length > 0);
    await consent.setConsent(a.id, 'notifications', 'granted'); assert.deepEqual((await http('/career-plan/reminders')).data.reminders, []);
    await consent.setConsent(a.id, 'notifications', 'revoked');
    assert.equal((await http('/career-plan/reminders', { method: 'POST', body: { requestId: randomUUID(), action: 'cancel', reminderId: target } })).status, 201);
  });
  await t.test('revocación concurrente espera el commit del recordatorio bajo withConsent', async () => {
    await consent.setConsent(a.id, 'notifications', 'granted');
    await sequelize.query(`CREATE FUNCTION es33_slow_reminder() RETURNS trigger AS $$ BEGIN PERFORM pg_sleep(0.5); RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es33_slow_reminder BEFORE INSERT ON "CareerReminders" FOR EACH ROW EXECUTE FUNCTION es33_slow_reminder()`);
    let accepting, revoking;
    try {
      accepting = http('/career-plan/reminders', { method: 'POST', body: { requestId: randomUUID(), action: 'accept', planVersionId: planId, actionKey: 'step_90', localDateTime: `${selections()[2].chosenDate}T09:00`, timeZone: context().timeZone, accepted: true } });
      const deadline = Date.now() + 4000;
      let insertionSeen = false;
      while (Date.now() < deadline) {
        const rows = await sequelize.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep' AND query LIKE 'INSERT INTO "CareerReminders"%'`, { type: 'SELECT' });
        if (rows.length) { insertionSeen = true; break; } await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(insertionSeen, 'observed insertion inside PostgreSQL trigger');
      revoking = consent.setConsent(a.id, 'notifications', 'revoked');
      let blocked = false;
      while (Date.now() < deadline) {
        const rows = await sequelize.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%"Consents"%'`, { type: 'SELECT' });
        if (rows.length) { blocked = true; break; } await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(blocked, 'revocation waits for the canonical consent lock');
      assert.equal((await accepting).status, 201); await revoking;
      assert.equal((await http('/career-plan/reminders')).status, 403);
    } finally { await Promise.allSettled([accepting, revoking].filter(Boolean)); await sequelize.query('DROP TRIGGER es33_slow_reminder ON "CareerReminders"'); }
  });
  await t.test('avanzar plan exige evidencia declarada y dependencia; versionar conserva historial y desactiva recordatorios antiguos', async () => {
    const body = { requestId: randomUUID(), action: 'complete', planId, expectedVersion: 1, actionKey: 'step_30', completionEvidence: 'Synthetic completion' };
    assert.equal((await http('/career-plan/versions', { method: 'POST', body })).status, 422);
    body.actionKey = 'step_7'; body.completionEvidence = true; assert.equal((await http('/career-plan/versions', { method: 'POST', body })).status, 400);
    body.completionEvidence = 'Synthetic completion'; const saved = await http('/career-plan/versions', { method: 'POST', body }); assert.equal(saved.status, 201);
    assert.equal((await http(`/career-plan/versions/${planId}`)).data.plan.status, 'superseded'); planId = saved.data.plan.id;
    assert.equal(saved.data.plan.payload.actions[0].completionEvidence.actual.source, 'self_report'); assert.equal(await require('../../SkillAssessment').count(), 0);
  });
  const makeEvidence = title => evidence.create(a.id, { requestId: randomUUID(), status: 'confirmed', payload: { title, situation: 'Synthetic', responsibility: { text: 'Synthetic' }, actions: [{ text: 'Synthetic' }], delivered: { text: 'Synthetic' }, observedEffect: { known: false }, autonomy: 'assisted' } });
  const basisOf = async () => (await http(`/experiments/${experimentId}`)).data.basis;
  const payloadOf = async () => (await http(`/experiments/${experimentId}`)).data.current.payload;
  await t.test('QA-33-02: solo la evidencia relevante cambia la base, y la razón se explica', async () => {
    state.context.version++; assert.deepEqual(await basisOf(), { status: 'needs_review', reasons: ['context_changed'] });
    assert.equal((await http(`/career-plan/versions/${planId}`)).data.plan.basis.status, 'needs_review');
    assert.equal((await change({ action: 'submit', sample: 'new sample', assistance: 'none' })).status, 409);
    state.context.version--; assert.deepEqual(await basisOf(), { status: 'current', reasons: [] });
    // Cambio GLOBAL de ES-32 (hash de todas las rutas) y evidencia confirmada que no toca esta ruta ni está citada: la base sigue vigente.
    state.routeVersion++; assert.deepEqual(await basisOf(), { status: 'current', reasons: [] }); state.routeVersion--;
    const unrelated = await makeEvidence('SYNTHETIC unrelated'); assert.ok(unrelated.id);
    assert.deepEqual(await basisOf(), { status: 'current', reasons: [] });
    assert.equal((await http(`/career-plan/versions/${planId}`)).data.plan.basis.status, 'current');
    assert.equal(await Versions.count({ where: { UserId: a.id, experimentId } }), v); // nada se versionó solo
    // Reglas, capacidades de la ruta y elección cambian la base con su propia razón; varias razones a la vez se listan todas.
    state.ruleVersion++; assert.deepEqual(await basisOf(), { status: 'needs_review', reasons: ['rules_changed'] }); state.ruleVersion--;
    state.capabilities[0].tracks[0].evidenceCount++; assert.deepEqual(await basisOf(), { status: 'needs_review', reasons: ['route_evidence_changed'] }); state.capabilities[0].tracks[0].evidenceCount--;
    state.capabilities[1].tracks.push({ track: 'review', level: 1, evidenceCount: 1 }); assert.deepEqual((await basisOf()).reasons, ['route_evidence_changed']); state.capabilities[1].tracks.pop();
    state.context.version++; state.ruleVersion++; assert.deepEqual((await basisOf()).reasons.sort(), ['context_changed', 'rules_changed']); state.context.version--; state.ruleVersion--;
    contracts.getRoute = async () => { throw problem('basis_changed', 'Revisa la ruta elegida.', 'Review the chosen route.', 409); };
    assert.deepEqual(await basisOf(), { status: 'needs_review', reasons: ['route_choice_changed'] }); contracts.getRoute = stubRoute;
    assert.deepEqual(await basisOf(), { status: 'current', reasons: [] });
    // Evidencia CITADA en la entrega: retirarla invalida con su propia razón.
    await evidence.remove(a.id, ev.id); assert.deepEqual(await basisOf(), { status: 'needs_review', reasons: ['cited_evidence_changed'] });
  });
  let previousVersion, carried;
  await t.test('QA-33-02: el rebase conserva entrega, reflexión y decisión como borrador de la versión anterior, que queda intacta', async () => {
    previousVersion = v;
    const rebased = await change({ action: 'rebase' }); assert.equal(rebased.status, 201);
    const payload = rebased.data.version.payload; carried = payload.carriedOver;
    assert.equal(payload.lifecycle, 'ready'); assert.equal(payload.submission, undefined); assert.equal(payload.reflection, undefined); assert.equal(payload.decision, undefined);
    assert.equal(carried.status, 'previous_version_to_review');
    assert.equal(carried.submission.fromVersion, previousVersion); assert.equal(carried.submission.sample, 'SYNTHETIC SAMPLE');
    assert.deepEqual(carried.submission.evidenceRefs, []); assert.equal(carried.submission.retiredEvidence, 1); // la citada retirada no viaja como válida
    assert.equal(carried.reflection.observation, 'SYNTHETIC observation'); assert.equal(carried.decision.value, 'continue');
    assert.ok(!JSON.stringify(carried).includes('PRIVATE_')); assert.ok(!JSON.stringify(carried).includes('basisParts'));
    const view = await http(`/experiments/${experimentId}`);
    const old = view.data.versions.find(row => row.version === previousVersion);
    assert.equal(old.payload.lifecycle, 'decided'); assert.equal(old.payload.submission.sample, 'SYNTHETIC SAMPLE'); assert.equal(old.payload.carriedOver, undefined); // inmutable
    assert.deepEqual(view.data.basis, { status: 'current', reasons: [] });
    // Lo arrastrado no es resultado vigente: ni revisión humana ni plan hasta que la persona lo reconfirme.
    const review = await http(`/experiments/${experimentId}/review-requests`, { method: 'POST', body: { requestId: randomUUID(), expectedVersion: v, action: 'request', submissionVersion: 3, evidenceRefs: [], includeSample: true } });
    assert.equal(review.status, 409);
    assert.equal((await http('/career-plan/proposals', { method: 'POST', body: { experimentId, expectedVersion: v } })).status, 409);
    assert.equal((await http(`/experiments/${experimentId}`, { actor: 'other' })).status, 404); // B no ve lo arrastrado de A
  });
  await t.test('QA-33-02: adoptar y descartar exige el orden entrega → reflexión → decisión y valida como lo escrito a mano', async () => {
    assert.equal((await change({ action: 'adopt', part: 'reflection' })).status, 409);
    assert.equal((await change({ action: 'adopt', part: 'decision' })).status, 409);
    assert.equal((await change({ action: 'adopt', part: 'other' })).status, 409);
    assert.equal((await change({ action: 'adopt', part: 'submission', sample: 'x' })).status, 400);
    assert.equal(await Versions.count({ where: { UserId: a.id, experimentId } }), v); // los rechazos no crearon versiones
    const dropped = await change({ action: 'discard', part: 'decision' }); assert.equal(dropped.status, 201);
    assert.equal(dropped.data.version.payload.carriedOver.decision, undefined); assert.equal(dropped.data.version.payload.lifecycle, 'ready');
    assert.equal((await change({ action: 'discard', part: 'decision' })).status, 409); // ya no hay borrador
    const requestId = randomUUID(), body = { requestId, expectedVersion: v, change: { action: 'adopt', part: 'submission' } };
    const adopted = await http(`/experiments/${experimentId}/versions`, { method: 'POST', body }); assert.equal(adopted.status, 201); v = adopted.data.version.version;
    const payload = adopted.data.version.payload;
    assert.equal(payload.lifecycle, 'submitted'); assert.equal(payload.submission.sample, 'SYNTHETIC SAMPLE'); assert.equal(payload.submission.version, v); assert.equal(payload.submission.assistance.source, 'self_report');
    assert.equal(payload.carriedOver.submission, undefined); assert.ok(payload.carriedOver.reflection);
    const repeat = await http(`/experiments/${experimentId}/versions`, { method: 'POST', body }); assert.equal(repeat.status, 200); assert.equal(repeat.data.created, false); // idempotente
    assert.equal(await Versions.count({ where: { UserId: a.id, experimentId } }), v);
    assert.equal((await http(`/experiments/${experimentId}/versions`, { actor: 'other', method: 'POST', body: { ...body, requestId: randomUUID() } })).status, 404);
    const reflected = await change({ action: 'adopt', part: 'reflection' }); assert.equal(reflected.status, 201);
    assert.equal(reflected.data.version.payload.lifecycle, 'self_reviewed'); assert.equal(reflected.data.version.payload.reflection.source, 'self_report');
    assert.equal(reflected.data.version.payload.carriedOver, undefined);
    assert.equal((await change({ action: 'adopt', part: 'reflection' })).status, 409);
  });
  await t.test('QA-33-02: lo que la persona escribe a mano reemplaza el borrador; evidencia citada que ya no es válida no se adopta', async () => {
    const second = await makeEvidence('SYNTHETIC second'); const refs2 = [{ evidenceId: second.id, version: 1 }];
    assert.equal((await change({ action: 'submit', sample: 'SECOND SAMPLE', evidenceRefs: refs2, assistance: 'planning' })).status, 201);
    assert.equal((await change({ action: 'reflect', observation: 'SECOND observation', interpretation: 'SECOND interpretation' })).status, 201);
    assert.equal((await change({ action: 'decide', decision: 'adjust', reason: 'SECOND reason' })).status, 201);
    const rebased = await change({ action: 'rebase' }); assert.equal(rebased.status, 201); carried = rebased.data.version.payload.carriedOver;
    assert.deepEqual(carried.submission.evidenceRefs, refs2); assert.equal(carried.submission.retiredEvidence, 0); assert.equal(carried.submission.fromVersion, rebased.data.version.version - 1);
    // Rebase repetido sin tocar nada: el trabajo propio de la versión vacía no existe, el borrador pendiente sigue y conserva su origen.
    const again = await change({ action: 'rebase' }); assert.equal(again.status, 201); assert.deepEqual(again.data.version.payload.carriedOver, carried);
    await evidence.remove(a.id, second.id);
    const rejected = await change({ action: 'adopt', part: 'submission' }); assert.equal(rejected.status, 422); assert.equal(rejected.data.code, 'evidence_not_valid');
    assert.equal((await payloadOf()).lifecycle, 'ready'); assert.ok((await payloadOf()).carriedOver.submission); // nada cambió
    // Escribir la entrega propia sustituye el borrador de esa parte.
    assert.equal((await change({ action: 'start' })).status, 201);
    assert.equal((await change({ action: 'submit', sample: 'MY OWN SAMPLE', assistance: 'none' })).status, 201);
    const after = await payloadOf(); assert.equal(after.submission.sample, 'MY OWN SAMPLE'); assert.equal(after.carriedOver.submission, undefined); assert.ok(after.carriedOver.reflection && after.carriedOver.decision);
  });
  await t.test('QA-33-02: rebase repetido o concurrente no duplica versiones y no produce 5xx con el pool reducido', async () => {
    const count = () => Versions.count({ where: { UserId: a.id, experimentId } });
    const start = await count(), shared = randomUUID();
    const post = requestId => http(`/experiments/${experimentId}/versions`, { method: 'POST', body: { requestId, expectedVersion: v, change: { action: 'rebase' } } });
    const same = await Promise.all([post(shared), post(shared), post(shared)]);
    assert.ok(same.every(r => [200, 201].includes(r.status)), JSON.stringify(same.map(r => r.status))); assert.equal(same.filter(r => r.status === 201).length, 1);
    assert.equal(await count(), start + 1); v = start + 1;
    const rivals = await Promise.all([post(randomUUID()), post(randomUUID()), post(randomUUID()), post(randomUUID())]);
    assert.deepEqual(rivals.map(r => r.status).sort(), [201, 409, 409, 409]); assert.ok(rivals.every(r => r.status < 500));
    assert.equal(await count(), start + 2);
    const final = await http(`/experiments/${experimentId}`); v = final.data.current.version;
    assert.equal(final.data.current.payload.carriedOver.reflection.observation, 'SECOND observation'); // el borrador sobrevive a varios rebases
  });
  await t.test('QA-33-02: versiones guardadas antes (payload v1) se comparan con la huella anterior y migran con el rebase', async () => {
    const { createHmac } = require('node:crypto'), rulesModule = require('../../utils/careerPlanRules');
    const canon = x => x instanceof Date ? x.toISOString() : Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon(x[k])])) : x;
    const legacy = x => createHmac('sha256', process.env.JWT_SECRET).update('es33:').update(JSON.stringify(canon(x))).digest('hex');
    const confirmed = await evidence.getConfirmedEvidence(a.id, 'career-plan');
    const old = rulesModule.experimentProposal({ choiceId: a.id, route: routeOf(), taskIndex: 0, minutes: 20, context: state.context, basisHash: 'x'.repeat(64) });
    assert.equal(old.schemaVersion, 1); assert.equal(old.basisParts, undefined);
    const hashNow = () => legacy({ userId: a.id, choiceId: a.id, routeHash: `synthetic-${state.routeVersion}`, context: rulesModule.contextSnapshot(state.context), refs: confirmed.map(e => ({ evidenceId: e.evidenceId, version: e.version })).sort((x, y) => x.evidenceId - y.evidenceId), templateVersion: rulesModule.TEMPLATE_VERSION, templateHash: legacy(rulesModule.TEMPLATE) });
    const container = await Experiment.create({ UserId: a.id, choiceId: a.id, currentVersion: 1, requestId: randomUUID(), inputHash: 'b'.repeat(64) });
    const { basisHash: dropped, ...stored } = old;
    await Versions.create({ UserId: a.id, experimentId: container.id, version: 1, lifecycle: 'ready', payload: encriptarV2(JSON.stringify(stored)), basisHash: hashNow(), requestId: randomUUID(), inputHash: 'c'.repeat(64) });
    const read = async () => (await http(`/experiments/${container.id}`)).data;
    assert.deepEqual((await read()).basis, { status: 'current', reasons: [] });
    state.routeVersion++; assert.deepEqual((await read()).basis, { status: 'needs_review', reasons: ['basis_changed'] }); // comportamiento anterior, sin razones finas
    const rebased = await http(`/experiments/${container.id}/versions`, { method: 'POST', body: { requestId: randomUUID(), expectedVersion: 1, change: { action: 'rebase' } } });
    assert.equal(rebased.status, 201); assert.equal(rebased.data.version.payload.schemaVersion, 2); assert.ok(rebased.data.version.payload.basisParts);
    assert.deepEqual((await read()).basis, { status: 'current', reasons: [] });
    state.routeVersion--; assert.deepEqual((await read()).basis, { status: 'current', reasons: [] }); // el hash global ya no cuenta
    await Versions.destroy({ where: { experimentId: container.id } }); await container.destroy();
  });
  await t.test('exportación propia de cinco modelos, sin hashes/tokens; B no descarga exportación de A', async () => {
    const preview = await rights.preview(a.id, { type: 'personal', locale: 'en' });
    for (const key of ['careerExperiments', 'careerExperimentVersions', 'careerPlans', 'careerReviews', 'careerReminders']) assert.ok(preview.data[key].length);
    assert.ok(!('inputHash' in preview.data.careerExperiments[0])); assert.ok(!('requestId' in preview.data.careerPlans[0]));
    assert.ok(!JSON.stringify(preview.data.careerExperimentVersions).includes('basisHash')); assert.ok(!JSON.stringify(preview.data.careerPlans).includes('basisHash'));
    assert.ok(JSON.stringify(preview.data.careerExperimentVersions).includes('SYNTHETIC SAMPLE'));
    await assert.rejects(rights.download(b.id, preview.id, () => assert.fail('foreign export')), { code: 'export_not_found' });
    assert.deepEqual(await rights.download(a.id, preview.id, value => value), preview.data);
  });
  await t.test('contratos reales sin datos fallan cerrados; historia propia recuperable, sin mock de runtime', async () => {
    Object.assign(contracts, originalContracts);
    // ES-32 real, sin una elección guardada para esta persona: falla cerrado con 404 (antes, con ES-32 ausente, era un 503 «pendiente»).
    const closed = await propose(); assert.equal(closed.status, 404); assert.equal(closed.data.code, 'route_record_not_found');
    const response = await http(`/experiments/${experimentId}`); assert.equal(response.status, 200); assert.equal(response.data.basis.status, 'needs_review');
    const paused = await http('/career-plan/versions', { method: 'POST', body: { requestId: randomUUID(), action: 'pause', expectedVersion: 2, planId } });
    assert.equal(paused.status, 201); assert.equal(paused.data.plan.status, 'paused');
    contracts.getRoute = stubRoute; contracts.getContext = async () => state.context;
  });
  await t.test('eliminación pendiente bloquea; fallo SQL revierte cinco modelos, reintento/replay conservan B', async () => {
    const request = await rights.requestDeletion(a.id); assert.equal((await http('/experiments')).status, 401);
    await sequelize.query(`CREATE FUNCTION es33_fail_purge() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es33_fail_purge BEFORE DELETE ON "CareerExperiments" FOR EACH ROW EXECUTE FUNCTION es33_fail_purge()`);
    await assert.rejects(processDeletion(request.id, { quiescent: true }), /can be retried/);
    for (const model of [Experiment, Versions, Plans, Reviews, Reminders]) assert.ok(await model.count({ where: { UserId: a.id } }));
    await sequelize.query('DROP TRIGGER es33_fail_purge ON "CareerExperiments"');
    const result = await processDeletion(request.id, { quiescent: true }); assert.equal(result.status, 'awaiting_verification');
    for (const model of [Experiment, Versions, Plans, Reviews, Reminders]) assert.equal(await model.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Experiment.count({ where: { UserId: b.id } }), 1); assert.ok(await Versions.count({ where: { UserId: b.id } }));
    await Experiment.create({ id: experimentId, UserId: a.id, choiceId: a.id, currentVersion: 1, requestId: randomUUID(), inputHash: 'a'.repeat(64) });
    await processDeletion(request.id, { quiescent: true, replay: true }); assert.equal(await Experiment.count({ where: { UserId: a.id } }), 0); assert.equal(await Experiment.count({ where: { UserId: b.id } }), 1);
    assert.ok(otherExperimentId);
  });
  await t.test('QA-33-01: con el pool reducido, escrituras simultáneas de distintas personas y de la misma persona terminan sin 5xx ni bloqueo', async () => {
    const people = [];
    for (let i = 0; i < poolMax * 2; i++) {
      const user = await User.create({ name: 'SYNTHETIC pool ' + i, email: `pool${i}@example.invalid`, password: randomBytes(32).toString('hex'), active: true, role: 'user' });
      people.push({ user, token: issueToken(user) });
    }
    const proposals = await Promise.all(people.map(({ user, token }) => http('/experiments/proposals', { method: 'POST', token, body: { choiceId: user.id, taskIndex: 0, minutes: 20 } })));
    proposals.forEach(proposal => assert.equal(proposal.status, 200));
    const create = (i, requestId) => http('/experiments', { method: 'POST', token: people[i].token, body: { requestId, proposal: proposals[i].data.proposal, token: proposals[i].data.token } });
    const same = randomUUID();
    let started = Date.now();
    const created = await Promise.all([...people.map((_, i) => create(i, i === 0 ? same : randomUUID())), ...Array.from({ length: poolMax * 2 }, () => create(0, same))]);
    assert.ok(!created.some(r => r.status >= 500), 'creaciones: ' + created.map(r => r.status).join(','));
    assert.ok(Date.now() - started < 8000, 'las creaciones tardaron ' + (Date.now() - started) + ' ms');
    const own = await Promise.all(people.map(({ token }) => http('/experiments', { token })));
    const ids = own.map(r => r.data.experiments[0].id);
    started = Date.now();
    const changed = await Promise.all([
      ...people.map(({ token }, i) => http(`/experiments/${ids[i]}/versions`, { method: 'POST', token, body: { requestId: randomUUID(), expectedVersion: 1, change: { action: 'start' } } })),
      ...Array.from({ length: poolMax * 2 }, () => http(`/experiments/${ids[0]}/versions`, { method: 'POST', token: people[0].token, body: { requestId: randomUUID(), expectedVersion: 1, change: { action: 'start' } } })),
    ]);
    assert.ok(!changed.some(r => r.status >= 500), 'cambios: ' + changed.map(r => r.status).join(','));
    assert.ok(Date.now() - started < 8000, 'los cambios tardaron ' + (Date.now() - started) + ' ms');
    for (const { user } of people) assert.equal(await Experiment.count({ where: { UserId: user.id } }), 1);
  });
});
