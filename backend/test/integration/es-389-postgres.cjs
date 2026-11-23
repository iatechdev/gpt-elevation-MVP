// ES-389 contra Postgres REAL: los consumidores que leen texto GUARDADO (diario crudo, turnos del chat) y el puente profesional detectan la crisis aunque los espacios sean controles o invisibles.
// Regla de la prueba: el texto con invisibles debe dar EXACTAMENTE lo mismo que el texto limpio (el limpio es crisis: se excluye de las fuentes / se rechaza el campo).
// Crea y borra SOLO su propia base aleatoria en loopback. Cifrado y presupuesto reales; el PROVEEDOR de IA está simulado (nunca se llama a Claude real). Nunca carga .env.
// Uso (en backend/):  ES389_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres npm run test:crisis-consumers:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Sequelize } = require('sequelize');

const c = (...points) => String.fromCharCode(...points);

test('ES-389 PostgreSQL: diario crudo, turnos guardados y puente profesional con la frase de crisis hecha con controles/invisibles se tratan IGUAL que la frase limpia', { timeout: 180000 }, async (t) => {
  const source = process.env.ES389_TEST_DATABASE_URL;
  assert.ok(source, 'ES389_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es389_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es389_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source, { logging: false, dialectOptions: { ssl: false } });
  let sequelize; let created = false;
  t.after(async () => {
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // dbName lo genera este archivo, nunca viene de fuera
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  target.pathname = '/' + dbName;
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000';
  process.env.AI_BUDGET_TOKENS_COHORT = '1000000';
  process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const calls = [];
  const provider = { out: [] };
  const stub = { MODEL: 'test-model', messages: { create: async (body) => { calls.push(body); return { content: [{ type: 'text', text: JSON.stringify(provider.out) }], usage: { input_tokens: 100, output_tokens: 50 } }; } } };
  const anthropicPath = require.resolve('../../utils/anthropic');
  require.cache[anthropicPath] = { id: anthropicPath, filename: anthropicPath, loaded: true, exports: stub };

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'AiBudgetCounter', 'AiUsage', 'CareerContextVersion', 'BridgeTransfer', 'Evidence', 'EvidenceVersion', 'DeletionRequest', 'ParticipantResume', 'PricingPlan', 'User', 'AiJob', 'SkillCandidate']) require(`../../${name}`);
  await sequelize.sync();
  const consent = require('../../utils/consent');
  const bridge = require('../../utils/careerContext');
  const evidence = require('../../utils/evidence');
  const { proposeInsights } = require('../../utils/insightProposal');
  const { proposeEvidence } = require('../../utils/evidenceProposal');
  const ChatTurn = require('../../ChatTurn');
  const DiaryEntry = require('../../DiaryEntry');
  const { encriptarV2 } = require('../../utils/crypto');

  const SEPARATORS = { ZWSP: c(0x200B), ZWNJ: c(0x200C), ZWJ: c(0x200D), LRM: c(0x200E), WJ: c(0x2060), BOM: c(0xFEFF), SHY: c(0xAD), RLO: c(0x202E), VT: c(0x0B), FF: c(0x0C), NEL: c(0x85), FS: c(0x1C), US: c(0x1F), NUL: c(0), SOH: c(1) };
  const PHRASES = ['me quiero morir', 'no quiero seguir viviendo', 'quiero suicidarme', 'i want to kill myself'];
  const ORDINARY_DIARY = 'Me agota quedarme en reuniones largas sin decisiones.';
  const ORDINARY_CHAT = 'Disfruto coordinar equipos pequeños y presentar el plan a dirección.';
  let n = 0;
  const seq = () => { n += 1; return n; };
  const userId = 1;
  await consent.setConsent(userId, 'professional_bridge', 'granted');
  await consent.setConsent(userId, 'insights_diary', 'granted');
  await consent.setConsent(userId, 'insights_chat', 'granted');
  const diary = (text) => DiaryEntry.create({ UserId: userId, entryDate: `2026-10-${String(10 + (seq() % 18)).padStart(2, '0')}`, content: encriptarV2(text) });
  const turn = (text) => ChatTurn.create({ UserId: userId, requestId: `pg-turn-${String(seq()).padStart(6, '0')}`, status: 'completed', userContent: encriptarV2(text), replyContent: encriptarV2('RESPUESTA') });
  const reject = (fn) => fn().then(() => null, (e) => e);

  await t.test('diario crudo con invisibles → insightProposal: el resultado es el MISMO que con la frase limpia (se excluye; el proveedor no recibe la frase)', async () => {
    let cases = 0;
    for (const phrase of PHRASES) {
      const clean = await diary(phrase);
      const before = calls.length;
      const cleanError = await reject(() => proposeInsights(userId, { sources: ['diary'], entryIds: [clean.id], locale: 'es' }));
      assert.equal(cleanError?.code, 'no_usable_source', `la frase limpia se excluye: ${phrase}`);
      for (const [name, separator] of Object.entries(SEPARATORS)) {
        cases += 1;
        const entry = await diary(phrase.split(' ').join(separator));
        const error = await reject(() => proposeInsights(userId, { sources: ['diary'], entryIds: [entry.id], locale: 'es' }));
        assert.equal(error?.code, cleanError.code, `${name}: «${phrase}» debe dar lo mismo que la limpia (${error?.code ?? 'sin error'})`);
      }
      assert.equal(calls.length, before, 'el proveedor no se llamó para ninguna de las variantes');
    }
    assert.ok(cases >= 60, `casos: ${cases}`);
  });

  await t.test('diario ordinario (con invisibles inocuos) SÍ se usa: no hay falsos positivos', async () => {
    const entry = await diary(`Me agota quedarme${c(0x200B)}en reuniones${c(0x0B)}largas sin decisiones${c(0xAD)}.`);
    provider.out = [{ key: 'energy_drains', text: 'Parece que las reuniones largas sin decisiones te agotan.', quotes: [{ source: 'diary', id: entry.id, quote: 'Me agota' }] }];
    const result = await proposeInsights(userId, { sources: ['diary'], entryIds: [entry.id], locale: 'es' });
    assert.equal(result.insights.length, 1);
  });

  await t.test('un diario ordinario junto a uno de crisis con invisibles: solo viaja el ordinario', async () => {
    const ok = await diary(ORDINARY_DIARY); const bad = await diary(`me${c(0x200B)}quiero${c(0x200B)}morir`);
    provider.out = [{ key: 'energy_drains', text: 'Parece que las reuniones largas sin decisiones te agotan.', quotes: [{ source: 'diary', id: ok.id, quote: 'reuniones largas' }] }];
    const before = calls.length;
    await proposeInsights(userId, { sources: ['diary'], entryIds: [ok.id, bad.id], locale: 'es' });
    const sent = calls.slice(before).map((x) => JSON.stringify(x)).join('\n');
    assert.ok(!sent.includes('quiero') || sent.includes('reuniones largas'));
    assert.ok(!/me.{0,3}quiero.{0,3}morir/.test(sent), 'la frase de crisis NO viaja al proveedor');
  });

  await t.test('turnos del chat guardados CRUDOS con invisibles → evidenceProposal e insightProposal los excluyen igual que el limpio', async () => {
    for (const phrase of PHRASES.slice(0, 2)) {
      const clean = await turn(phrase);
      const cleanEvidence = await reject(() => proposeEvidence(userId, { turnIds: [clean.id], locale: 'es' }));
      const cleanInsight = await reject(() => proposeInsights(userId, { sources: ['chat'], turnIds: [clean.id], locale: 'es' }));
      assert.equal(cleanEvidence?.code, 'no_usable_source'); assert.equal(cleanInsight?.code, 'no_usable_source');
      for (const [name, separator] of Object.entries(SEPARATORS)) {
        const stored = await turn(phrase.split(' ').join(separator));
        const before = calls.length;
        const evidenceError = await reject(() => proposeEvidence(userId, { turnIds: [stored.id], locale: 'es' }));
        const insightError = await reject(() => proposeInsights(userId, { sources: ['chat'], turnIds: [stored.id], locale: 'es' }));
        assert.equal(evidenceError?.code, 'no_usable_source', `evidenceProposal ${name}: «${phrase}»`);
        assert.equal(insightError?.code, 'no_usable_source', `insightProposal ${name}: «${phrase}»`);
        assert.equal(calls.length, before, 'sin llamada al proveedor');
      }
    }
  });

  await t.test('evidence.js (cita de un turno): el turno guardado con invisibles se rechaza igual que el limpio (origin_not_usable)', async () => {
    const clean = await turn('me quiero morir');
    const stored = await turn(`me${c(0x200B)}quiero${c(0x200B)}morir`);
    const ids = (id) => ({ payload: { title: 't', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'autonomous' }, status: 'confirmed', requestId: `pg-req-${String(seq()).padStart(6, '0')}`, origins: [{ type: 'chat_turn', id }] });
    const create = (id) => reject(() => evidence.create(userId, ids(id)));
    const cleanError = await create(clean.id); const storedError = await create(stored.id);
    assert.ok(cleanError, 'la limpia se rechaza'); assert.equal(storedError?.code, cleanError.code, 'misma respuesta que la limpia');
  });

  await t.test('puente profesional (careerContext): el campo con la frase hecha con controles/invisibles → 422 field_not_shareable, igual que el limpio; un campo ordinario pasa', async () => {
    const preview = (text) => reject(() => bridge.preview(userId, { fields: [{ key: 'motivations', text }] }));
    const cleanError = await preview('me quiero morir');
    assert.equal(cleanError?.status, 422); assert.equal(cleanError?.code, 'field_not_shareable');
    for (const [name, separator] of Object.entries(SEPARATORS)) {
      const error = await preview(`me${separator}quiero${separator}morir`);
      assert.equal(error?.status, 422, `${name}`); assert.equal(error?.code, 'field_not_shareable', `${name}`);
    }
    assert.equal(await preview(`Me importa${c(0x200B)}aprender${c(0x200B)}cada día`), null, 'un campo ordinario con invisibles pasa');
  });

  await t.test('texto que PROPONE EL MODELO (buildInsight) con la frase de crisis hecha con controles/invisibles: se DESCARTA igual que la limpia; el insight ordinario se conserva', async () => {
    const entry = await diary(ORDINARY_DIARY);
    const ordinary = { key: 'energy_drains', text: 'Parece que las reuniones largas sin decisiones te agotan.', quotes: [{ source: 'diary', id: entry.id, quote: 'Me agota' }] };
    const withText = (text) => ({ key: 'motivations', text, quotes: [{ source: 'diary', id: entry.id, quote: 'Me agota' }] });
    const run = async (items) => { provider.out = items; return proposeInsights(userId, { sources: ['diary'], entryIds: [entry.id], locale: 'es' }); };
    const clean = await run([ordinary, withText('Parece que dices: me quiero morir.')]);
    assert.equal(clean.insights.length, 1); assert.equal(clean.discarded, 1, 'la limpia se descarta');
    for (const [name, separator] of Object.entries(SEPARATORS)) {
      const result = await run([ordinary, withText(`Parece que dices: me${separator}quiero${separator}morir.`)]);
      assert.equal(result.insights.length, 1, `${name}: solo queda el ordinario`);
      assert.equal(result.discarded, clean.discarded, `${name}: igual que la limpia`);
      assert.ok(!JSON.stringify(result.insights).includes('quiero'), `${name}: la frase de crisis no sale en la propuesta`);
    }
    const ok = await run([ordinary, withText(`Parece que te importa${c(0x200B)}aprender${c(0x0B)}cada día.`)]);
    assert.equal(ok.insights.length, 2, 'un texto del modelo ordinario con invisibles inocuos se conserva (sin falso positivo)');
  });

  assert.ok(ORDINARY_CHAT.length > 0);
});
