// ES-13: chat guía «Brújula profesional». Proveedor simulado y almacén en memoria (sin red ni datos reales).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { COMPANION_LIMITS } = require('../utils/promptSafety');
const { COMPASS_KEY, COMPASS_RULES, validMode, defaultPrompt, composeCompassPrompt } = require('../utils/compassGuide');
const { PAUSE_REPLY } = require('../utils/companionTone');

const vault = { [COMPASS_KEY]: null, elevation_system_prompt: 'Synthetic default prompt', therapist_prompt_7: 'Synthetic therapist prompt' };
promptVault.getActivePrompt = async key => vault[key] ?? null;
function setup({ therapistId = null, manifest = null } = {}) {
  const state = install(); const calls = [];
  models.User.findByPk = async () => ({ therapistId }); models.EthicManifest.findOne = async () => manifest;
  anthropic.messages.create = async options => { calls.push(options); return { content: [{ type: 'text', text: 'Synthetic response.' }] }; };
  vault[COMPASS_KEY] = null;
  return { state, calls };
}
const post = (request, body, id = 101) => request('POST', '/api/chat', { id, role: 'user', body });

test('ES-13: solo el valor «compass» es un modo válido; cualquier otro se rechaza en vez de ignorarse', async t => {
  assert.equal(validMode('compass'), true);
  for (const value of ['Compass', 'COMPASS', ' compass', 'therapist', '', null, 1, true, ['compass'], { mode: 'compass' }]) assert.equal(validMode(value), false, String(value));
  const { calls } = setup(); const request = await startApp(t);
  for (const mode of ['coach', '', null, 7, ['compass']]) assert.equal((await post(request, { message: 'Hola', mode })).status, 400, JSON.stringify(mode));
  assert.equal(calls.length, 0);
});

test('ES-13: sin «mode» el chat normal no cambia (prompt de Elevation o del terapeuta, sin reglas de la Brújula)', async t => {
  const { calls } = setup(); const request = await startApp(t);
  assert.equal((await post(request, { message: 'Hola' })).status, 200);
  assert.match(calls[0].system, /^Synthetic default prompt/); assert.doesNotMatch(calls[0].system, /PROFESSIONAL COMPASS RULES/);
});

test('ES-13: en modo compass el orden es base → manifiesto → reglas → límites, y no se usa el prompt del terapeuta', async t => {
  const { calls } = setup({ therapistId: 7, manifest: { content: 'x' } });
  const request = await startApp(t);
  vault[COMPASS_KEY] = 'Synthetic compass prompt';
  const response = await post(request, { message: 'Quiero explorar otra profesión', mode: 'compass', lang: 'es' });
  assert.equal(response.status, 200); assert.equal(calls.length, 1);
  const system = calls[0].system;
  assert.match(system, /^Synthetic compass prompt/); assert.doesNotMatch(system, /Synthetic therapist prompt|Synthetic default prompt/);
  assert.ok(system.indexOf('PROFESSIONAL COMPASS RULES') > 0); assert.ok(system.endsWith(`${COMPANION_LIMITS}\n---`));
  assert.ok(system.indexOf('PROFESSIONAL COMPASS RULES') < system.indexOf('COMPANION LIMITS'));
});

test('ES-13: sin texto en el Vault se usa el borrador ES o EN según el idioma, y las reglas fijas van siempre', () => {
  for (const lang of ['es', 'en']) {
    const prompt = composeCompassPrompt({ vaultPrompt: null, manifest: null, lang });
    assert.ok(prompt.startsWith(defaultPrompt(lang))); assert.ok(prompt.includes(COMPASS_RULES));
  }
  assert.match(defaultPrompt('es'), /Terapia de Aceptación y Compromiso/); assert.match(defaultPrompt('en'), /Acceptance and Commitment Therapy/);
  assert.equal(defaultPrompt('fr'), defaultPrompt('es'));
  const withVault = composeCompassPrompt({ vaultPrompt: 'Synthetic', manifest: 'Synthetic manifest', lang: 'en' });
  assert.ok(withVault.indexOf('Synthetic manifest') < withVault.indexOf(COMPASS_RULES));
});

test('ES-13: las reglas fijas cubren los criterios del ticket (una pregunta, sin diagnóstico ni promesas, sin datos inventados, omitir sin presión)', () => {
  assert.match(COMPASS_RULES, /only one main question per turn/); assert.match(COMPASS_RULES, /Do not diagnose/);
  assert.match(COMPASS_RULES, /Do not promise employment/); assert.match(COMPASS_RULES, /Do not invent job offers, salaries, rates, sources or percentages of replacement by AI/);
  assert.match(COMPASS_RULES, /skip any question or end this conversation at any time/); assert.match(COMPASS_RULES, /without pressure/);
});

test('ES-13: riesgo alto y pausa explícita conservan su prioridad en modo compass y no llaman al proveedor', async t => {
  const { calls, state } = setup(); const request = await startApp(t);
  const high = await post(request, { message: 'Quiero morir', mode: 'compass', lang: 'es' });
  assert.equal(high.body.interrupted, true); assert.equal(calls.length, 0);
  const pause = await post(request, { message: 'silencio por favor', mode: 'compass', lang: 'es' });
  assert.equal(pause.body.reply, PAUSE_REPLY.es); assert.equal(calls.length, 0); assert.equal(state.messages.length, 4);
});

test('ES-13: el modo no se guarda; el mismo requestId se reproduce sin volver a llamar al proveedor y otro dueño no lo recupera', async t => {
  const { calls, state } = setup(); const request = await startApp(t);
  const body = { message: 'Quiero explorar', mode: 'compass', requestId: 'es13-turn-0001' };
  const first = await post(request, body); const again = await post(request, body);
  assert.equal(first.status, 200); assert.equal(again.body.replayed, true); assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(state), /compass/);
  assert.equal((await request('GET', '/api/chat/turns/es13-turn-0001', { id: 202, role: 'user' })).status, 404);
});

test('ES-13: una entrada de diario ajena sigue rechazada con 404 en modo compass y no llama al proveedor', async t => {
  const { calls } = setup(); const request = await startApp(t);
  assert.equal((await post(request, { message: 'Hola', mode: 'compass', contextEntryIds: [999] })).status, 404);
  assert.equal(calls.length, 0);
});
