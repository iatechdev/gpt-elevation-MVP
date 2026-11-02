// ES-33 INTEGRADO contra Postgres REAL: ES-14 (contexto), ES-32 (rutas y elección), ES-29/31 (catálogos y Skill Map) y ES-33 (experimento), SIN simulaciones.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES33I_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:career-plan:integration:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-33 integrado con ES-14, ES-32 y los catálogos reales en PostgreSQL', { timeout: 180000 }, async (t) => {
  const source = process.env.ES33I_TEST_DATABASE_URL;
  assert.ok(source, 'ES33I_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es33i_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es33i_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../associations')();
  const { CORE } = require('../../utils/personalData');
  for (const [, model] of CORE) require('../../' + model);
  for (const model of ['PricingPlan', 'ConsentEvent', 'TherapistValidation', 'AuthRevocation', 'RevokedToken', 'ExportRequest', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem',
    'SkillCatalog', 'SkillDefinition']) require('../../' + model);
  await sequelize.sync();

  const User = require('../../User');
  const ParticipantContext = require('../../ParticipantContext');
  const Experiment = require('../../CareerExperiment');
  const { encriptarV2 } = require('../../utils/crypto');
  const { validateContextRequest } = require('../../utils/participantContext');
  const { seedDemo, DEMO_EMAIL } = require('../../utils/demoSeed');
  const routes = require('../../utils/routes');
  const careerPlan = require('../../utils/careerPlan');
  const contracts = require('../../utils/careerPlanContracts');
  const rights = require('../../utils/dataRights');
  const { issueToken } = require('../../utils/sessions');

  // Catálogos publicados, persona con evidencia y autoevaluaciones: la misma carga sintética que usa la demostración de staging.
  await seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } });
  const a = await User.findOne({ where: { email: DEMO_EMAIL } });
  const b = await User.create({ name: 'SYNTHETIC other', email: 'other@example.invalid', password: randomBytes(32).toString('hex'), role: 'user', active: true });
  const constraints = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: 'ctx_educacion_formacion',
    interestContextKeys: ['ctx_contabilidad_analisis'], preferredModalities: [] };
  assert.equal((await routes.putConstraints(a.id, { baseVersion: 0, requestId: randomUUID(), payload: constraints })).created, true);
  const proposed = await routes.getRoutes(a.id);
  const pick = proposed.routes.find(r => !r.regulated.isRegulated && r.tasks.length);
  assert.ok(pick, 'ES-32 real propone al menos una ruta no regulada con tareas');
  const choice = (await routes.choose(a.id, { requestId: randomUUID(), roleKey: pick.roleKey, slot: pick.slot, decision: 'accepted', basisHash: proposed.basisHash })).choice;

  // Contexto de ES-14 construido con SU validador (mismo DTO que guarda la ruta real) y cifrado v2.
  const baseContext = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null,
    availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }; // ES-109: esquema v2
  async function setContext(userId, over = {}, { completed = true } = {}) {
    const valid = validateContextRequest({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: { ...baseContext, ...over } });
    assert.ok(!valid.error, JSON.stringify(valid));
    const row = await ParticipantContext.findOne({ where: { UserId: userId } });
    const values = { content: encriptarV2(JSON.stringify(valid.context)), completedAt: completed ? new Date() : null };
    if (row) return row.update({ ...values, version: row.version + 1 });
    return ParticipantContext.create({ ...values, UserId: userId, version: 1 });
  }
  const propose = (userId = a.id, over = {}) => careerPlan.proposeExperiment(userId, { choiceId: choice.id, taskIndex: 0, minutes: 20, ...over });
  const rejectsWith = (promise, status, code) => assert.rejects(promise, e => e.status === status && e.code === code, `se esperaba ${status} ${code}`);

  await t.test('sin contexto completado no hay propuesta: 409 context_incomplete y no se crea nada (ni un borrador cuenta)', async () => {
    await rejectsWith(propose(), 409, 'context_incomplete'); // no hay fila
    await setContext(a.id, {}, { completed: false }); // borrador con todos los datos pero sin «continuar»
    await rejectsWith(propose(), 409, 'context_incomplete');
    assert.equal(await Experiment.count(), 0);
  });

  await t.test('disponibilidad o zona horaria desconocidas devuelven 409 en vez de inventar un valor', async () => {
    await setContext(a.id, { availabilityMinutesPerWeek: null });
    await rejectsWith(propose(), 409, 'availability_unknown');
    await setContext(a.id, { availabilityMinutesPerWeek: 90, timeZone: null });
    await rejectsWith(propose(), 409, 'timezone_unknown');
    await setContext(a.id, { availabilityMinutesPerWeek: 0 }); // cero es un dato conocido, no «desconocido»: la regla de alcance de ES-33 lo trata
    await rejectsWith(propose(), 422, 'needs_scope_reduction');
    assert.equal(await Experiment.count(), 0);
  });

  let experimentId, proposal;
  await t.test('con contexto completo la propuesta usa la disponibilidad, zona e idioma REALES de ES-14 y se crea el experimento', async () => {
    await setContext(a.id, { availabilityMinutesPerWeek: 90 });
    const ctx = await ParticipantContext.findOne({ where: { UserId: a.id } });
    proposal = await propose();
    assert.deepEqual(proposal.proposal.availability, { version: ctx.version, weeklyMinutes: 90, timeZone: 'America/Bogota', locale: 'es' });
    assert.equal(proposal.proposal.roleKey, pick.roleKey);
    const made = await careerPlan.createExperiment(a.id, { requestId: randomUUID(), proposal: proposal.proposal, token: proposal.token });
    assert.equal(made.created, true); experimentId = made.experimentId;
    assert.equal((await careerPlan.getExperiment(a.id, experimentId)).basis.status, 'current');
    assert.equal(await Experiment.count({ where: { UserId: a.id } }), 1);
  });

  await t.test('editar el contexto en ES-14 deja el experimento «necesita revisión» sin tocar lo guardado, y una propuesta anterior ya no se puede confirmar', async () => {
    await setContext(a.id, { availabilityMinutesPerWeek: 120 });
    const view = await careerPlan.getExperiment(a.id, experimentId);
    assert.deepEqual([view.basis.status, view.basis.reasons], ['needs_review', ['basis_changed']]);
    assert.equal(view.current.version, 1); // la versión guardada no se reescribe sola
    await assert.rejects(careerPlan.createExperiment(a.id, { requestId: randomUUID(), proposal: proposal.proposal, token: proposal.token }), e => e.status === 409);
    assert.equal(await Experiment.count({ where: { UserId: a.id } }), 1);
  });

  await t.test('si cambian las restricciones en ES-32, la elección y el experimento dejan de coincidir con la base', async () => {
    const current = await routes.getConstraints(a.id);
    await routes.putConstraints(a.id, { baseVersion: current.constraints.version, requestId: randomUUID(), payload: { ...constraints, languages: ['es', 'en'] } });
    const view = await careerPlan.getExperiment(a.id, experimentId);
    assert.equal(view.basis.status, 'needs_review');
    await assert.rejects(propose(), e => e.status === 409); // la elección aceptada ya no corresponde a la propuesta vigente
  });

  await t.test('aislamiento: B no puede usar la elección de A ni ve nada de su contexto; un cambio de rol o de cuenta lo cierra', async () => {
    await assert.rejects(propose(b.id), e => e.status === 404);
    await rejectsWith(contracts.getContext(b.id), 409, 'context_incomplete'); // B no tiene contexto propio y nunca recibe el de A
    await setContext(b.id, { availabilityMinutesPerWeek: 15, timeZone: 'Europe/Copenhagen', preferredLanguage: 'en' });
    assert.deepEqual(await contracts.getContext(b.id), { version: 1, weeklyMinutes: 15, timeZone: 'Europe/Copenhagen', locale: 'en' });
    await b.update({ role: 'admin' });
    await rejectsWith(contracts.getContext(b.id), 403, 'owner_required');
    await b.update({ role: 'user', active: false });
    await rejectsWith(contracts.getContext(b.id), 403, 'owner_required');
    await b.update({ active: true });
    assert.equal((await contracts.getContext(b.id)).weeklyMinutes, 15);
    await assert.rejects(contracts.getContext(999999), e => e.status === 403 && e.code === 'owner_required');
  });

  await t.test('con una solicitud de eliminación el contexto no se lee, aunque alguien reactive la cuenta', async () => {
    await rights.requestDeletion(b.id);
    await User.update({ active: true }, { where: { id: b.id } }); // el registro de eliminación bloquea igualmente (update por where: la instancia ya creía estar activa)
    assert.equal((await User.findByPk(b.id)).active, true);
    await rejectsWith(contracts.getContext(b.id), 403, 'deletion_pending');
  });

  await t.test('por HTTP con JWT real: 409 con código y mensaje ES/EN sin contexto, 200 con contexto completo; el cuerpo no trae datos de la persona', async () => {
    const express = require('express'); const app = express(); app.use(express.json());
    app.use('/api/experiments', require('../../middlewares/auth').verificarToken, require('../../routes/careerPlan').experiments);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/experiments/proposals`;
    const post = async (user, body) => {
      const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + issueToken(user) }, body: JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    };
    const c = await User.create({ name: 'SYNTHETIC third', email: 'third@example.invalid', password: randomBytes(32).toString('hex'), role: 'user', active: true });
    const noContext = await post(c, { choiceId: choice.id, taskIndex: 0, minutes: 20 });
    assert.equal(noContext.status, 404); // la elección es de A: C ni siquiera llega a hablar de contexto
    assert.ok(!JSON.stringify(noContext.data).includes('Bogota'));
    await ParticipantContext.destroy({ where: { UserId: a.id } });
    const restored = await routes.getConstraints(a.id);
    await routes.putConstraints(a.id, { baseVersion: restored.constraints.version, requestId: randomUUID(), payload: constraints });
    // La elección anterior quedó obsoleta (ES-32 la marca basisChanged y responde conflict): se elige de nuevo sobre la base vigente.
    const fresh = await routes.getRoutes(a.id); const again = fresh.routes.find(r => r.roleKey === pick.roleKey && r.slot === pick.slot); assert.ok(again);
    const choice2 = (await routes.choose(a.id, { requestId: randomUUID(), roleKey: again.roleKey, slot: again.slot, decision: 'accepted', basisHash: fresh.basisHash })).choice;
    const none = await post(a, { choiceId: choice2.id, taskIndex: 0, minutes: 20 });
    assert.deepEqual([none.status, none.data.code], [409, 'context_incomplete']);
    assert.match(none.data.error, /Completa tu contexto.*\/.*Complete your context/);
    await setContext(a.id, { availabilityMinutesPerWeek: 90 });
    const ok = await post(a, { choiceId: choice2.id, taskIndex: 0, minutes: 20 });
    assert.equal(ok.status, 200); assert.equal(ok.data.proposal.availability.weeklyMinutes, 90);
  });
});
