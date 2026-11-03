const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');

// ES-142: una respuesta que el modelo dejó cortada por el tope de salida se entrega tal cual, marcada, y nunca como si estuviera completa.
promptVault.getActivePrompt = async () => 'Synthetic system prompt';

const A = 101;
const B = 202;
const as = (id, role = 'user') => ({ role, id });
const post = (request, body, actor = as(A)) => request('POST', '/api/chat', { ...actor, body });

function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  const provider = { reply: 'Respuesta completa.', stopReason: 'end_turn' };
  anthropic.messages.create = async options => {
    calls.push(options);
    return { content: [{ type: 'text', text: provider.reply }], stop_reason: provider.stopReason };
  };
  return { state, calls, provider };
}

const CUT = 'Semana 9: Visualización de datos y, para cerrar el ciclo, una reflexión sobre lo que no es una carrera ni';

test('ES-142: el tope de salida del chat es de 3000 tokens', async t => {
  const { calls } = setup();
  const request = await startApp(t);
  assert.equal((await post(request, { message: 'hola' })).status, 200);
  assert.equal(calls[0].max_tokens, 3000);
});

test('ES-142: una respuesta completa no lleva marca y el contrato sigue igual', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const sin = await post(request, { message: 'hola' });
  assert.deepEqual(sin.body, { reply: 'Respuesta completa.' });
  const con = await post(request, { message: 'otra', requestId: 'req-14200001' });
  assert.deepEqual(con.body, { reply: 'Respuesta completa.', requestId: 'req-14200001' });
  assert.ok(state.messages.every(m => !m.truncated));
  assert.equal(state.turns[0].truncated, false);
});

test('ES-142: una respuesta cortada por max_tokens se entrega tal cual y marcada como cortada', async t => {
  const { state, provider } = setup();
  provider.reply = CUT;
  provider.stopReason = 'max_tokens';
  const request = await startApp(t);
  const cut = await post(request, { message: 'plan detallado', requestId: 'req-14200002' });
  assert.equal(cut.status, 200);
  assert.deepEqual(cut.body, { reply: CUT, requestId: 'req-14200002', truncated: true }); // sin recortar ni añadir texto
  const assistant = state.messages.find(m => m.role === 'assistant');
  assert.equal(assistant.truncated, true);
  assert.equal(state.messages.find(m => m.role === 'user').truncated, undefined);
  assert.equal(state.turns[0].truncated, true);
});

test('ES-142: la marca también viaja sin requestId, en la repetición del turno, en su consulta y en el historial', async t => {
  const { state, calls, provider } = setup();
  provider.reply = CUT;
  provider.stopReason = 'max_tokens';
  const request = await startApp(t);
  assert.deepEqual((await post(request, { message: 'sin id' })).body, { reply: CUT, truncated: true });
  const body = { message: 'con id', requestId: 'req-14200003' };
  await post(request, body);
  const replay = await post(request, body);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.truncated, true);
  assert.equal(calls.length, 2); // la repetición no vuelve a llamar al proveedor
  const turn = await request('GET', '/api/chat/turns/req-14200003', as(A));
  assert.deepEqual(turn.body, { requestId: 'req-14200003', status: 'completed', retryable: false, reply: CUT, truncated: true });
  const history = await request('GET', '/api/messages', as(A));
  const bots = history.body.filter(m => m.role === 'bot');
  assert.equal(bots.length, 2);
  assert.ok(bots.every(m => m.truncated === true && m.text === CUT));
  assert.ok(history.body.filter(m => m.role === 'user').every(m => m.truncated === undefined));
  assert.equal(state.messages.length, 4);
});

test('ES-142: la marca es de cada respuesta: una cortada y la siguiente completa', async t => {
  const { state, provider } = setup();
  const request = await startApp(t);
  provider.reply = CUT; provider.stopReason = 'max_tokens';
  await post(request, { message: 'uno' });
  provider.reply = 'Listo, esta sí terminó.'; provider.stopReason = 'end_turn';
  const second = await post(request, { message: 'continúa' });
  assert.deepEqual(second.body, { reply: 'Listo, esta sí terminó.' });
  assert.deepEqual(state.messages.filter(m => m.role === 'assistant').map(m => m.truncated), [true, false]);
});

test('ES-142: la marca de un turno es del dueño: otra persona no la lee', async t => {
  const { provider } = setup();
  provider.reply = CUT; provider.stopReason = 'max_tokens';
  const request = await startApp(t);
  await post(request, { message: 'privado', requestId: 'req-14200004' });
  const other = await request('GET', '/api/chat/turns/req-14200004', as(B));
  assert.equal(other.status, 404);
  assert.doesNotMatch(JSON.stringify(other.body), /truncated|Semana 9/);
});

test('ES-142: stop_reason ausente o distinto de max_tokens no marca la respuesta', async t => {
  const { state, provider } = setup();
  const request = await startApp(t);
  for (const stopReason of [undefined, null, 'end_turn', 'stop_sequence', 'refusal']) {
    provider.stopReason = stopReason;
    const response = await post(request, { message: `m-${String(stopReason)}` });
    assert.equal(response.body.truncated, undefined, String(stopReason));
  }
  assert.ok(state.messages.every(m => !m.truncated));
});

test('ES-142: la migración es aditiva, repetible y coincide con los modelos', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261102000000-es142-chat-truncated.js'), 'utf8');
  assert.match(source, /'Messages', 'ChatTurns'/);
  assert.match(source, /if \(!columns\.truncated\) await queryInterface\.addColumn/);
  assert.match(source, /guardDown\('20261102000000-es142-chat-truncated'\)/);
  for (const file of ['message.js', 'ChatTurn.js']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /truncated: \{[\s\S]*BOOLEAN[\s\S]*allowNull: false[\s\S]*defaultValue: false/, file);
  }
});
