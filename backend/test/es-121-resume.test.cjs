// ES-121 (hoja de vida): la hoja de vida como fuente de insights, con su propia autorización `insights_resume`. PDFs sintéticos reales (lectura y
// depuración reales), proveedor, modelos y crypto de archivo simulados o reales según test/support.cjs: NO se llama a Claude real.
// Postgres real (último vs. versión indicada, bloqueos): test/integration/es-121-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { anthropic, startApp } = require('./support.cjs');
const { install } = require('./es-29-store.cjs');
const { makeTextPdf, makeScannedPdf, makeCorruptPdf } = require('./support/pdfFixtures.cjs');
const { encriptarBuffer } = require('../utils/crypto');

// Se mide cuántas extracciones de PDF corren a la vez (debe cargarse ANTES de que la aplicación importe el módulo).
const pdfModule = require('../utils/resumePdf');
const realExtract = pdfModule.extractResumeText;
const extraction = { active: 0, max: 0, total: 0 };
pdfModule.extractResumeText = async (buffer) => {
  extraction.active += 1; extraction.total += 1; extraction.max = Math.max(extraction.max, extraction.active);
  try { await new Promise((resolve) => setTimeout(resolve, 15)); return await realExtract(buffer); } finally { extraction.active -= 1; }
};

const U = { role: 'user', id: 101 };
const V = { role: 'user', id: 202 };
let counter = 0;
const rid = () => `req-${String(++counter).padStart(6, '0')}`;

const CONTACT = ['maria.gomez@example.test', '+57 300 123 4567', 'linkedin.com/in/maria-gomez', 'Calle 45 # 12-34'];
const CV = ['MARIA GOMEZ', 'maria.gomez@example.test · +57 300 123 4567', 'linkedin.com/in/maria-gomez', 'Calle 45 # 12-34, Bogota',
  'Lideré un equipo de diseño pequeño y disfruto acompañar a las personas nuevas.', 'Prefiero proyectos donde pueda aprender cada semana y trabajar con autonomía.',
  'Lider de diseño · Estudio Norte · 2021-2026', 'Disenadora UX · Agencia Brujula · 2018-2021'];
const FOREIGN_CANARY = 'CANARY-HOJA-AJENA-DE-OTRA-PERSONA';
const QUOTE = 'disfruto acompañar a las personas nuevas';
const GOOD_TEXT = 'Parece que acompañar a personas nuevas te da energía.';

function setup() {
  const { state, add } = install();
  const calls = [];
  const provider = { out: null, usage: { input_tokens: 100, output_tokens: 50 }, fail: null };
  anthropic.messages.create = async (body) => {
    calls.push(body);
    if (provider.fail) throw provider.fail;
    return { content: [{ type: 'text', text: typeof provider.out === 'string' ? provider.out : JSON.stringify(provider.out) }], usage: provider.usage };
  };
  const pdf = (buffer, UserId = 101, version = 1) => add('ParticipantResume', { UserId, version, size: buffer.length, sha256: String(UserId * 10 + version).padStart(64, '0'), data: encriptarBuffer(buffer) });
  const mine = pdf(makeTextPdf(CV));
  const foreign = pdf(makeTextPdf([FOREIGN_CANARY, 'Otra persona con una hoja de vida distinta y suficiente texto para leerse.', 'Disfruto cosas que nadie más escribió aquí.']), 202);
  return { state, add, calls, provider, mine, foreign, pdf };
}

const put = (request, actor, purpose, status = 'granted') => request('PUT', `/api/consents/${purpose}`, { ...actor, body: { status } });
const ask = (request, actor, body) => request('POST', '/api/insights/proposals', { ...actor, body });
const insight = (id, over = {}) => ({ key: 'energy_gives', text: GOOD_TEXT, quotes: [{ source: 'resume', id, quote: QUOTE }], ...over });

test('ES-121 hoja de vida: pide su propia autorización; ni analizar el chat, el diario ni leer la hoja de vida con IA la reemplazan', async (t) => {
  const { calls, provider, mine } = setup();
  const request = await startApp(t);
  for (const purpose of ['insights_chat', 'insights_diary', 'resume_ai_reading']) await put(request, U, purpose);
  provider.out = [insight(mine.id)];
  const denied = await ask(request, U, { sources: ['resume'] });
  assert.deepEqual([denied.status, denied.body.code, denied.body.purpose, calls.length], [403, 'consent_required', 'insights_resume', 0]);
  const withChat = await ask(request, U, { sources: ['chat', 'resume'] });
  assert.deepEqual([withChat.status, withChat.body.purpose, calls.length], [403, 'insights_resume', 0]);
  assert.equal((await put(request, U, 'insights_resume')).status, 200);
  const ok = await ask(request, U, { sources: ['resume'] });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.usedSources, { chat: 0, diary: 0, resume: 1 });
  // retirar la autorización se respeta desde la siguiente petición
  await put(request, U, 'insights_resume', 'revoked');
  const after = await ask(request, U, { sources: ['resume'] });
  assert.deepEqual([after.status, after.body.purpose], [403, 'insights_resume']);
  assert.equal(calls.length, 1);
});

test('ES-121 hoja de vida: a la IA llega el texto SIN contacto; la cita se comprueba contra ese texto y el origen es la versión', async (t) => {
  const { state, calls, provider, mine } = setup();
  const request = await startApp(t);
  await put(request, U, 'insights_resume');
  provider.out = [insight(mine.id), insight(mine.id, { key: 'values', text: 'Podría ser que valores contactar por correo.', quotes: [{ source: 'resume', id: mine.id, quote: 'maria.gomez@example.test' }] })];
  const r = await ask(request, U, { sources: ['resume'], resumeId: mine.id, locale: 'es' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const prompt = calls[0].messages[0].content;
  for (const piece of CONTACT) assert.equal(prompt.includes(piece), false, piece);
  assert.ok(prompt.includes(QUOTE));
  assert.ok(prompt.indexOf(QUOTE) > prompt.match(/UNTRUSTED_[0-9A-F]{16}/).index); // dentro del delimitador, como dato
  assert.equal(r.body.insights.length, 1); // la cita del correo ya no existe en el texto depurado: se descartó
  assert.equal(r.body.discarded, 1);
  assert.deepEqual(r.body.insights[0], { key: 'energy_gives', text: GOOD_TEXT, origins: [{ type: 'resume_version', id: mine.id, quote: QUOTE }] });
  assert.doesNotMatch(JSON.stringify(r.body), /example\.test|300 123|linkedin/);
  assert.equal((state.tables.CareerContextVersion || []).length, 0); // no se guarda nada
});

test('ES-121 hoja de vida: solo la propia; id ajeno o inexistente = 404; sin hoja de vida o ilegible = 422 sin llamar a la IA', async (t) => {
  const { calls, provider, mine, foreign, pdf, state } = setup();
  const request = await startApp(t);
  await put(request, U, 'insights_resume');
  await put(request, V, 'insights_resume');
  provider.out = [];
  for (const resumeId of [foreign.id, 99999]) {
    const r = await ask(request, U, { sources: ['resume'], resumeId });
    assert.deepEqual([r.status, r.body.code], [404, 'origin_not_found'], String(resumeId));
  }
  assert.equal(calls.length, 0);
  // sin id se usa la propia; el texto de la otra persona jamás aparece
  assert.equal((await ask(request, U, { sources: ['resume'] })).status, 200);
  assert.doesNotMatch(calls[0].messages[0].content, new RegExp(FOREIGN_CANARY));
  // una cita a la hoja de vida de otra persona no es una fuente
  provider.out = [insight(foreign.id)];
  assert.equal((await ask(request, U, { sources: ['resume'] })).status, 502);
  // sin ninguna hoja de vida
  state.tables.ParticipantResume = state.tables.ParticipantResume.filter((row) => row.UserId !== 202);
  const none = await ask(request, V, { sources: ['resume'] });
  assert.deepEqual([none.status, none.body.code], [422, 'no_usable_source']);
  // escaneada o corrupta: no sirve como fuente y no se llama a la IA
  const before = calls.length;
  for (const bad of [makeScannedPdf(), makeCorruptPdf()]) {
    state.tables.ParticipantResume = state.tables.ParticipantResume.filter((row) => row.UserId !== 101);
    pdf(bad);
    const r = await ask(request, U, { sources: ['resume'] });
    assert.deepEqual([r.status, r.body.code], [422, 'no_usable_source']);
  }
  assert.equal(calls.length, before);
  // una hoja de vida con una frase de crisis no llega al proveedor ni se dice por qué
  state.tables.ParticipantResume = state.tables.ParticipantResume.filter((row) => row.UserId !== 101);
  pdf(makeTextPdf(['PERSONA SINTETICA', 'Trabajé tres años coordinando equipos y quiero un cambio de rumbo.', 'A veces pienso en quitarme la vida, pero sigo estudiando cada noche.']));
  const risky = await ask(request, U, { sources: ['resume'] });
  assert.deepEqual([risky.status, risky.body.code, calls.length], [422, 'no_usable_source', before]);
  assert.doesNotMatch(JSON.stringify(risky.body), /riesgo|risk|crisis|vida/i);
  void mine;
});

test('ES-121 hoja de vida: un insight con origen de hoja de vida se autoriza con el flujo de ES-25; solo el titular ve el origen; borrarla lo marca para revisión', async (t) => {
  const { state, mine, foreign } = setup();
  const request = await startApp(t);
  await put(request, U, 'professional_bridge');
  const field = { key: 'energy_gives', text: GOOD_TEXT, origin: { type: 'resume_version', id: mine.id } };
  const preview = (fields) => request('POST', '/api/career-context/preview', { ...U, body: { fields } });
  for (const origin of [{ type: 'resume_version', id: foreign.id }, { type: 'resume_version', id: 99999 }]) {
    assert.equal((await preview([{ ...field, origin }])).status, 404, JSON.stringify(origin));
  }
  assert.equal((await preview([{ ...field, origin: { type: 'resume_version' } }])).status, 400);
  const p = await preview([field]);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const done = await request('POST', '/api/career-context/confirm', { ...U, body: { fields: [field], token: p.body.token, requestId: rid() } });
  assert.equal(done.status, 201, JSON.stringify(done.body));
  const active = (await request('GET', '/api/career-context', U)).body.active;
  assert.deepEqual(active.fields[0].origin, { type: 'resume_version', id: mine.id });
  assert.equal(active.needsReview, false);
  const bridge = require('../utils/careerContext');
  const delivered = await bridge.getApprovedContext(101, 'test');
  assert.deepEqual(delivered.fields, [{ key: 'energy_gives', text: GOOD_TEXT }]);
  assert.doesNotMatch(JSON.stringify(delivered), /resume|origin/);
  // borrar la hoja de vida (o retirar su lectura con IA, que la borra): lo derivado queda «para revisión», sin tocar lo ya autorizado
  state.tables.ParticipantResume = state.tables.ParticipantResume.filter((row) => row.id !== mine.id);
  const later = (await request('GET', '/api/career-context', U)).body.active;
  assert.equal(later.needsReview, true);
  assert.equal(later.status, 'active');
});

test('ES-121 hoja de vida (QA ES121R-QA-01): las extracciones de PDF van de una en una y todas las propuestas simultáneas terminan', async (t) => {
  const { calls, provider, mine } = setup();
  const request = await startApp(t);
  await put(request, U, 'insights_resume');
  provider.out = [insight(mine.id)];
  extraction.max = 0; extraction.total = 0;
  const results = await Promise.all(Array.from({ length: 8 }, () => ask(request, U, { sources: ['resume'] })));
  assert.deepEqual(results.map((r) => r.status), Array(8).fill(200), JSON.stringify(results.map((r) => r.body.code)));
  assert.equal(extraction.total, 8);
  assert.equal(extraction.max, 1); // nunca dos extracciones a la vez
  assert.equal(calls.length, 8);
});
