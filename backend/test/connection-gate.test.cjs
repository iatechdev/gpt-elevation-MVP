// QA-33-01: la compuerta de conexiones. Sin base de datos ni red.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGate, slotsFor } = require('../utils/connectionGate');

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const within = (promise, ms, label) => Promise.race([promise, wait(ms).then(() => { throw new Error('se bloqueó: ' + label); })]);

test('QA-33-01: el tamaño deja siempre una conexión libre para las lecturas internas', () => {
  assert.deepEqual([undefined, 0, 1, 2, 3, 4, 5, 8, 15].map(slotsFor), [2, 2, 1, 1, 1, 1, 2, 3, 7]);
  for (const max of [3, 4, 5, 8, 15]) assert.ok(slotsFor(max) * 2 + 1 <= max, 'pool ' + max); // size * 2 retenidas + 1 para leer
});

test('QA-33-01: nunca hay más operaciones a la vez que cupos y todas terminan', async () => {
  const gate = createGate(2);
  let running = 0, peak = 0;
  const task = async () => { running++; peak = Math.max(peak, running); await wait(5); running--; return 'ok'; };
  const results = await within(Promise.all(Array.from({ length: 12 }, () => gate.run(task))), 2000, 'cola');
  assert.equal(peak, 2);
  assert.ok(results.every(r => r === 'ok'));
  assert.deepEqual([gate.active(), gate.waiting()], [0, 0]);
});

test('QA-33-01: un fallo libera el cupo y la cola sigue', async () => {
  const gate = createGate(1);
  const failing = gate.run(async () => { await wait(5); throw new Error('falla sintética'); });
  const after = gate.run(async () => 'siguiente');
  await assert.rejects(failing, /falla sintética/);
  assert.equal(await within(after, 1000, 'después de un fallo'), 'siguiente');
  assert.equal(gate.active(), 0);
});

test('QA-33-01: es reentrante: una operación protegida dentro de otra no pide un segundo cupo', async () => {
  const gate = createGate(1);
  const nested = gate.run(async () => gate.run(async () => gate.run(async () => 'anidada')));
  assert.equal(await within(nested, 1000, 'reentrada'), 'anidada');
  // Con cupo único y varias operaciones anidadas a la vez nadie se queda esperando a sí mismo.
  const many = Array.from({ length: 5 }, () => gate.run(async () => { await wait(2); return gate.run(async () => 'x'); }));
  assert.deepEqual(await within(Promise.all(many), 2000, 'anidadas concurrentes'), ['x', 'x', 'x', 'x', 'x']);
});

test('QA-33-01: el orden de llegada se respeta', async () => {
  const gate = createGate(1);
  const order = [];
  await Promise.all([1, 2, 3, 4].map(n => gate.run(async () => { await wait(2); order.push(n); })));
  assert.deepEqual(order, [1, 2, 3, 4]);
});
