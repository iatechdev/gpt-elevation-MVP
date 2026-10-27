// ES-29 contra Postgres REAL (criptografía real). Crea y borra SOLO su propia base aleatoria en un servidor de loopback.
// Nunca carga .env, nunca usa DATABASE_URL y nunca llama a un proveedor externo.
// Uso (en backend/):  ES29_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:skillmap:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-29 PostgreSQL: catálogo, índices únicos parciales, concurrencia de evaluaciones e invalidación por cambio de evidencia', { timeout: 90000 }, async (t) => {
  const source = process.env.ES29_TEST_DATABASE_URL;
  assert.ok(source, 'ES29_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es29_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es29_test_[a-f0-9]{16}$/);
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

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DerivedInvalidation', 'Evidence', 'EvidenceVersion', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'CareerContextVersion', 'BridgeTransfer', 'DeletionRequest']) require('../../' + name);
  await sequelize.sync();
  const catalog = require('../../utils/skillCatalog');
  const skillMap = require('../../utils/skillMap');
  const evidence = require('../../utils/evidence');
  const Assessment = require('../../SkillAssessment');
  const Catalog = require('../../SkillCatalog');
  const Invalidation = require('../../DerivedInvalidation');
  const consent = require('../../utils/consent');
  const ChatTurn = require('../../ChatTurn');
  const { encriptarV2 } = require('../../utils/crypto');

  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
  let seq = 0;
  const rid = () => `pg-req-${String(++seq).padStart(6, '0')}`;
  const evBody = (over = {}) => ({
    payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous', ...over },
    status: 'confirmed', requestId: rid(),
  });

  await t.test('existen los índices únicos parciales (un catálogo vigente, un borrador, una evaluación vigente por pista)', async () => {
    const rows = await sequelize.query(`SELECT tablename, indexdef FROM pg_indexes WHERE tablename IN ('SkillCatalogs','SkillAssessments') AND indexdef ILIKE '%UNIQUE%'`, { type: 'SELECT' });
    const defs = rows.map((r) => r.indexdef).join('\n');
    assert.match(defs, /published/);
    assert.match(defs, /draft/);
    assert.match(defs, /current/);
  });

  await t.test('dos borradores simultáneos: solo uno se crea', async () => {
    const results = await Promise.allSettled([catalog.createDraft(), catalog.createDraft(), catalog.createDraft()]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['draft_exists', 'conflict'].includes(r.reason.code)));
    assert.equal(await Catalog.count({ where: { status: 'draft' } }), 1);
  });

  await t.test('publicar dos veces a la vez el mismo borrador: una gana y la otra recibe catalog_not_editable', async () => {
    const [draft] = await Catalog.findAll({ where: { status: 'draft' } });
    await catalog.upsertSkill(draft.id, 'comunicacion', def('comunicacion'));
    await catalog.upsertSkill(draft.id, 'planificacion', def('planificacion'));
    const results = await Promise.allSettled([catalog.publish(draft.id, 1), catalog.publish(draft.id, 2)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.ok(results.filter((r) => r.status === 'rejected').every((r) => ['catalog_not_editable', 'conflict'].includes(r.reason.code)));
    assert.equal(await Catalog.count({ where: { status: 'published' } }), 1);
    const published = await catalog.getPublished();
    assert.deepEqual([...published.skills.keys()].sort(), ['comunicacion', 'planificacion']);
  });

  await t.test('ocho autoevaluaciones simultáneas de la misma habilidad dejan una sola vigente y ningún error', async () => {
    const e = await evidence.create(1, evBody());
    const refs = [{ evidenceId: e.id, version: 1 }];
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) =>
      skillMap.selfAssess(1, { skillKey: 'comunicacion', level: (i % 4) + 1, evidenceRefs: refs, requestId: rid(), rationale: `nota ${i}` })));
    assert.deepEqual(results.filter((r) => r.status === 'rejected').map((r) => r.reason.message), []);
    assert.equal(await Assessment.count({ where: { UserId: 1, skillKey: 'comunicacion', track: 'self', status: 'current' } }), 1);
    assert.equal(await Assessment.count({ where: { UserId: 1, skillKey: 'comunicacion' } }), 8);
    const [row] = await sequelize.query(`SELECT rationale FROM "SkillAssessments" WHERE "UserId" = 1 LIMIT 1`, { type: 'SELECT' });
    assert.match(row.rationale, /^v2:/); // la nota va cifrada y no se lee en claro
    assert.doesNotMatch(row.rationale, /nota/);
  });

  await t.test('el mismo requestId repetido a la vez crea una sola evaluación', async () => {
    const e = await evidence.create(2, evBody());
    const body = { skillKey: 'planificacion', level: 2, evidenceRefs: [{ evidenceId: e.id, version: 1 }], requestId: 'pg-same-000001' };
    const results = await Promise.all(Array.from({ length: 8 }, () => skillMap.selfAssess(2, body)));
    assert.equal(await Assessment.count({ where: { UserId: 2 } }), 1);
    assert.equal(results.filter((r) => r.created).length, 1);
  });

  await t.test('editar la evidencia deja el nivel en null (stale) y el evento de invalidación se procesa', async () => {
    const e = await evidence.create(3, evBody());
    await skillMap.selfAssess(3, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }], requestId: rid() });
    const before = (await skillMap.getMap(3)).skills.find((s) => s.skillKey === 'comunicacion');
    assert.equal(before.self.level, 3);
    await evidence.update(3, e.id, { ...evBody({ learning: 'cambio' }), baseVersion: 1 });
    assert.equal(await Invalidation.count({ where: { UserId: 3, sourceType: 'evidence', handledAt: null } }), 1);
    const after = (await skillMap.getMap(3)).skills.find((s) => s.skillKey === 'comunicacion');
    assert.deepEqual([after.self.level, after.self.stale], [null, true]);
    assert.equal(await Invalidation.count({ where: { UserId: 3, sourceType: 'evidence', handledAt: null } }), 0);
    assert.equal((await Assessment.findOne({ where: { UserId: 3 } })).level, 3); // la fila histórica no se reescribe
  });
  await t.test('coexistencia con los ganchos de consentimiento: revocar el puente deja stale solo lo que se apoya en evidencia del chat; lo demás del mapa sigue', async () => {
    const userId = 4;
    await consent.setConsent(userId, 'professional_bridge', 'granted');
    const turn = await ChatTurn.create({ UserId: userId, requestId: 'turn-skill-0001', status: 'completed', userContent: encriptarV2('Lideré la planificación sintética del equipo'), replyContent: encriptarV2('r') });
    const fromChat = await evidence.create(userId, { ...evBody(), origins: [{ type: 'chat_turn', id: turn.id, quote: 'lideré la planificación' }] });
    const direct = await evidence.create(userId, evBody());
    await skillMap.selfAssess(userId, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: fromChat.id, version: 1 }], requestId: rid() });
    await skillMap.selfAssess(userId, { skillKey: 'planificacion', level: 2, evidenceRefs: [{ evidenceId: direct.id, version: 1 }], requestId: rid() });
    const level = async (key) => { const s = (await skillMap.getMap(userId)).skills.find((x) => x.skillKey === key).self; return [s.level, s.stale]; };
    assert.deepEqual([await level('comunicacion'), await level('planificacion')], [[3, false], [2, false]]);
    await consent.setConsent(userId, 'professional_bridge', 'revoked');
    assert.deepEqual(await level('comunicacion'), [null, true]); // la evidencia del chat dejó de estar vigente
    assert.deepEqual(await level('planificacion'), [2, false]); // la evidencia directa no depende del puente
    assert.equal(await Invalidation.count({ where: { UserId: userId, sourceType: 'evidence', sourceId: fromChat.id, reason: 'revoked' } }), 1);
    assert.equal(await Invalidation.count({ where: { UserId: userId, sourceType: 'evidence', sourceId: direct.id, reason: 'revoked' } }), 0);
    assert.equal(await Assessment.count({ where: { UserId: userId, status: 'current' } }), 2); // las filas históricas no se reescriben ni se borran
  });
});
