// HTTP/JWT/ORM/cifrado/consentimiento/exportación/borrado reales. Solo DB temporal loopback; sin proveedor.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-32 PostgreSQL + HTTP: motor, propiedad, versiones y ciclo de vida', { timeout: 180000 }, async t => {
  const source = process.env.ES32_TEST_DATABASE_URL;
  assert.ok(source, 'Configura ES32_TEST_DATABASE_URL solo con PostgreSQL desechable local.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
  const name = `es32_test_${randomBytes(8).toString('hex')}`;
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } if (sequelize) await sequelize.close(); if (created) await admin.query(`DROP DATABASE "${name}"`); await admin.close(); });
  await admin.query(`CREATE DATABASE "${name}"`); created = true; target.pathname = '/' + name;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 15, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const id = require.resolve('../../database');
  require.cache[id] = { id, filename: id, loaded: true, exports: { sequelize } };
  require('../../associations')();
  const { CORE } = require('../../utils/personalData');
  const routeModels = ['RouteConstraintsVersion', 'RouteChoice', 'RouteReviewRequest'];
  for (const [, model] of CORE) if (!routeModels.includes(model)) require('../../' + model);
  for (const model of ['ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem', 'SkillCatalog', 'SkillDefinition']) require('../../' + model);
  await sequelize.sync();
  const migration = require('../../migrations/20261028-es32-routes.cjs');
  await migration.up(sequelize); await migration.up(sequelize);
  for (const model of routeModels) require('../../' + model);
  await sequelize.sync();
  const User = require('../../User'); const Constraints = require('../../RouteConstraintsVersion'); const Choice = require('../../RouteChoice'); const Review = require('../../RouteReviewRequest');
  const Evidence = require('../../Evidence'); const EvidenceVersion = require('../../EvidenceVersion');
  const { encriptarV2 } = require('../../utils/crypto');
  const catalog = require('../../utils/routeCatalog'); const skills = require('../../utils/skillCatalog');
  const map = require('../../utils/skillMap'); const evidence = require('../../utils/evidence'); const consent = require('../../utils/consent');
  const rights = require('../../utils/dataRights'); const { processDeletion } = require('../../utils/deletionProcessor');
  const { issueToken, revokeToken } = require('../../utils/sessions');
  const actors = {};
  for (const role of ['user', 'other', 'admin', 'therapist', 'board', 'superadmin']) actors[role] = await User.create({ name: `Synthetic ${role}`, email: `${role}@example.invalid`, password: randomBytes(32).toString('hex'), role: role === 'other' ? 'user' : role, active: true });
  const a = actors.user, b = actors.other;
  const express = require('express'); const app = express(); app.use(express.json());
  app.use('/api/routes', require('../../middlewares/auth').verificarToken, require('../../routes/routes'));
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const tokens = Object.fromEntries(Object.entries(actors).map(([role, user]) => [role, issueToken(user)]));
  const http = async (path, { actor = 'user', method = 'GET', body, token } = {}) => {
    const response = await fetch(base + '/api/routes' + path, { method, headers: { ...(actor === null ? {} : { Authorization: 'Bearer ' + (token || tokens[actor]) }), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    // Las denegaciones de verificarToken ocurren antes del router, que no modifica ese helper compartido.
    if (response.ok) assert.equal(response.headers.get('cache-control'), 'no-store');
    return { status: response.status, data: await response.json() };
  };
  const payload = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: 'ctx_educacion_formacion', interestContextKeys: ['ctx_contabilidad_analisis'], preferredModalities: [] };
  const constraintBody = (baseVersion = 0, over = {}) => ({ baseVersion, requestId: randomUUID(), payload: { ...payload, ...over } });
  let choice, choiceBody;

  await t.test('migración repetible: siete índices únicos; no altera datos previos', async () => {
    const indexes = await sequelize.query(`SELECT indexname FROM pg_indexes WHERE indexname LIKE 'route_constraints_%' OR indexname LIKE 'route_choices_%' OR indexname LIKE 'route_reviews_%'`, { type: 'SELECT' });
    assert.equal(indexes.length, 7); assert.equal(await User.count(), 6);
  });
  await t.test('sin catálogo 503; sin mercado needs_constraints; no infiere del chat, idioma o residencia', async () => {
    assert.equal((await http('')).status, 503);
    const draft = await catalog.createDraft(); const fixture = require('../../seeds/routeCatalogSynthetic.cjs').build();
    for (const [kind, items] of Object.entries(fixture)) for (const [key, value] of Object.entries(items)) await catalog.upsertItem(draft.id, kind, key, value);
    await catalog.publish(draft.id, actors.admin.id, { allowSynthetic: true });
    const result = await http(''); assert.equal(result.data.status, 'needs_constraints'); assert.deepEqual(result.data.routes, []);
    const skillDraft = await skills.createDraft();
    for (const key of ['comunicacion', 'analisis_informacion', 'resolucion_problemas']) await skills.upsertSkill(skillDraft.id, key, {
      type: 'transversal', labels: { es: '[SINTÉTICO] capacidad', en: '[SYNTHETIC] capability' },
      rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(n => [n, { es: `Nivel ${n}`, en: `Level ${n}` }])), source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-28' },
    });
    await skills.publish(skillDraft.id, actors.admin.id);
    await require('../../message').create({ UserId: a.id, role: 'user', content: encriptarV2('CANARY_PRIVATE_CHAT') });
    await require('../../DiaryEntry').create({ UserId: a.id, entryDate: '2026-10-28', content: encriptarV2('CANARY_PRIVATE_DIARY') });
    await require('../../MoodLog').create({ UserId: a.id, checkin_mood: 4 });
  });
  await t.test('restricciones cifradas, idempotencia exacta y conflicto de requestId/baseVersion; dueño B separado', async () => {
    const body = constraintBody(); const first = await http('/constraints', { method: 'PUT', body }); assert.equal(first.status, 201);
    assert.equal((await http('/constraints', { method: 'PUT', body })).status, 200);
    assert.equal((await http('/constraints', { method: 'PUT', body: { ...body, payload: { ...payload, languages: ['en'] } } })).status, 409);
    assert.equal((await http('/constraints', { method: 'PUT', body: constraintBody() })).status, 409);
    assert.equal((await http('/constraints', { method: 'PUT', actor: 'other', body: constraintBody() })).status, 201);
    const row = await Constraints.findOne({ where: { UserId: a.id } }); assert.match(row.payload, /^v2:/); assert.ok(!row.payload.includes('educacion'));
    for (const extra of [{ UserId: b.id }, { ownerId: b.id }, { payload: { ...payload, residence: 'CO' } }, { payload: { ...payload, interestContextKeys: ['nonexistent'] } }, { payload: { ...payload, targetMarkets: [] } }])
      assert.equal((await http('/constraints', { method: 'PUT', body: { ...constraintBody(1), ...extra } })).status, 400);
  });
  await t.test('tres escrituras concurrentes: una versión nueva; otras 409; un solo current', async () => {
    const results = await Promise.all(Array.from({ length: 3 }, () => http('/constraints', { method: 'PUT', body: constraintBody(1) })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409]);
    assert.equal(await Constraints.count({ where: { UserId: a.id, status: 'current' } }), 1);
    assert.equal((await http('/constraints')).data.constraints.version, 2);
  });
  await t.test('flujo legítimo: evidencia confirmada y mapa reales; fichas sin datos privados ni IA', async () => {
    const e = await evidence.create(a.id, { status: 'confirmed', requestId: randomUUID(), payload: { title: 'Synthetic example', situation: 'Synthetic situation', responsibility: { text: 'Synthetic responsibility' }, actions: [{ text: 'Synthetic action' }], delivered: { text: 'Synthetic delivery' }, observedEffect: { known: false }, autonomy: 'autonomous' } });
    await map.selfAssess(a.id, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], requestId: randomUUID() });
    const result = await http(''); assert.equal(result.status, 200); assert.equal(result.data.status, 'partial');
    assert.ok(result.data.routes.some(r => r.roleKey === 'formador_corporativo' && r.slot === 'continuity'));
    assert.ok(!JSON.stringify(result.data).includes('CANARY_PRIVATE')); assert.ok(!JSON.stringify(result.data).includes('Revisor'));
    assert.match(result.data.basisHash, /^[a-f0-9]{64}$/);
    const route = result.data.routes[0]; choiceBody = { roleKey: route.roleKey, slot: route.slot, decision: 'accepted', basisHash: result.data.basisHash, requestId: randomUUID() };
    const saved = await http('/choices', { method: 'POST', body: choiceBody }); assert.equal(saved.status, 201); choice = saved.data.choice; assert.equal(choice.basisChanged, false);
    assert.equal((await require('../../utils/routes').getAcceptedChoice(a.id, choice.id)).id, choice.id);
    await assert.rejects(require('../../utils/routes').getAcceptedChoice(b.id, choice.id), { code: 'route_record_not_found' });
  });
  await t.test('aceptar, rechazar, cambiar: idempotencia concurrente y conflicto; nunca acepta rol inventado', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => http('/choices', { method: 'POST', body: choiceBody })));
    assert.ok(results.every(r => r.status === 200)); assert.ok(results.every(r => r.data.choice.id === choice.id));
    assert.equal((await http('/choices', { method: 'POST', body: { ...choiceBody, decision: 'rejected' } })).status, 409);
    assert.equal((await http('/choices', { method: 'POST', body: { ...choiceBody, roleKey: 'invented', requestId: randomUUID() } })).status, 422);
    const rejected = await http('/choices', { method: 'POST', body: { ...choiceBody, decision: 'rejected', requestId: randomUUID() } }); assert.equal(rejected.status, 201);
    assert.equal(rejected.data.choice.decision, 'rejected');
    assert.equal((await http(`/choices/${choice.id}`)).data.choice.status, 'superseded');
    await assert.rejects(require('../../utils/routes').getAcceptedChoice(a.id, choice.id), { code: 'conflict' });
    await assert.rejects(require('../../utils/routes').getAcceptedChoice(a.id, rejected.data.choice.id), { code: 'conflict' });
  });
  await t.test('IDs ajenos: B no lee la elección de A; admin/terapeuta/board/superadmin sin bypass; identidad del servidor', async () => {
    assert.equal((await http(`/choices/${choice.id}`, { actor: 'other' })).status, 404);
    assert.deepEqual((await http('/choices', { actor: 'other' })).data.choices, []);
    for (const actor of ['admin', 'therapist', 'board', 'superadmin']) for (const [path, method, body] of [['', 'GET'], ['/constraints', 'PUT', constraintBody()], [`/choices/${choice.id}`, 'GET'], ['/choices', 'POST', choiceBody], ['/review-requests', 'POST', { requestId: randomUUID() }]])
      assert.equal((await http(path, { actor, method, body })).status, 403);
    assert.equal((await http('?UserId=' + b.id)).status, 400);
    assert.equal((await http('/choices', { method: 'POST', body: { ...choiceBody, UserId: b.id } })).status, 400);
    assert.equal((await http('/choices', { method: 'POST', actor: 'other', body: { ...choiceBody, requestId: randomUUID() } })).status, 409);
    assert.equal((await http('', { actor: null })).status, 403);
    await a.update({ role: 'admin' }); assert.equal((await http('')).status, 403); await a.update({ role: 'user' });
    const revoked = issueToken(a); await revokeToken(require('jsonwebtoken').decode(revoked)); assert.equal((await http('', { token: revoked })).status, 401);
  });
  await t.test('basisChanged tras restricciones: elección anterior no se reescribe; huella vieja 409', async () => {
    assert.equal((await http('/constraints', { method: 'PUT', body: constraintBody(2, { languages: ['es', 'en'] }) })).status, 201);
    assert.equal((await http(`/choices/${choice.id}`)).data.choice.basisChanged, true);
    assert.equal((await http('/choices', { method: 'POST', body: { ...choiceBody, requestId: randomUUID() } })).status, 409);
  });
  await t.test('revocación de evidencia del chat quita transferencia y cambia huella sin leer chat/crisis', async () => {
    await consent.setConsent(a.id, 'professional_bridge', 'granted');
    const container = await Evidence.create({ UserId: a.id, currentVersion: 1 });
    const direct = await EvidenceVersion.findOne({ where: { UserId: a.id, status: 'confirmed' } });
    await EvidenceVersion.create({ EvidenceId: container.id, UserId: a.id, version: 1, status: 'confirmed', authoring: 'person', payload: direct.payload, origins: [], hasChatOrigin: true, consentVersion: 1, requestId: randomUUID() });
    await map.selfAssess(a.id, { skillKey: 'resolucion_problemas', level: 3, evidenceRefs: [{ evidenceId: container.id, version: 1 }], requestId: randomUUID() });
    const before = await http(''); assert.ok(before.data.routes.some(r => r.slot === 'adjacency'));
    await consent.setConsent(a.id, 'professional_bridge', 'revoked');
    const after = await http(''); assert.ok(!after.data.routes.some(r => r.slot === 'adjacency')); assert.notEqual(before.data.basisHash, after.data.basisHash);
    assert.ok(!JSON.stringify(after.data).includes('CANARY_PRIVATE'));
  });
  await t.test('solicitud humana propia cifrada, idempotente y sin compartir con terceros', async () => {
    const body = { requestId: randomUUID(), note: 'SYNTHETIC REVIEW NOTE' };
    assert.equal((await http('/review-requests', { method: 'POST', body })).status, 201);
    assert.equal((await http('/review-requests', { method: 'POST', body })).status, 200);
    assert.equal((await http('/review-requests', { method: 'POST', body: { ...body, note: 'changed' } })).status, 409);
    assert.equal((await http('/review-requests', { method: 'POST', body: { requestId: randomUUID() } })).data.code, 'review_already_open');
    assert.equal((await http('/review-requests', { actor: 'other' })).data.reviewRequest, null);
    assert.match((await Review.findOne({ where: { UserId: a.id } })).note, /^v2:/);
    assert.equal((await http('/review-requests', { method: 'POST', body: { requestId: randomUUID(), note: 'x'.repeat(301) } })).status, 400);
  });
  await t.test('cambio de catálogo/ausencia posterior: elecciones históricas accesibles pero no vigentes', async () => {
    const before = (await http('')).data.basisHash;
    const draft = await catalog.createDraft(); await catalog.publish(draft.id, actors.admin.id, { allowSynthetic: true });
    assert.notEqual((await http('')).data.basisHash, before);
    const Catalog = require('../../RouteCatalog'); const published = await Catalog.findOne({ where: { status: 'published' } });
    await published.update({ status: 'archived' });
    assert.equal((await http('')).status, 503); assert.equal((await http(`/choices/${choice.id}`)).data.choice.basisChanged, true);
    await published.update({ status: 'published' });
  });
  await t.test('exportación real exacta propia y descarga ajena 404; huellas/requestId no se exportan', async () => {
    const preview = await rights.preview(a.id, { type: 'personal', locale: 'en' });
    assert.equal(preview.data.routeConstraints.length, 3); assert.equal(preview.data.routeChoices.length, 2); assert.equal(preview.data.routeReviewRequests[0].note, 'SYNTHETIC REVIEW NOTE');
    assert.equal(preview.data.routeConstraints[0].payload.originContextKey, payload.originContextKey);
    assert.ok(!('basisHash' in preview.data.routeChoices[0])); assert.ok(!('requestId' in preview.data.routeConstraints[0]));
    await assert.rejects(rights.download(b.id, preview.id, () => assert.fail('foreign export')), { code: 'export_not_found' });
    assert.deepEqual(await rights.download(a.id, preview.id, data => data), preview.data);
  });
  await t.test('eliminación pendiente bloquea HTTP; purga real/replay de tres modelos conserva B', async () => {
    const request = await rights.requestDeletion(a.id);
    assert.equal((await http('')).status, 401);
    assert.equal((await http('/constraints', { method: 'PUT', body: constraintBody(3) })).status, 401);
    await sequelize.query(`CREATE FUNCTION es32_fail_purge() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es32_fail_purge BEFORE DELETE ON "RouteChoices" FOR EACH ROW EXECUTE FUNCTION es32_fail_purge()`);
    await assert.rejects(processDeletion(request.id, { quiescent: true }), /can be retried/);
    assert.equal(await Constraints.count({ where: { UserId: a.id } }), 3);
    assert.equal(await Choice.count({ where: { UserId: a.id } }), 2);
    assert.equal(await Review.count({ where: { UserId: a.id } }), 1);
    await sequelize.query('DROP TRIGGER es32_fail_purge ON "RouteChoices"');
    const result = await processDeletion(request.id, { quiescent: true }); assert.equal(result.status, 'awaiting_verification');
    for (const model of [Constraints, Choice, Review]) assert.equal(await model.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Constraints.count({ where: { UserId: b.id } }), 1);
    await Review.create({ UserId: a.id, status: 'open', note: encriptarV2('RESTORED SYNTHETIC'), inputHash: 'a'.repeat(64), requestId: randomUUID() });
    await processDeletion(request.id, { quiescent: true, replay: true }); assert.equal(await Review.count({ where: { UserId: a.id } }), 0);
    assert.equal(await Constraints.count({ where: { UserId: b.id } }), 1);
  });
});
