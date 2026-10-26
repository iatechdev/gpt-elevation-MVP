const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');

// chat.js toma getActivePrompt al cargarse: se sustituye antes de que ninguna prueba cargue el servidor.
promptVault.getActivePrompt = async () => 'Synthetic system prompt';

const A = 101;
const B = 202;
const as = (id, role = 'user') => ({ role, id });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const post = (request, body, actor = as(A)) => request('POST', '/api/chat', { ...actor, body });

function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  const provider = { reply: 'Respuesta sintética', fail: false, wait: 0 };
  anthropic.messages.create = async options => {
    calls.push(options);
    if (provider.wait) await delay(provider.wait);
    if (provider.fail) throw new Error('proveedor caído');
    return { content: [{ type: 'text', text: provider.reply }] };
  };
  return { state, calls, provider };
}

const seedConversation = (state, userId, total) => {
  for (let i = 1; i <= total; i++) {
    state.messages.push({
      id: 1000 + i, UserId: userId, role: i % 2 === 1 ? 'user' : 'assistant', content: `mensaje ${i}`,
      createdAt: new Date(1_600_000_000_000 + i * 1000), updatedAt: new Date(),
    });
  }
};

test('INV-04: el historial enviado a Claude son los mensajes más recientes, en orden y empezando por el usuario', async t => {
  const { state, calls } = setup();
  seedConversation(state, A, 25); // 1 (usuario) … 25 (usuario); los 20 más recientes empiezan en el 6 (asistente)
  seedConversation(state, B, 3);
  const request = await startApp(t);
  const response = await post(request, { message: 'nuevo mensaje' });
  assert.equal(response.status, 200);
  const sent = calls[0].messages.map(m => m.content);
  assert.equal(sent.at(-1), 'nuevo mensaje');
  assert.equal(sent[0], 'mensaje 7'); // se descarta el 6 (asistente) para no empezar por la respuesta
  assert.equal(sent.at(-2), 'mensaje 25');
  assert.ok(!sent.includes('mensaje 1'));
  assert.equal(calls[0].messages[0].role, 'user');
  assert.deepEqual(sent.slice(0, -1), Array.from({ length: 19 }, (_, i) => `mensaje ${i + 7}`));
});

test('ES-20: el turno se confirma completo y solo si Claude responde; sin requestId el contrato sigue igual', async t => {
  const { state, calls, provider } = setup();
  const request = await startApp(t);
  const ok = await post(request, { message: 'hola' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body, { reply: 'Respuesta sintética' });
  assert.deepEqual(state.messages.map(m => [m.role, m.UserId]), [['user', A], ['assistant', A]]);
  assert.equal(state.turns.length, 0); // sin requestId no se crea turno

  provider.fail = true;
  const failed = await post(request, { message: 'segundo' });
  assert.equal(failed.status, 502);
  assert.equal(failed.body.code, 'provider_unavailable');
  assert.equal(failed.body.retryable, true);
  assert.equal(typeof failed.body.reply, 'string'); // la interfaz actual lee `reply` aunque falle
  assert.doesNotMatch(JSON.stringify(failed.body), /proveedor caído/);
  assert.equal(state.messages.length, 2); // sin mensaje huérfano: la conversación válida queda intacta
  assert.equal(calls.length, 2);

  provider.fail = false;
  provider.reply = '   ';
  assert.equal((await post(request, { message: 'tercero' })).status, 502); // respuesta vacía = fallo del proveedor
  assert.equal(state.messages.length, 2);
});

test('ES-20: repetir un requestId no duplica mensajes ni vuelve a llamar al proveedor', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  const body = { message: 'hola', requestId: 'req-00000001' };
  const first = await post(request, body);
  const second = await post(request, body);
  const third = await post(request, body, as(A)); // desde otro navegador autenticado: mismo usuario
  assert.equal(first.status, 200);
  assert.equal(first.body.replayed, undefined);
  for (const replay of [second, third]) {
    assert.equal(replay.status, 200);
    assert.equal(replay.body.reply, first.body.reply);
    assert.equal(replay.body.replayed, true);
  }
  assert.equal(calls.length, 1);
  assert.equal(state.messages.length, 2);
  assert.equal(state.turns.length, 1);
  assert.equal(state.turns[0].status, 'completed');
});

test('ES-20: el mismo requestId con otro mensaje se rechaza sin tocar nada', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  await post(request, { message: 'hola', requestId: 'req-00000002' });
  const clash = await post(request, { message: 'otro texto', requestId: 'req-00000002' });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.code, 'request_id_reuse');
  assert.equal(calls.length, 1);
  assert.equal(state.messages.length, 2);
});

test('ES-20: dos envíos simultáneos del mismo requestId: uno procede y el otro espera con 409', async t => {
  const { state, calls, provider } = setup();
  provider.wait = 120;
  const request = await startApp(t);
  const body = { message: 'hola', requestId: 'req-00000003' };
  const [one, two] = await Promise.all([post(request, body), post(request, body)]);
  assert.deepEqual([one.status, two.status].sort(), [200, 409]);
  const rejected = one.status === 409 ? one : two;
  assert.equal(rejected.body.code, 'turn_in_progress');
  assert.equal(calls.length, 1);
  assert.equal(state.messages.length, 2);
  const after = await post(request, body);
  assert.equal(after.body.replayed, true);
});

test('ES-20: tras un fallo del proveedor el mismo requestId se puede reintentar sin duplicar', async t => {
  const { state, calls, provider } = setup();
  const request = await startApp(t);
  provider.fail = true;
  const body = { message: 'hola', requestId: 'req-00000004' };
  const failed = await post(request, body);
  assert.equal(failed.status, 502);
  assert.equal(failed.body.requestId, 'req-00000004');
  const status = await request('GET', '/api/chat/turns/req-00000004', as(A));
  assert.deepEqual(status.body, { requestId: 'req-00000004', status: 'failed', retryable: true });
  provider.fail = false;
  const retried = await post(request, body);
  assert.equal(retried.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(state.messages.length, 2);
  assert.equal(state.turns.length, 1);
  const done = await request('GET', '/api/chat/turns/req-00000004', as(A));
  assert.deepEqual(done.body, { requestId: 'req-00000004', status: 'completed', retryable: false, reply: 'Respuesta sintética' });
});

test('ES-20: un turno pendiente reciente da 409; uno vencido se puede reclamar', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  state.turns.push({
    id: 50, UserId: A, requestId: 'req-00000005', status: 'pending', userContent: 'hola', replyContent: null,
    createdAt: new Date(), updatedAt: new Date(),
    async update(updates) { Object.assign(this, updates, { updatedAt: new Date() }); return this; },
  });
  const busy = await post(request, { message: 'hola', requestId: 'req-00000005' });
  assert.equal(busy.status, 409);
  assert.equal(calls.length, 0);
  state.turns[0].updatedAt = new Date(Date.now() - 3 * 60 * 1000);
  assert.equal((await request('GET', '/api/chat/turns/req-00000005', as(A))).body.retryable, true);
  const reclaimed = await post(request, { message: 'hola', requestId: 'req-00000005' });
  assert.equal(reclaimed.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(state.turns[0].status, 'completed');
});

test('ES-20 A/B: el requestId es por persona y el estado del turno solo lo ve su dueño', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  const body = { message: 'hola', requestId: 'req-00000006' };
  const forA = await post(request, body, as(A));
  const forB = await post(request, { ...body, message: 'mensaje de B' }, as(B));
  assert.equal(forA.status, 200);
  assert.equal(forB.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(state.turns.length, 2);
  assert.deepEqual(state.messages.map(m => m.UserId), [A, A, B, B]);
  assert.equal((await request('GET', '/api/chat/turns/req-00000006', as(A))).body.status, 'completed');
  // B consulta un turno que no existe para B: 404 (no se revela el de A) y un admin tampoco ve los ajenos.
  const missing = await request('GET', '/api/chat/turns/req-00000099', as(B));
  assert.equal(missing.status, 404);
  assert.equal((await request('GET', '/api/chat/turns/req-00000099', as(1, 'admin'))).status, 404);
  assert.equal((await request('GET', '/api/chat/turns/req-00000006', { ...as(1, 'admin') })).status, 404);
  assert.equal((await request('GET', '/api/chat/turns/mal id!', as(A))).status, 404);
  assert.deepEqual((await request('GET', '/api/messages', as(B))).body.map(m => m.text), ['mensaje de B', 'Respuesta sintética']);
});

test('ES-20: requestId y contextEntryIds inválidos se rechazan antes de cualquier efecto', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  for (const requestId of ['corto', 'con espacios 123', 'x'.repeat(65), 12345678, {}, [], null, 'emoji-😀-123456']) {
    assert.equal((await post(request, { message: 'hola', requestId })).status, 400, String(requestId));
  }
  for (const contextEntryIds of ['1', {}, [0], [-1], [1.5], ['1'], [1, 2, 3, 4], [null]]) {
    assert.equal((await post(request, { message: 'hola', contextEntryIds })).status, 400, JSON.stringify(contextEntryIds));
  }
  assert.equal(calls.length, 0);
  assert.equal(state.messages.length + state.turns.length, 0);
});

test('ES-20: si falla la confirmación la escritura es atómica y el turno se puede reintentar', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  const create = models.message.create;
  let breaking = true;
  models.message.create = async (values, options) => {
    if (breaking && values.role === 'assistant') throw new Error('base caída');
    return create(values, options);
  };
  const body = { message: 'hola', requestId: 'req-00000007' };
  const failed = await post(request, body);
  assert.equal(failed.status, 500);
  assert.equal(typeof failed.body.reply, 'string');
  assert.equal(state.messages.length, 0); // ni el mensaje del usuario quedó guardado
  assert.equal(state.turns[0].status, 'failed');
  breaking = false;
  const retried = await post(request, body);
  assert.equal(retried.status, 200);
  assert.equal(state.messages.length, 2);
  assert.equal(calls.length, 2);
});
