// ES-161 contra Postgres REAL: pedir un análisis NUEVO no pisa las decisiones ya tomadas. El PROVEEDOR de IA está simulado (no se llama a Claude real).
// Lo que garantiza la pantalla «Analizar otras» / «Pedir una propuesta nueva»: lo guardado vive en el servidor y SOLO lo que la persona acepta cambia algo.
//   - guardar A, pedir una propuesta nueva para A y descartarla → A sigue igual (una sola fila vigente);
//   - una propuesta nueva con varias habilidades, de las que solo se acepta una → el resto no se toca;
//   - un nivel «bajado» o «dejado sin evaluar» solo afecta a esa habilidad; nunca se puede SUBIR por encima de lo propuesto;
//   - una propuesta ajena (otro token/persona) no se puede confirmar; el mismo requestId no duplica.
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES161_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run test:analysis-update:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-161 PostgreSQL: una propuesta nueva no pisa decisiones ya tomadas', { timeout: 90000 }, async (t) => {
  const source = process.env.ES161_TEST_DATABASE_URL;
  assert.ok(source, 'ES161_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es161_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es161_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8, min: 0 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000'; process.env.AI_BUDGET_TOKENS_COHORT = '1000000'; process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const provider = { out: null };
  const stub = { MODEL: 'test-model', messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify(provider.out) }], usage: { input_tokens: 100, output_tokens: 50 } }) } };
  const anthropicPath = require.resolve('../../utils/anthropic');
  require.cache[anthropicPath] = { id: anthropicPath, filename: anthropicPath, loaded: true, exports: stub };

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'PricingPlan', 'User', 'SkillCandidate', 'AiBudgetCounter', 'AiUsage']) {
    try { require('../../' + name); } catch { /* el modelo puede no existir con ese nombre */ }
  }
  await sequelize.sync();
  const evidence = require('../../utils/evidence');
  const catalog = require('../../utils/skillCatalog');
  const { proposeAssessments, confirmProposals } = require('../../utils/skillProposal');
  const Assessment = require('../../SkillAssessment');

  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
  let seq = 0; const rid = () => `pg161-req-${String(++seq).padStart(6, '0')}`;
  const evBody = () => ({ payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status: 'confirmed', requestId: rid() });
  const draft = await catalog.createDraft();
  for (const key of ['comunicacion', 'planificacion', 'liderazgo']) await catalog.upsertSkill(draft.id, key, def(key));
  await catalog.publish(draft.id, 1);
  const rows = async (userId) => (await Assessment.findAll({ where: { UserId: userId }, order: [['id', 'ASC']] })).map((r) => [r.skillKey, r.level, r.status, r.authoring]);
  const proposal = (key, level, e) => ({ skillKey: key, level, evidenceRefs: [{ evidenceId: e.id, version: 1 }], rationale: `Razón sintética de ${key}.` });
  const propose = async (userId, out) => { provider.out = out; return proposeAssessments(userId, {}); };
  const confirm = (userId, p, accept, extra = {}) => confirmProposals(userId, { token: p.token, proposals: p.proposals, requestId: rid(), accept, ...extra });

  await t.test('guardar A, pedir una propuesta nueva para A y descartarla: A sigue igual (una sola fila vigente)', async () => {
    const e = await evidence.create(1, evBody());
    const first = await propose(1, [proposal('comunicacion', 3, e)]);
    await confirm(1, first, ['comunicacion']);
    assert.deepEqual(await rows(1), [['comunicacion', 3, 'current', 'ai_proposed']]);
    const again = await propose(1, [proposal('comunicacion', 2, e)]); // «Analizar otras»: otra versión de la propuesta
    assert.equal(again.proposals[0].level, 2);
    assert.deepEqual(await rows(1), [['comunicacion', 3, 'current', 'ai_proposed']], 'pedirla no cambia nada');
    // la persona la descarta: no hay confirmación; el estado guardado se conserva, también tras otra lectura
    assert.deepEqual(await rows(1), [['comunicacion', 3, 'current', 'ai_proposed']]);
  });

  await t.test('una propuesta nueva con varias habilidades: solo lo aceptado cambia; lo demás no se toca', async () => {
    const e = await evidence.create(2, evBody());
    const first = await propose(2, [proposal('comunicacion', 3, e), proposal('planificacion', 2, e)]);
    await confirm(2, first, ['comunicacion', 'planificacion']);
    const second = await propose(2, [proposal('comunicacion', 4, e), proposal('planificacion', 3, e), proposal('liderazgo', 2, e)]);
    await confirm(2, second, ['liderazgo']); // acepta SOLO liderazgo
    const state = await rows(2);
    assert.deepEqual(state.filter(([k]) => k === 'comunicacion'), [['comunicacion', 3, 'current', 'ai_proposed']], 'comunicacion no se pisó');
    assert.deepEqual(state.filter(([k]) => k === 'planificacion'), [['planificacion', 2, 'current', 'ai_proposed']], 'planificacion no se pisó');
    assert.deepEqual(state.filter(([k]) => k === 'liderazgo'), [['liderazgo', 2, 'current', 'ai_proposed']]);
    assert.equal(state.filter(([, , status]) => status === 'current').length, 3, 'una vigente por habilidad');
  });

  await t.test('bajar o dejar sin evaluar solo afecta a esa habilidad; subir por encima de lo propuesto se rechaza y no cambia nada', async () => {
    const e = await evidence.create(3, evBody());
    const first = await propose(3, [proposal('comunicacion', 3, e), proposal('planificacion', 3, e)]);
    await confirm(3, first, ['comunicacion', 'planificacion']);
    const second = await propose(3, [proposal('comunicacion', 3, e), proposal('planificacion', 3, e)]);
    await assert.rejects(confirm(3, second, ['comunicacion'], { overrides: { comunicacion: 4 } }), (error) => error.code === 'cannot_raise_level');
    assert.deepEqual((await rows(3)).filter(([, , status]) => status === 'current').map(([k, l]) => [k, l]).sort(), [['comunicacion', 3], ['planificacion', 3]], 'el rechazo no cambió nada');
    await confirm(3, second, ['comunicacion', 'planificacion'], { overrides: { comunicacion: 2, planificacion: null } });
    const current = Object.fromEntries((await rows(3)).filter(([, , status]) => status === 'current').map(([k, l]) => [k, l]));
    assert.deepEqual(current, { comunicacion: 2 }, 'comunicacion bajó a 2; planificacion quedó sin evaluar (sin fila vigente)');
  });

  await t.test('el mismo requestId no duplica y una propuesta de otra persona no se puede confirmar', async () => {
    const e = await evidence.create(4, evBody()); const f = await evidence.create(5, evBody());
    const mine = await propose(4, [proposal('comunicacion', 3, e)]);
    const body = { token: mine.token, proposals: mine.proposals, requestId: 'pg161-same-00001', accept: ['comunicacion'] };
    await confirmProposals(4, body); await confirmProposals(4, body);
    assert.equal((await rows(4)).filter(([, , status]) => status === 'current').length, 1, 'repetir el mismo requestId no duplica');
    const theirs = await propose(5, [proposal('comunicacion', 4, f)]);
    await assert.rejects(confirmProposals(4, { token: theirs.token, proposals: theirs.proposals, requestId: rid(), accept: ['comunicacion'] }));
    assert.deepEqual((await rows(4)).filter(([, , status]) => status === 'current').map(([k, l]) => [k, l]), [['comunicacion', 3]], 'la propuesta ajena no cambió lo mío');
    assert.deepEqual(await rows(5), [], 'ni escribió en la persona dueña de la propuesta');
  });
});
