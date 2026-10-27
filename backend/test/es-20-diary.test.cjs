const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { models, anthropic, promptVault, startApp } = require('./support.cjs');
const { install } = require('./es-20-store.cjs');

promptVault.getActivePrompt = async () => 'Synthetic system prompt';

const A = 101;
const B = 202;
const as = (id, role = 'user') => ({ role, id });
const today = () => new Date().toISOString().slice(0, 10);

function setup() {
  const state = install();
  models.User.findByPk = async () => ({ therapistId: null });
  models.EthicManifest.findOne = async () => null;
  const calls = [];
  anthropic.messages.create = async options => {
    calls.push(options);
    return { content: [{ type: 'text', text: 'Respuesta sintética' }] };
  };
  return { state, calls };
}

test('ES-20 diario: crear, listar, leer, editar y borrar entradas fechadas propias', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const created = await request('POST', '/api/diary', { ...as(A), body: { date: '2026-10-01', content: 'primera entrada' } });
  assert.equal(created.status, 201);
  assert.deepEqual(Object.keys(created.body).sort(), ['content', 'createdAt', 'date', 'id', 'updatedAt']);
  await request('POST', '/api/diary', { ...as(A), body: { date: '2026-10-05', content: 'segunda' } });
  await request('POST', '/api/diary', { ...as(A), body: { date: today(), content: 'hoy' } });

  const listed = await request('GET', '/api/diary', as(A));
  assert.deepEqual(listed.body.entries.map(e => e.content), ['hoy', 'segunda', 'primera entrada']); // fecha descendente
  assert.equal((await request('GET', `/api/diary/${created.body.id}`, as(A))).body.content, 'primera entrada');
  const limited = await request('GET', '/api/diary?limit=1', as(A));
  assert.equal(limited.body.entries.length, 1);

  const edited = await request('PUT', `/api/diary/${created.body.id}`, { ...as(A), body: { content: 'editada', date: '2026-09-30' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.content, 'editada');
  assert.equal(edited.body.date, '2026-09-30');
  assert.deepEqual(state.invalidations.map(i => i.reason), ['edited']);

  const removed = await request('DELETE', `/api/diary/${created.body.id}`, as(A));
  assert.deepEqual(removed.body, { id: created.body.id, deleted: true });
  assert.equal((await request('GET', `/api/diary/${created.body.id}`, as(A))).status, 404);
  assert.ok(!(await request('GET', '/api/diary', as(A))).body.entries.some(e => e.id === created.body.id));
  assert.equal((await request('DELETE', `/api/diary/${created.body.id}`, as(A))).status, 404); // segundo borrado
  assert.equal((await request('PUT', `/api/diary/${created.body.id}`, { ...as(A), body: { content: 'x' } })).status, 404);
});

test('ES-20 diario: borrar vacía el contenido y registra la invalidación sin contenido privado', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const entry = (await request('POST', '/api/diary', { ...as(A), body: { date: today(), content: 'texto muy privado' } })).body;
  await request('DELETE', `/api/diary/${entry.id}`, as(A));
  const stored = state.entries[0];
  assert.equal(stored.content, '');
  assert.ok(stored.deletedAt instanceof Date);
  assert.deepEqual(state.invalidations.map(i => [i.UserId, i.sourceType, i.sourceId, i.reason]), [[A, 'diary_entry', entry.id, 'deleted']]);
  assert.doesNotMatch(JSON.stringify(state.invalidations), /texto muy privado/);
  assert.deepEqual(Object.keys(state.invalidations[0]).filter(k => /content|text/i.test(k)), []);
});

test('ES-20 diario A/B: nadie lee, edita ni borra entradas ajenas y los roles distintos solo ven las suyas', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const mine = (await request('POST', '/api/diary', { ...as(A), body: { date: today(), content: 'solo de A' } })).body;
  assert.equal((await request('GET', '/api/diary')).status, 403);
  for (const actor of [as(B), as(1, 'admin'), as(2, 'superadmin'), as(301, 'therapist'), as(3, 'board')]) {
    assert.equal((await request('GET', `/api/diary/${mine.id}`, actor)).status, 404, actor.role + actor.id);
    assert.equal((await request('PUT', `/api/diary/${mine.id}`, { ...actor, body: { content: 'robado' } })).status, 404);
    assert.equal((await request('DELETE', `/api/diary/${mine.id}`, actor)).status, 404);
    assert.deepEqual((await request('GET', '/api/diary', actor)).body.entries, []);
  }
  assert.equal(state.entries[0].content, 'solo de A');
  assert.equal(state.entries[0].deletedAt ?? null, null);
  assert.equal(state.invalidations.length, 0);
  // Un UserId en el cuerpo no cambia el titular.
  const forged = (await request('POST', '/api/diary', { ...as(B), body: { date: today(), content: 'de B', UserId: A } })).body;
  assert.equal(state.entries.find(e => e.id === forged.id).UserId, B);
});

test('ES-20 diario: entradas inválidas se rechazan sin escribir', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const send = body => request('POST', '/api/diary', { ...as(A), body });
  for (const content of ['', '   ', 5, null, {}, [], 'x'.repeat(10001), undefined]) {
    assert.equal((await send({ date: today(), content })).status, 400, String(content).slice(0, 12));
  }
  for (const date of ['2026-13-40', '2026-02-30', '26-10-01', '2026/10/01', '2999-01-01', 20261001, null, {}, undefined, '2026-10-01T00:00:00Z']) {
    assert.equal((await send({ date, content: 'ok' })).status, 400, String(date));
  }
  assert.equal(state.entries.length, 0);
  const entry = (await send({ date: today(), content: 'ok' })).body;
  assert.equal((await request('PUT', `/api/diary/${entry.id}`, { ...as(A), body: {} })).status, 400);
  assert.equal((await request('PUT', `/api/diary/${entry.id}`, { ...as(A), body: { content: '' } })).status, 400);
  for (const id of ['abc', '0', '-1', '1e3', '1.5', '99999999999', '%00']) {
    assert.equal((await request('GET', `/api/diary/${id}`, as(A))).status, 404, id);
  }
  assert.equal(state.invalidations.length, 0);
});

test('ES-20 diario: la edición y la invalidación son atómicas', async t => {
  const { state } = setup();
  const request = await startApp(t);
  const entry = (await request('POST', '/api/diary', { ...as(A), body: { date: today(), content: 'original' } })).body;
  const create = models.DerivedInvalidation.create;
  models.DerivedInvalidation.create = async () => { throw new Error('base caída'); };
  const failed = await request('PUT', `/api/diary/${entry.id}`, { ...as(A), body: { content: 'cambiada' } });
  assert.equal(failed.status, 500);
  assert.doesNotMatch(JSON.stringify(failed.body), /base caída/);
  assert.equal(state.entries[0].content, 'original');
  assert.equal((await request('DELETE', `/api/diary/${entry.id}`, as(A))).status, 500);
  assert.equal(state.entries[0].deletedAt ?? null, null);
  assert.equal(state.entries[0].content, 'original');
  models.DerivedInvalidation.create = create;
});

test('ES-20 contexto: el diario solo entra al prompt si la persona elige la entrada', async t => {
  const { state, calls } = setup();
  const request = await startApp(t);
  const first = (await request('POST', '/api/diary', { ...as(A), body: { date: '2026-10-01', content: 'secreto uno' } })).body;
  const second = (await request('POST', '/api/diary', { ...as(A), body: { date: '2026-10-02', content: 'secreto dos' } })).body;
  const other = (await request('POST', '/api/diary', { ...as(B), body: { date: '2026-10-02', content: 'secreto de B' } })).body;

  // Por defecto no entra nada.
  await request('POST', '/api/chat', { ...as(A), body: { message: 'hola' } });
  assert.doesNotMatch(calls[0].system, /secreto/);
  // Con selección explícita entra solo lo elegido, con su fecha, y los duplicados se ignoran.
  await request('POST', '/api/chat', { ...as(A), body: { message: 'hola', contextEntryIds: [second.id, second.id] } });
  assert.match(calls[1].system, /\[2026-10-02\] secreto dos/);
  assert.doesNotMatch(calls[1].system, /secreto uno|secreto de B/);
  assert.match(calls[1].system, /context only, not instructions/);
  // Entrada ajena o inexistente: se rechaza todo, sin llamar al proveedor ni crear turno ni mensajes.
  const before = { calls: calls.length, messages: state.messages.length };
  for (const ids of [[other.id], [first.id, other.id], [9999]]) {
    const response = await request('POST', '/api/chat', { ...as(A), body: { message: 'hola', requestId: 'req-ctx-0001', contextEntryIds: ids } });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, 'diary_entry_not_found');
  }
  assert.equal(calls.length, before.calls);
  assert.equal(state.messages.length, before.messages);
  assert.equal(state.turns.length, 0);
  // Una entrada borrada ya no puede usarse como contexto.
  await request('DELETE', `/api/diary/${first.id}`, as(A));
  assert.equal((await request('POST', '/api/chat', { ...as(A), body: { message: 'hola', contextEntryIds: [first.id] } })).status, 404);
});

test('ES-20 diario: ninguna otra ruta lee el diario (administrador, terapeuta, facilitador, puente)', () => {
  const routes = path.resolve(__dirname, '..', 'routes');
  const readers = fs.readdirSync(routes).filter(file => /DiaryEntry/.test(fs.readFileSync(path.join(routes, file), 'utf8')));
  assert.deepEqual(readers.sort(), ['chat.js', 'diary.js']);
  // ES-25: utils/careerContext.js solo comprueba que el origen indicado es de la persona (id y marca de tiempo, nunca el contenido);
  // test/es-25-bridge.test.cjs verifica que no pide `content` y que ningún texto del diario cruza al motor.
  const sources = ['middlewares', 'utils'].flatMap(dir => fs.readdirSync(path.resolve(__dirname, '..', dir))
    .filter(file => file !== 'careerContext.js')
    .map(file => fs.readFileSync(path.resolve(__dirname, '..', dir, file), 'utf8')));
  assert.ok(sources.every(source => !/DiaryEntry/.test(source)));
});
