// Semilla de demostración de staging contra Postgres REAL (criptografía real). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  SEED_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:seed-demo:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('Semilla de demostración en PostgreSQL: carga completa, idempotencia y rechazos sin escribir nada', { timeout: 120000 }, async (t) => {
  const source = process.env.SEED_TEST_DATABASE_URL;
  assert.ok(source, 'SEED_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `seed_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^seed_test_[a-f0-9]{16}$/);
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

  for (const name of ['PricingPlan', 'User', 'Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition',
    'SkillAssessment', 'CareerContextVersion', 'BridgeTransfer', 'DeletionRequest', 'RouteCatalog', 'RouteCatalogItem']) require('../../' + name);
  const reset = () => sequelize.sync({ force: true });
  const { seedDemo, SeedError, demoSkills, DEMO_EMAIL, DEMO_EVIDENCE, isSyntheticLabel } = require('../../utils/demoSeed');
  const skillCatalog = require('../../utils/skillCatalog');
  const routeCatalog = require('../../utils/routeCatalog');
  const skillMap = require('../../utils/skillMap');
  const { build: buildRouteCatalog } = require('../../seeds/routeCatalogSynthetic.cjs');
  const bcrypt = require('bcryptjs');
  const User = require('../../User');
  const SkillCatalog = require('../../SkillCatalog');
  const SkillDefinition = require('../../SkillDefinition');
  const RouteCatalogItem = require('../../RouteCatalogItem');
  const SkillAssessment = require('../../SkillAssessment');
  const RouteCatalog = require('../../RouteCatalog');
  const Evidence = require('../../Evidence');
  const EvidenceVersion = require('../../EvidenceVersion');

  const password = randomBytes(12).toString('hex'); // 24 caracteres, generada para esta corrida; no se guarda ni se imprime
  const env = { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: password };
  const counts = async () => ({
    users: await User.count(), skillCatalogs: await SkillCatalog.count(), routeCatalogs: await RouteCatalog.count(),
    evidence: await Evidence.count(), versions: await EvidenceVersion.count(), assessments: await SkillAssessment.count(),
  });
  const rejected = (promise, code) => assert.rejects(promise, (e) => e instanceof SeedError ? e.code === code : e && e.code === code);
  const realSkills = () => demoSkills().map((s) => ({ ...s, labels: { es: s.labels.es.replace('[SINTÉTICO] ', ''), en: s.labels.en.replace('[SYNTHETIC] ', '') } }));

  await t.test('sin bandera o sin clave no escribe nada', async () => {
    await reset();
    await rejected(seedDemo({ env: {} }), 'synthetic_not_allowed');
    await rejected(seedDemo({ env: { ALLOW_SYNTHETIC_CATALOG: 'true', DEMO_USER_PASSWORD: 'corta' } }), 'password_required');
    assert.deepEqual(await counts(), { users: 0, skillCatalogs: 0, routeCatalogs: 0, evidence: 0, versions: 0, assessments: 0 });
  });

  await t.test('carga completa con NODE_ENV=production (como staging): catálogos publicados, persona con clave cifrada, evidencia y mapa', async () => {
    await reset();
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let result;
    try { result = await seedDemo({ env }); } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
    assert.deepEqual(result, { skillCatalog: 'created', routeCatalog: 'created', participant: 'created', evidence: 3, assessments: 3, email: DEMO_EMAIL });

    const skills = await skillCatalog.getPublished();
    assert.equal(skills.skills.size, 8);
    for (const skill of skills.skills.values()) assert.ok(isSyntheticLabel(skill.labels), skill.skillKey);
    const routes = await routeCatalog.getPublishedRouteCatalog();
    for (const kind of ['contexts', 'sources', 'roles', 'offers', 'resources']) { assert.ok(routes[kind].length > 0, kind); assert.ok(routes[kind].every((i) => i.synthetic === true), kind); }

    const user = await User.findOne({ where: { email: DEMO_EMAIL } });
    assert.notEqual(user.password, password); // la clave no se guarda en claro
    assert.match(user.password, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(password, user.password), true);
    assert.equal(user.role, 'user');

    assert.equal(await EvidenceVersion.count({ where: { UserId: user.id, status: 'confirmed' } }), 3);
    const map = await skillMap.getMap(user.id);
    const levels = Object.fromEntries(map.skills.map((s) => [s.skillKey, s.self ? [s.self.level, s.self.stale] : null]));
    assert.deepEqual(levels.comunicacion, [3, false]);
    assert.deepEqual(levels.planificacion_organizacion, [2, false]);
    assert.deepEqual(levels.analisis_informacion, [3, false]);
    for (const key of ['trabajo_en_equipo', 'resolucion_problemas', 'adaptabilidad', 'aprendizaje_autonomo', 'influencia_liderazgo']) assert.equal(levels[key], null, key); // sin evidencia, nunca cero
  });

  await t.test('segunda corrida: idempotente, no duplica nada y no cambia la clave', async () => {
    const before = await counts();
    const hash = (await User.findOne({ where: { email: DEMO_EMAIL } })).password;
    const again = await seedDemo({ env: { ...env, DEMO_USER_PASSWORD: randomBytes(12).toString('hex') } });
    assert.deepEqual(again, { skillCatalog: 'exists', routeCatalog: 'exists', participant: 'exists', evidence: 3, assessments: 3, email: DEMO_EMAIL });
    assert.deepEqual(await counts(), before);
    assert.equal((await User.findOne({ where: { email: DEMO_EMAIL } })).password, hash);
  });

  await t.test('no pisa un catálogo de habilidades real publicado y no deja nada a medias', async () => {
    await reset();
    const draft = await skillCatalog.createDraft();
    for (const skill of realSkills()) await skillCatalog.upsertSkill(draft.id, skill.skillKey, { type: skill.type, labels: skill.labels, rubric: skill.rubric });
    await skillCatalog.publish(draft.id, null);
    const before = await counts();
    await rejected(seedDemo({ env }), 'real_catalog_present');
    assert.deepEqual(await counts(), before);
    assert.equal(await RouteCatalog.count(), 0);
  });

  await t.test('no pisa un catálogo de rutas real publicado y tampoco publica antes el de habilidades', async () => {
    await reset();
    const draft = await routeCatalog.createDraft();
    const content = buildRouteCatalog();
    for (const kind of routeCatalog.KINDS) for (const [key, item] of Object.entries(content[kind])) await routeCatalog.upsertItem(draft.id, kind, key, { ...item, synthetic: false });
    await routeCatalog.publish(draft.id, null, { allowSynthetic: false });
    await rejected(seedDemo({ env }), 'real_catalog_present');
    assert.equal(await SkillCatalog.count(), 0); // el rechazo ocurre antes de escribir
    assert.equal(await User.count(), 0);
  });

  await t.test('con un borrador abierto del cliente no mezcla contenido ni escribe nada', async () => {
    await reset();
    await skillCatalog.createDraft();
    const before = await counts();
    await rejected(seedDemo({ env }), 'draft_exists');
    assert.deepEqual(await counts(), before);
    assert.equal(await SkillCatalog.count({ where: { status: 'published' } }), 0);
    assert.equal(await RouteCatalog.count(), 0);
  });

  await t.test('con un borrador de RUTAS abierto tampoco publica antes el de habilidades: el rechazo ocurre antes de escribir', async () => {
    await reset();
    await routeCatalog.createDraft();
    await rejected(seedDemo({ env }), 'draft_exists');
    assert.equal(await SkillCatalog.count(), 0);
    assert.equal(await User.count(), 0);
    assert.equal(await RouteCatalog.count({ where: { status: 'published' } }), 0);
  });

  await t.test('un corte entre crear el borrador y publicar (habilidades) deja un borrador propio que la siguiente corrida completa', async () => {
    await reset();
    const original = skillCatalog.upsertSkill; let calls = 0;
    skillCatalog.upsertSkill = async (...args) => { if (++calls > 3) throw new Error('corte sintético'); return original(...args); };
    try { await assert.rejects(seedDemo({ env }), /corte sintético/); } finally { skillCatalog.upsertSkill = original; }
    assert.equal(await SkillCatalog.count({ where: { status: 'draft' } }), 1);
    assert.equal(await SkillCatalog.count({ where: { status: 'published' } }), 0);
    assert.equal(await SkillDefinition.count(), 3); // quedó a medias
    const result = await seedDemo({ env });
    assert.deepEqual([result.skillCatalog, result.routeCatalog, result.participant], ['resumed', 'created', 'created']);
    assert.equal((await skillCatalog.getPublished()).skills.size, 8);
    assert.equal(await SkillCatalog.count({ where: { status: 'draft' } }), 0);
    assert.equal(await SkillCatalog.count(), 1); // reanudó el mismo borrador, no creó otro
  });

  await t.test('un corte a mitad del catálogo de rutas (con las habilidades ya publicadas) también se completa', async () => {
    await reset();
    const original = routeCatalog.upsertItem; let calls = 0;
    routeCatalog.upsertItem = async (...args) => { if (++calls > 5) throw new Error('corte sintético'); return original(...args); };
    try { await assert.rejects(seedDemo({ env }), /corte sintético/); } finally { routeCatalog.upsertItem = original; }
    assert.equal(await SkillCatalog.count({ where: { status: 'published' } }), 1); // solo las habilidades llegaron a publicarse
    assert.equal(await RouteCatalog.count({ where: { status: 'draft' } }), 1);
    assert.equal(await RouteCatalogItem.count(), 5);
    assert.equal(await User.count(), 0);
    const result = await seedDemo({ env });
    assert.deepEqual([result.skillCatalog, result.routeCatalog, result.participant], ['exists', 'resumed', 'created']);
    assert.equal(await RouteCatalog.count({ where: { status: 'published' } }), 1);
    assert.equal(await RouteCatalog.count({ where: { status: 'draft' } }), 0);
    assert.equal(await RouteCatalog.count(), 1);
  });

  await t.test('un borrador de habilidades del cliente con cualquier contenido real NO se toma por propio: se rechaza y queda intacto', async () => {
    await reset();
    const draft = await skillCatalog.createDraft();
    const [first, second] = demoSkills();
    const realLabels = { es: first.labels.es.replace('[SINTÉTICO] ', ''), en: first.labels.en.replace('[SYNTHETIC] ', '') };
    await skillCatalog.upsertSkill(draft.id, first.skillKey, { type: first.type, labels: realLabels, rubric: first.rubric });
    await skillCatalog.upsertSkill(draft.id, second.skillKey, { type: second.type, labels: second.labels, rubric: second.rubric });
    await rejected(seedDemo({ env }), 'draft_exists');
    assert.equal(await SkillDefinition.count({ where: { catalogId: draft.id } }), 2);
    assert.equal(await SkillCatalog.count({ where: { status: 'published' } }), 0);
    assert.equal(await RouteCatalog.count(), 0);
    assert.equal(await User.count(), 0);
  });

  await t.test('un borrador de rutas del cliente con un elemento no sintético tampoco se toma por propio', async () => {
    await reset();
    const draft = await routeCatalog.createDraft();
    const content = buildRouteCatalog();
    const [one, two] = Object.entries(content.contexts);
    await routeCatalog.upsertItem(draft.id, 'contexts', one[0], { ...one[1], synthetic: false });
    await routeCatalog.upsertItem(draft.id, 'contexts', two[0], two[1]);
    await rejected(seedDemo({ env }), 'draft_exists');
    assert.equal(await RouteCatalogItem.count({ where: { catalogId: draft.id } }), 2);
    assert.equal(await SkillCatalog.count(), 0); // el rechazo ocurre antes de publicar las habilidades
    assert.equal(await RouteCatalog.count({ where: { status: 'published' } }), 0);
  });

  await t.test('un fallo a mitad de camino se puede reanudar corriendo otra vez', async () => {
    await reset();
    await seedDemo({ env });
    await SkillAssessment.destroy({ where: {} }); // simula que las autoevaluaciones no llegaron a guardarse
    const result = await seedDemo({ env });
    assert.deepEqual([result.skillCatalog, result.routeCatalog, result.participant], ['exists', 'exists', 'exists']);
    assert.equal(await SkillAssessment.count({ where: { status: 'current' } }), DEMO_EVIDENCE.length);
  });
});
