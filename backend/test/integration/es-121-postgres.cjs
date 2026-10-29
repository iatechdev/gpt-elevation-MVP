// ES-121 contra Postgres REAL (cifrado real, transacciones y bloqueos reales; el PROVEEDOR de IA está simulado: no se llama a Claude real).
// Crea y borra SOLO su propia base aleatoria en un servidor de loopback. Nunca carga .env ni usa DATABASE_URL.
// Uso (en backend/):  ES121_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54329/postgres npm run test:insights:pg
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const crypto = require('node:crypto');
const { Sequelize } = require('sequelize');

test('ES-121 PostgreSQL: insights desde chat y diario cifrados, consentimiento por fuente en transacción, autorizar y «En conversación»', { timeout: 120000 }, async (t) => {
  const source = process.env.ES121_TEST_DATABASE_URL;
  assert.ok(source, 'ES121_TEST_DATABASE_URL debe apuntar a un PostgreSQL local desechable.');
  const target = new URL(source);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Solo se permite PostgreSQL en loopback.');
  const dbName = `es121_test_${randomBytes(8).toString('hex')}`;
  assert.match(dbName, /^es121_test_[a-f0-9]{16}$/);
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
  sequelize = new Sequelize(target.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 8000 } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  process.env.AI_BUDGET_TOKENS_PER_USER = '1000000';
  process.env.AI_BUDGET_TOKENS_COHORT = '1000000';
  process.env.AI_BUDGET_PERIOD = 'month';
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  const calls = [];
  const provider = { out: null };
  const stub = { MODEL: 'test-model', messages: { create: async (body) => { calls.push(body); return { content: [{ type: 'text', text: JSON.stringify(provider.out) }], usage: { input_tokens: 100, output_tokens: 50 } }; } } };
  const anthropicPath = require.resolve('../../utils/anthropic');
  require.cache[anthropicPath] = { id: anthropicPath, filename: anthropicPath, loaded: true, exports: stub };

  for (const name of ['Consent', 'ConsentEvent', 'ChatTurn', 'DiaryEntry', 'DerivedInvalidation', 'SkillCatalog', 'SkillDefinition', 'SkillAssessment', 'AiBudgetCounter', 'AiUsage', 'CareerContextVersion', 'BridgeTransfer', 'Evidence', 'EvidenceVersion', 'DeletionRequest', 'ParticipantResume', 'PricingPlan', 'User']) require(`../../${name}`);
  await sequelize.sync();
  const consent = require('../../utils/consent');
  const catalog = require('../../utils/skillCatalog');
  const bridge = require('../../utils/careerContext');
  const skillMap = require('../../utils/skillMap');
  const { proposeInsights } = require('../../utils/insightProposal');
  const ChatTurn = require('../../ChatTurn');
  const DiaryEntry = require('../../DiaryEntry');
  const Usage = require('../../AiUsage');
  const Version = require('../../CareerContextVersion');
  const { encriptarV2, encriptarBuffer } = require('../../utils/crypto');
  const ParticipantResume = require('../../ParticipantResume');
  const { makeTextPdf } = require('../support/pdfFixtures.cjs');

  const levels = Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `nivel ${n}`, en: `level ${n}` }]));
  const def = (name) => ({ type: 'transversal', labels: { es: name, en: name }, rubric: { levels, source: 'Fuente sintética', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' } });
  const draft = await catalog.createDraft();
  await catalog.upsertSkill(draft.id, 'comunicacion', def('comunicacion'));
  await catalog.publish(draft.id, 1);

  const CHAT = 'Disfruto coordinar equipos pequeños y presentar el plan a dirección.';
  const DIARY = 'Me agota quedarme en reuniones largas sin decisiones.';
  const turn = await ChatTurn.create({ UserId: 1, requestId: 'pg-turn-0001', status: 'completed', userContent: encriptarV2(CHAT), replyContent: encriptarV2('RESPUESTA-ASISTENTE') });
  const entry = await DiaryEntry.create({ UserId: 1, entryDate: '2026-10-02', content: encriptarV2(DIARY) });
  const foreign = await DiaryEntry.create({ UserId: 2, entryDate: '2026-10-02', content: encriptarV2('DIARIO-AJENO') });

  await t.test('lee chat y diario CIFRADOS de verdad solo con el consentimiento de cada fuente; registra uso sin contenido y no guarda nada', async () => {
    const raw = await sequelize.query(`SELECT content FROM "DiaryEntries" WHERE id = :id`, { replacements: { id: entry.id }, type: 'SELECT' });
    assert.match(raw[0].content, /^v2:/);
    provider.out = [{ key: 'energy_drains', text: 'Parece que las reuniones largas sin decisiones te agotan.', quotes: [{ source: 'diary', id: entry.id, quote: 'reuniones largas sin decisiones' }] }];
    await assert.rejects(proposeInsights(1, { sources: ['diary'], entryIds: [entry.id] }), (e) => e.code === 'consent_required' && e.purpose === 'insights_diary');
    assert.equal(calls.length, 0);
    await consent.setConsent(1, 'insights_diary', 'granted');
    const r = await proposeInsights(1, { sources: ['diary'], entryIds: [entry.id], locale: 'es' });
    assert.deepEqual(r.insights[0].origins, [{ type: 'diary_entry', id: entry.id, quote: 'reuniones largas sin decisiones' }]);
    assert.match(calls.at(-1).messages[0].content, /reuniones largas sin decisiones/); // descifrado para el modelo
    assert.doesNotMatch(calls.at(-1).messages[0].content, /RESPUESTA-ASISTENTE|DIARIO-AJENO|Disfruto coordinar/);
    assert.equal(await Version.count({ where: { UserId: 1 } }), 0); // sin estado
    assert.equal(await Usage.count({ where: { UserId: 1, kind: 'insight_proposal', status: 'completed' } }), 1);
    const usage = await sequelize.query(`SELECT * FROM "AiUsages" WHERE kind = 'insight_proposal'`, { type: 'SELECT' });
    assert.doesNotMatch(JSON.stringify(usage), /reuniones largas|Disfruto|RESPUESTA/); // el registro de uso no guarda contenido
    // un id ajeno es indistinguible de uno inexistente
    await assert.rejects(proposeInsights(1, { sources: ['diary'], entryIds: [foreign.id] }), (e) => e.code === 'origin_not_found');
    // chat sin su consentimiento: no se lee ni se llama a la IA
    const before = calls.length;
    await assert.rejects(proposeInsights(1, { sources: ['chat', 'diary'] }), (e) => e.code === 'consent_required' && e.purpose === 'insights_chat');
    assert.equal(calls.length, before);
  });

  await t.test('ES121-QA-01: más propuestas simultáneas que conexiones del pool (20 personas, pool de 5) terminan todas, sin errores ni bloqueos', async () => {
    const people = Array.from({ length: 20 }, (_, i) => 500 + i);
    for (const id of people) {
      await consent.setConsent(id, 'insights_chat', 'granted');
      await consent.setConsent(id, 'insights_diary', 'granted');
      await ChatTurn.create({ UserId: id, requestId: 'pool-turn-' + id, status: 'completed', userContent: encriptarV2('Mensaje de la persona ' + id + ' sobre su trabajo'), replyContent: encriptarV2('r') });
      await DiaryEntry.create({ UserId: id, entryDate: '2026-10-05', content: encriptarV2('Nota del diario de la persona ' + id) });
    }
    provider.out = [];
    const started = Date.now();
    const results = await Promise.allSettled(people.map((id) => proposeInsights(id, { sources: ['chat', 'diary'] })));
    const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason && (r.reason.name || r.reason.code));
    assert.deepEqual(failed, [], 'ninguna propuesta falla por agotar el pool: ' + failed.join(','));
    assert.ok(Date.now() - started < 20000, 'terminan sin esperar al tiempo máximo de conexión');
    // y el pool sigue sano después
    assert.equal((await sequelize.query('SELECT 1 AS ok', { type: 'SELECT' }))[0].ok, 1);
  });

  await t.test('revocar una fuente mientras otra petición ya la leyó no rompe nada; la siguiente petición la rechaza (bloqueo compartido real)', async () => {
    await consent.setConsent(1, 'insights_chat', 'granted');
    provider.out = [];
    const concurrent = await Promise.allSettled([
      proposeInsights(1, { sources: ['chat'], turnIds: [turn.id] }),
      consent.setConsent(1, 'insights_chat', 'revoked'),
      proposeInsights(1, { sources: ['chat'], turnIds: [turn.id] }),
    ]);
    assert.ok(concurrent.every((r) => r.status === 'fulfilled' || r.reason.code === 'consent_required'), JSON.stringify(concurrent.map((r) => r.status)));
    await assert.rejects(proposeInsights(1, { sources: ['chat'], turnIds: [turn.id] }), (e) => e.code === 'consent_required');
    assert.equal((await sequelize.query(`SELECT status FROM "Consents" WHERE "UserId" = 1 AND purpose = 'insights_chat'`, { type: 'SELECT' }))[0].status, 'revoked');
  });

  await t.test('autorizar: la habilidad y el origen quedan en la versión (cifrada), el motor lee solo clave y texto y «En conversación» sigue a la versión activa', async () => {
    await consent.setConsent(1, 'professional_bridge', 'granted');
    const fields = [{ key: 'energy_gives', text: 'Parece que coordinar equipos pequeños te da energía.', origin: { type: 'chat_turn', id: turn.id }, skillKey: 'comunicacion' }];
    const p = await bridge.preview(1, { fields });
    const swapped = [{ ...fields[0], skillKey: 'planificacion' }];
    await assert.rejects(bridge.confirm(1, { fields: swapped, token: p.token, requestId: 'pg-conf-000001' }), (e) => e.status === 400 || e.status === 409); // no existe o no coincide
    const done = await bridge.confirm(1, { fields, token: p.token, requestId: 'pg-conf-000002' });
    assert.equal(done.created, true);
    const [row] = await sequelize.query(`SELECT payload, origins FROM "CareerContextVersions" WHERE "UserId" = 1 AND status = 'active'`, { type: 'SELECT' });
    assert.match(row.payload, /^v2:/); // el texto va cifrado
    assert.doesNotMatch(row.payload, /coordinar/);
    assert.equal(row.origins[0].skillKey, 'comunicacion');
    const mine = (await bridge.list(1)).active.fields[0];
    assert.deepEqual(mine, { key: 'energy_gives', text: fields[0].text, origin: { type: 'chat_turn', id: turn.id }, skillKey: 'comunicacion' });
    const delivered = await bridge.getApprovedContext(1, 'pg-test');
    assert.deepEqual(delivered.fields, [{ key: 'energy_gives', text: fields[0].text }]);
    assert.doesNotMatch(JSON.stringify(delivered), /skillKey|origin|comunicacion|chat_turn/);
    const map = await skillMap.getMap(1);
    assert.equal(map.skills.find((s) => s.skillKey === 'comunicacion').inConversation, true);
    assert.equal((await skillMap.getMap(2)).skills.find((s) => s.skillKey === 'comunicacion').inConversation, false); // solo el titular
    assert.equal(await sequelize.models.SkillAssessment.count({ where: { UserId: 1 } }), 0); // «En conversación» no crea evaluaciones
    // revocar el puente desactiva el estado en la misma transacción
    await consent.setConsent(1, 'professional_bridge', 'revoked');
    assert.equal((await skillMap.getMap(1)).skills.find((s) => s.skillKey === 'comunicacion').inConversation, false);
  });

  const CV_OLD = ['ANA PEREZ', 'ana.perez@example.test · +57 301 555 0100', 'Trabajé en logística y quiero pasar a un rol de análisis de datos.', 'Aprendo rápido cuando tengo problemas reales que resolver.'];
  const CV_NEW = ['ANA PEREZ', 'ana.perez@example.test · +57 301 555 0100', 'Coordino un equipo de cuatro personas y disfruto ordenar procesos confusos.', 'Busco un trabajo con autonomía y aprendizaje continuo cada semana.'];
  // La hoja de vida tiene clave foránea a Users: cada persona de la prueba existe de verdad (columnas obligatorias con valores sintéticos).
  const userColumns = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'", { type: 'SELECT' });
  const known = new Set();
  const ensureUser = async (id) => {
    if (known.has(id)) return; known.add(id);
    const names = ['id']; const values = [id];
    for (const c of userColumns) {
      let v;
      if (c.column_name === 'role') v = 'user';
      else if (c.data_type.includes('char') || c.data_type === 'text') v = c.column_name === 'email' ? 'sintetico-' + id + '@example.test' : 'sintetico-' + id + '-' + c.column_name;
      else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}';
      names.push('"' + c.column_name + '"'); values.push(v);
    }
    await sequelize.query('INSERT INTO "Users" (' + names.map((n) => (n === 'id' ? '"id"' : n)).join(',') + ') VALUES (' + values.map((_, i) => '$' + (i + 1)).join(',') + ')', { bind: values });
  };
  const savePdf = async (UserId, version, lines) => { await ensureUser(UserId); const buffer = makeTextPdf(lines); return ParticipantResume.create({ UserId, version, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), data: encriptarBuffer(buffer) }); };

  await t.test('hoja de vida: PDF cifrado de verdad, permiso propio, la última versión por defecto, sin contacto hacia la IA y solo la propia', async () => {
    const v1 = await savePdf(1, 1, CV_OLD);
    const v2 = await savePdf(1, 2, CV_NEW);
    const other = await savePdf(2, 1, ['Persona dos', 'CANARY-HOJA-AJENA con texto suficiente para ser leído como una hoja de vida completa.']);
    const [raw] = await sequelize.query('SELECT data FROM "ParticipantResumes" WHERE id = :id', { replacements: { id: v2.id }, type: 'SELECT' });
    assert.equal(Buffer.from(raw.data).includes(Buffer.from('Coordino')), false); // el PDF va cifrado
    provider.out = [{ key: 'desired_conditions', text: 'Parece que buscas un trabajo con autonomía.', quotes: [{ source: 'resume', id: v2.id, quote: 'Busco un trabajo con autonomía' }] }];
    await assert.rejects(proposeInsights(1, { sources: ['resume'] }), (e) => e.code === 'consent_required' && e.purpose === 'insights_resume');
    assert.equal(calls.filter((c) => /Coordino/.test(c.messages[0].content)).length, 0);
    await consent.setConsent(1, 'insights_resume', 'granted');
    const r = await proposeInsights(1, { sources: ['resume'], locale: 'es' });
    assert.deepEqual(r.insights[0].origins, [{ type: 'resume_version', id: v2.id, quote: 'Busco un trabajo con autonomía' }]);
    const prompt = calls.at(-1).messages[0].content;
    assert.match(prompt, /Coordino un equipo/);              // la versión más reciente
    assert.doesNotMatch(prompt, /logística/);                // no la anterior
    assert.doesNotMatch(prompt, /ana\.perez@example\.test|301 555 0100|CANARY-HOJA-AJENA/); // sin contacto y sin la hoja de otra persona
    provider.out = [];
    const older = await proposeInsights(1, { sources: ['resume'], resumeId: v1.id });
    assert.equal(older.usedSources.resume, 1);
    assert.match(calls.at(-1).messages[0].content, /logística/);
    await assert.rejects(proposeInsights(1, { sources: ['resume'], resumeId: other.id }), (e) => e.code === 'origin_not_found');
    await assert.rejects(proposeInsights(3, { sources: ['resume'] }), (e) => e.code === 'consent_required');
    await consent.setConsent(3, 'insights_resume', 'granted');
    await assert.rejects(proposeInsights(3, { sources: ['resume'] }), (e) => e.code === 'no_usable_source'); // sin hoja de vida
    const usage = await sequelize.query("SELECT * FROM \"AiUsages\" WHERE kind = 'insight_proposal'", { type: 'SELECT' });
    assert.doesNotMatch(JSON.stringify(usage), /Coordino|logística|ana\.perez/); // el registro de uso no guarda contenido
  });

  await t.test('hoja de vida: autorizar un insight con su origen; borrar la hoja de vida (o retirar su lectura con IA) lo marca para revisión sin perder lo autorizado', async () => {
    await consent.setConsent(1, 'professional_bridge', 'granted');
    const latest = await ParticipantResume.findOne({ where: { UserId: 1 }, order: [['version', 'DESC']] });
    const fields = [{ key: 'desired_conditions', text: 'Parece que buscas un trabajo con autonomía.', origin: { type: 'resume_version', id: latest.id } }];
    await assert.rejects(bridge.preview(1, { fields: [{ ...fields[0], origin: { type: 'resume_version', id: 987654 } }] }), (e) => e.status === 404);
    const foreignResume = await ParticipantResume.findOne({ where: { UserId: 2 } });
    await assert.rejects(bridge.preview(1, { fields: [{ ...fields[0], origin: { type: 'resume_version', id: foreignResume.id } }] }), (e) => e.status === 404);
    const p = await bridge.preview(1, { fields });
    await bridge.confirm(1, { fields, token: p.token, requestId: 'pg-conf-resume-1' });
    let active = (await bridge.list(1)).active;
    assert.deepEqual(active.fields[0].origin, { type: 'resume_version', id: latest.id });
    assert.equal(active.needsReview, false);
    await consent.setConsent(1, 'resume_ai_reading', 'granted');
    await consent.setConsent(1, 'resume_ai_reading', 'revoked'); // borra todas las versiones (ES-109)
    assert.equal(await ParticipantResume.count({ where: { UserId: 1 } }), 0);
    active = (await bridge.list(1)).active;
    assert.equal(active.needsReview, true);
    assert.equal(active.status, 'active'); // lo autorizado se conserva hasta que la persona decida
    await assert.rejects(proposeInsights(1, { sources: ['resume'] }), (e) => e.code === 'no_usable_source');
    const delivered = await bridge.getApprovedContext(1, 'pg-test');
    assert.doesNotMatch(JSON.stringify(delivered), /resume|origin/);
    await consent.setConsent(1, 'professional_bridge', 'revoked');
  });

  await t.test('hoja de vida: más propuestas simultáneas que conexiones del pool (20 personas, pool de 5) terminan todas', async () => {
    const people = Array.from({ length: 20 }, (_, i) => 700 + i);
    for (const id of people) { await consent.setConsent(id, 'insights_resume', 'granted'); await savePdf(id, 1, ['PERSONA ' + id, 'Me gusta coordinar equipos pequeños y ordenar procesos confusos en la empresa.', 'Busco aprender algo nuevo cada semana en mi trabajo.']); }
    provider.out = [];
    const results = await Promise.allSettled(people.map((id) => proposeInsights(id, { sources: ['resume'] })));
    const failed = results.filter((r) => r.status === 'rejected').map((r) => r.reason && (r.reason.name || r.reason.code));
    assert.deepEqual(failed, [], 'ninguna falla por agotar el pool: ' + failed.join(','));
    assert.equal((await sequelize.query('SELECT 1 AS ok', { type: 'SELECT' }))[0].ok, 1);
  });

});
