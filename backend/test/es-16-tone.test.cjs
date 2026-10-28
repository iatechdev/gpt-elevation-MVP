const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');
const { explicitPauseLanguage, PAUSE_REPLY, FALLBACK_REPLY } = require('../utils/companionTone');
const { COMPANION_LIMITS } = require('../utils/promptSafety');
promptVault.getActivePrompt = async () => 'Synthetic prompt';
function setup() {
  const state = install(); const calls = [];
  models.User.findByPk = async () => ({ therapistId: null }); models.EthicManifest.findOne = async () => null;
  anthropic.messages.create = async options => { calls.push(options); return { content: [{ type: 'text', text: 'Synthetic response.' }] }; };
  return { state, calls };
}
const post = (request, body, id = 101, role = 'user') => request('POST', '/api/chat', { id, role, body });
test('ES-16: bounded explicit pause phrases; quotes, questions and negations do not become commands', () => {
  assert.equal(explicitPauseLanguage('  SILENCIO, por favor! '), 'es'); assert.equal(explicitPauseLanguage('I want to sit in silence.'), 'en');
  for (const value of ['No quiero quedarme en silencio', '"quiero quedarme en silencio"', '¿Qué significa silencio?', 'My colleague said silence please', 'I do not want to sit in silence', 'Quiero cambiar de trabajo']) assert.equal(explicitPauseLanguage(value), null);
});
test('ES-16: ES/EN pause confirms one pair and replays the same own request without provider calls', async t => {
  const { state, calls } = setup(); const request = await startApp(t);
  for (const [message, lang] of [['quiero quedarme en silencio', 'es'], ['please let me be quiet', 'en']]) {
    const body = { message, requestId: `es16-pause-${lang}-0001` };
    const first = await post(request, body); const repeated = await post(request, body);
    assert.equal(first.status, 200); assert.equal(first.body.reply, PAUSE_REPLY[lang]); assert.equal(repeated.body.replayed, true); assert.equal(repeated.body.reply, first.body.reply);
    assert.doesNotMatch(first.body.reply, /[?¿]/);
  }
  assert.equal(calls.length, 0); assert.equal(state.messages.length, 4); assert.equal(state.turns.length, 2);
});
test('ES-16: explicit locale wins over pause phrase language', async t => {
  setup(); const request = await startApp(t); const response = await post(request, { message: 'silencio por favor', lang: 'en' });
  assert.equal(response.body.reply, PAUSE_REPLY.en);
});
test('ES-16: high/medium safety behavior has priority and ordinary negation still uses the provider', async t => {
  const { calls } = setup(); const request = await startApp(t);
  const high = await post(request, { message: 'Quiero morir. Quiero quedarme en silencio', lang: 'es' });
  assert.equal(high.body.interrupted, true); assert.notEqual(high.body.reply, PAUSE_REPLY.es); assert.equal(calls.length, 0);
  await post(request, { message: 'I want to hurt myself. I want to sit in silence', lang: 'en' }); assert.equal(calls.length, 1);
  await post(request, { message: 'No quiero quedarme en silencio', lang: 'es' }); assert.equal(calls.length, 2);
  assert.ok(calls[1].system.endsWith(`${COMPANION_LIMITS}\n---`));
  assert.match(calls[1].system, /Do not end every reply with a question/); assert.match(calls[1].system, /Do not invent praise/);
  assert.match(calls[1].system, /Do not imply that a human is reading live/);
});
test('ES-16: A/B/admin cannot recover another owner pause; alien diary context still rejects', async t => {
  const { calls } = setup(); const request = await startApp(t);
  await post(request, { message: 'silencio', requestId: 'es16-private-pause-001' });
  for (const role of ['user', 'admin']) assert.equal((await request('GET', '/api/chat/turns/es16-private-pause-001', { id: 202, role })).status, 404);
  assert.equal((await post(request, { message: 'silencio', contextEntryIds: [999] })).status, 404); assert.equal(calls.length, 0);
});
test('ES-16: provider failure keeps the valid conversation and responds in the requested language', async t => {
  const { state } = setup(); const request = await startApp(t);
  anthropic.messages.create = async () => { throw new Error('Synthetic failure'); };
  const response = await post(request, { message: 'A synthetic ordinary request', lang: 'en', requestId: 'es16-failed-en-001' });
  assert.equal(response.status, 502); assert.equal(response.body.reply, FALLBACK_REPLY.en); assert.equal(response.body.retryable, true); assert.equal(state.messages.length, 0);
  assert.equal(state.turns[0].status, 'failed');
});
test('ES-16: database failure logs no query parameters or private error text and localizes 500', async t => {
  setup(); const request = await startApp(t); const logs = []; const previous = console.error;
  models.message.create = async () => { const error = new Error('SYNTHETIC_PRIVATE_SQL_TEXT'); error.parameters = ['SYNTHETIC_PRIVATE_SQL_PARAMETERS']; throw error; };
  console.error = (...args) => logs.push(args);
  try {
    const response = await post(request, { message: 'silencio', lang: 'en' });
    assert.equal(response.status, 500); assert.equal(response.body.reply, FALLBACK_REPLY.en);
    assert.doesNotMatch(JSON.stringify(logs), /SYNTHETIC_PRIVATE_SQL/); assert.equal(logs.length, 1);
  } finally { console.error = previous; }
});
