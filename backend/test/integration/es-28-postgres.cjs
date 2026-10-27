// ES-28 contra Postgres REAL (criptografía real y presupuesto de IA real; el PROVEEDOR de IA está simulado: no se llama a Claude real).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES28_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:proposals:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-28 PostgreSQL: propuestas con cifrado y presupuesto reales, confirmación atómica e idempotente bajo concurrencia', { timeout: 90000 }, async (t) => {
  const source = process.env.ES28_TEST_DATABASE_URL;
  assert.ok(source, 'ES28_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es28_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es28_test_[a-f0-9]{16}$/);
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
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000';
  process.env.AI_BUDGET_TOKENS_COHORT = '1000000';
  process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  // Proveedor simulado: se sustituye el cliente del SDK antes de cargar el resto.
  const calls = [];
  const provider = { out: null };
  const stub = { MODEL: 'test-model', messages: { create: async (body) => { calls.push(body); return { content: [{ type: 'text', text: JSON.stringify(provider.out) }], usage: { input_tokens: 100, output_tokens: 50 } }; } } };
  const anthropicPath = require.resolve('../../utils/anthropic');
  require.cache[anthropicPath] = { id: anthropicPath, filename: anthropicPath, loaded: true, exports: stub };

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'AiBudgetCounter', 'AiUsage']) require('../../' + name);
  await sequelize.sync();
  const consent = require('../../utils/consent');
  const evidence = require('../../utils/evidence');
  const catalog = require('../../utils/skillCatalog');
  const { proposeEvidence } = require('../../utils/evidenceProposal');
  const { proposeAssessments, confirmProposals } = require('../../utils/skillProposal');
  const ChatTurn = require('../../ChatTurn');
  const Assessment = require('../../SkillAssessment');
  const Version = require('../../EvidenceVersion');
  const Usage = require('../../AiUsage');
  const Counter = require('../../AiBudgetCounter');
  const { encriptarV2 } = require('../../utils/crypto');

  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
  let seq = 0;
  const rid = () => `pg-req-${String(++seq).padStart(6, '0')}`;
  const evBody = (over = {}) => ({
    payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous', ...over },
    status: 'confirmed', requestId: rid(),
  });
  const draft = await catalog.createDraft();
  await catalog.upsertSkill(draft.id, 'comunicacion', def('comunicacion'));
  await catalog.upsertSkill(draft.id, 'planificacion', def('planificacion'));
  await catalog.publish(draft.id, 1);

  await t.test('propuesta A: lee el turno cifrado de verdad, registra uso y presupuesto reales y no guarda evidencia', async () => {
    await consent.setConsent(1, 'professional_bridge', 'granted');
    const text = 'Dirigí la migración del archivo histórico durante tres meses con un equipo pequeño.';
    const turn = await ChatTurn.create({ UserId: 1, requestId: 'pg-turn-0001', status: 'completed', userContent: encriptarV2(text), replyContent: encriptarV2('RESPUESTA-ASISTENTE') });
    const [raw] = await sequelize.query(`SELECT "userContent" FROM "ChatTurns" WHERE id = :id`, { replacements: { id: turn.id }, type: 'SELECT' });
    assert.match(raw.userContent, /^v2:/);
    provider.out = { title: 'Migración del archivo', situation: 'Archivo histórico.', quotes: [{ turnId: turn.id, quote: 'durante tres meses' }] };
    const r = await proposeEvidence(1, { turnIds: [turn.id], locale: 'es' });
    assert.deepEqual(r.proposal.origins, [{ type: 'chat_turn', id: turn.id, quote: 'durante tres meses' }]);
    assert.match(calls.at(-1).messages[0].content, /Dirigí la migración/); // descifrado para el modelo
    assert.doesNotMatch(calls.at(-1).messages[0].content, /RESPUESTA-ASISTENTE/);
    assert.equal(await Version.count({ where: { UserId: 1 } }), 0);
    assert.equal(await Usage.count({ where: { UserId: 1, kind: 'evidence_proposal', status: 'completed' } }), 1);
    assert.equal((await Counter.findOne({ where: { UserId: 1 } })).used, 150); // tokens reales del proveedor simulado, ajustados
    // confirmar la evidencia con el token deja authoring ai_proposed en la base real
    await assert.rejects(evidence.create(1, { payload: r.proposal.payload, status: 'confirmed', requestId: rid(), origins: r.proposal.origins, proposalToken: r.token }), (e) => e.code === 'incomplete_evidence'); // el borrador de la IA está incompleto: la persona debe completarlo antes de confirmar
    const saved = await evidence.create(1, { payload: r.proposal.payload, status: 'draft', requestId: rid(), origins: r.proposal.origins, proposalToken: r.token });
    assert.equal((await Version.findOne({ where: { EvidenceId: saved.id } })).authoring, 'ai_proposed');
  });

  await t.test('propuesta B + confirmación: ocho confirmaciones con el mismo requestId a la vez crean una sola vez', async () => {
    const e = await evidence.create(2, evBody());
    provider.out = [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], rationale: 'Coordinó al equipo.' }];
    const p = await proposeAssessments(2, {});
    assert.equal(p.proposals[0].level, 3);
    assert.equal(await Assessment.count({ where: { UserId: 2 } }), 0);
    const body = { token: p.token, proposals: p.proposals, requestId: 'pg-same-000001', accept: ['comunicacion'] };
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => confirmProposals(2, body)));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
    assert.equal(results.filter((r) => r.value.created).length, 1);
    assert.equal(await Assessment.count({ where: { UserId: 2 } }), 1);
    const [row] = await sequelize.query(`SELECT rationale, authoring FROM "SkillAssessments" WHERE "UserId" = 2`, { type: 'SELECT' });
    assert.match(row.rationale, /^v2:/);
    assert.equal(row.authoring, 'ai_proposed');
  });

  await t.test('confirmaciones distintas de la misma habilidad a la vez dejan una sola vigente y ningún error', async () => {
    const e = await evidence.create(3, evBody());
    provider.out = [{ skillKey: 'planificacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], rationale: 'Organizó su trabajo.' }];
    const p = await proposeAssessments(3, {});
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => confirmProposals(3, { token: p.token, proposals: p.proposals, requestId: rid(), accept: ['planificacion'] })));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
    assert.equal(await Assessment.count({ where: { UserId: 3, status: 'current' } }), 1);
  });

  await t.test('atomicidad: si falla el guardado de la segunda habilidad no queda nada de la primera y la vigente anterior se conserva', async () => {
    const e = await evidence.create(4, evBody());
    const { selfAssess } = require('../../utils/skillMap');
    await selfAssess(4, { skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: e.id, version: 1 }], requestId: rid() });
    provider.out = [
      { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], rationale: 'uno' },
      { skillKey: 'planificacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], rationale: 'dos' },
    ];
    const p = await proposeAssessments(4, {});
    await sequelize.query(`CREATE FUNCTION es28_inject_failure() RETURNS trigger AS $$
      BEGIN IF NEW."skillKey" = 'planificacion' AND NEW.authoring = 'ai_proposed' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await sequelize.query(`CREATE TRIGGER es28_inject_failure BEFORE INSERT ON "SkillAssessments" FOR EACH ROW EXECUTE FUNCTION es28_inject_failure()`);
    try {
      await assert.rejects(confirmProposals(4, { token: p.token, proposals: p.proposals, requestId: rid(), accept: ['comunicacion', 'planificacion'] }));
    } finally {
      await sequelize.query('DROP TRIGGER es28_inject_failure ON "SkillAssessments"');
      await sequelize.query('DROP FUNCTION es28_inject_failure()');
    }
    const rows = await Assessment.findAll({ where: { UserId: 4 } });
    assert.deepEqual(rows.map((r) => [r.skillKey, r.level, r.status, r.authoring]), [['comunicacion', 2, 'current', 'person']]); // intacto
  });
});
