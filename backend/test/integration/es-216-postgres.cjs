// ES-216 contra Postgres REAL: la lectura de un experimento (GET /api/experiments/:id) no hace trabajo por consulta proporcional al número de
// evidencias confirmadas (antes: una consulta por evidencia) y su resultado no cambia. Medición con datos sintéticos (200 evidencias).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES216_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:experiment-read:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-216 PostgreSQL: lectura del experimento con muchas evidencias', { timeout: 300000 }, async (t) => {
  const source = process.env.ES216_TEST_DATABASE_URL;
  assert.ok(source, 'ES216_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es216_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es216_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
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
  const { encriptarV2 } = require('../../utils/crypto');
  const { validateContextRequest } = require('../../utils/participantContext');
  const { seedDemo, DEMO_EMAIL } = require('../../utils/demoSeed');
  const routes = require('../../utils/routes');
  const careerPlan = require('../../utils/careerPlan');
  const evidence = require('../../utils/evidence');

  await seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } });
  const a = await User.findOne({ where: { email: DEMO_EMAIL } });
  const constraints = { targetMarkets: ['CO'], languages: ['es'], modalities: ['hybrid', 'remote'], acceptRegulated: 'unknown', originContextKey: 'ctx_educacion_formacion',
    interestContextKeys: ['ctx_contabilidad_analisis'], preferredModalities: [] };
  await routes.putConstraints(a.id, { baseVersion: 0, requestId: randomUUID(), payload: constraints });
  const proposed = await routes.getRoutes(a.id);
  const pick = proposed.routes.find((r) => !r.regulated.isRegulated && r.tasks.length);
  const choice = (await routes.choose(a.id, { requestId: randomUUID(), roleKey: pick.roleKey, slot: pick.slot, decision: 'accepted', basisHash: proposed.basisHash })).choice;
  const baseContext = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'DK', timeZone: 'America/Bogota', profession: 'Docencia sintética', interests: null,
    availabilityMinutesPerWeek: 90, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] };
  const valid = validateContextRequest({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: baseContext });
  await ParticipantContext.create({ content: encriptarV2(JSON.stringify(valid.context)), completedAt: new Date(), UserId: a.id, version: 1 });

  const TOTAL = Number(process.env.ES216_EVIDENCE || 200);
  const have = await evidence.getConfirmedEvidence(a.id, 'career-plan');
  for (let i = have.length; i < TOTAL; i += 1) {
    await evidence.create(a.id, { requestId: randomUUID(), status: 'confirmed', payload: { title: `Evidencia sintética ${i}`, situation: 'Situación sintética para medir.', responsibility: { text: 'Responsable' },
      actions: [{ text: 'Acción' }], delivered: { text: 'Entregable' }, observedEffect: { known: false }, autonomy: 'autonomous' } });
  }
  const confirmedNow = (await evidence.getConfirmedEvidence(a.id, 'career-plan')).length;
  assert.ok(confirmedNow >= TOTAL, `hay ${confirmedNow} evidencias confirmadas`);
  // El experimento se crea DESPUÉS de las evidencias: su fundamento (basis) incluye las referencias confirmadas.
  const proposal = await careerPlan.proposeExperiment(a.id, { choiceId: choice.id, taskIndex: 0, minutes: 20 });
  const { experimentId } = await careerPlan.createExperiment(a.id, { requestId: randomUUID(), proposal: proposal.proposal, token: proposal.token });

  const timed = async (fn, runs = 15) => {
    const samples = [];
    for (let i = 0; i < runs; i += 1) { const t0 = process.hrtime.bigint(); await fn(); samples.push(Number(process.hrtime.bigint() - t0) / 1e6); }
    samples.sort((x, y) => x - y);
    return { p50: samples[Math.floor(runs * 0.5)], p95: samples[Math.min(runs - 1, Math.ceil(runs * 0.95) - 1)], max: samples[runs - 1] };
  };
  const countQueries = async (fn) => {
    let n = 0; const previous = sequelize.options.logging;
    sequelize.options.logging = () => { n += 1; };
    try { await fn(); } finally { sequelize.options.logging = previous; }
    return n;
  };

  await t.test('GET del experimento: el número de consultas NO crece con las evidencias y la respuesta es la misma', async () => {
    const view = await careerPlan.getExperiment(a.id, experimentId);
    assert.equal(view.basis.status, 'current'); assert.equal(view.experiment.id, experimentId);
    const queries = await countQueries(() => careerPlan.getExperiment(a.id, experimentId));
    const timing = await timed(() => careerPlan.getExperiment(a.id, experimentId));
    console.log(`ES-216 medición con ${confirmedNow} evidencias: consultas=${queries} p50=${timing.p50.toFixed(0)}ms p95=${timing.p95.toFixed(0)}ms max=${timing.max.toFixed(0)}ms`);
    assert.ok(queries < 100, `el GET hizo ${queries} consultas con ${confirmedNow} evidencias (debe ser constante, no una por evidencia)`);
    assert.ok(timing.p95 < 500, `p95 ${timing.p95.toFixed(0)} ms (umbral aprobado 500 ms)`);
  });

  await t.test('escrituras de la cadena con muchas evidencias: proponer, crear y cambiar un experimento p95 < 600 ms (umbral 800 ms con 25 % de margen)', async () => {
    const propose = () => careerPlan.proposeExperiment(a.id, { choiceId: choice.id, taskIndex: 0, minutes: 20 });
    const results = { propose: [], create: [], change: [] };
    for (let i = 0; i < 8; i += 1) {
      const t0 = process.hrtime.bigint(); const p = await propose(); const t1 = process.hrtime.bigint();
      const made = await careerPlan.createExperiment(a.id, { requestId: randomUUID(), proposal: p.proposal, token: p.token }); const t2 = process.hrtime.bigint();
      results.propose.push(Number(t1 - t0) / 1e6); results.create.push(Number(t2 - t1) / 1e6);
      assert.equal(made.created, true);
    }
    for (const [name, samples] of Object.entries(results)) {
      if (!samples.length) continue;
      samples.sort((x, y) => x - y);
      const p95 = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
      console.log(`ES-216 escritura ${name} con ${confirmedNow} evidencias: p50=${samples[Math.floor(samples.length / 2)].toFixed(0)}ms p95=${p95.toFixed(0)}ms`);
      assert.ok(p95 < 600, `${name} p95 ${p95.toFixed(0)} ms (máximo propuesto 600 ms)`);
    }
  });

  await t.test('getConfirmedEvidence devuelve las mismas evidencias, ordenadas, y excluye las borradas', async () => {
    const before = await evidence.getConfirmedEvidence(a.id, 'career-plan');
    const ids = before.map((e) => e.evidenceId);
    assert.deepEqual(ids, [...ids].sort((x, y) => x - y));
    const gone = ids[0];
    await require('../../Evidence').update({ deletedAt: new Date() }, { where: { id: gone } });
    const after = await evidence.getConfirmedEvidence(a.id, 'career-plan');
    assert.ok(!after.some((e) => e.evidenceId === gone), 'una evidencia borrada no cuenta');
    assert.equal(after.length, before.length - 1);
    const view = await careerPlan.getExperiment(a.id, experimentId);
    assert.equal(view.basis.status, 'needs_review'); // el fundamento cambió: el experimento pide revisión, como antes
  });
});
