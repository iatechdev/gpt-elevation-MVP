// ES-221 (E305-1): el semáforo del hash del registro limita la concurrencia, respeta el orden, libera ante errores y rechaza con 503 cuando la cola está llena.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHashGate, ServerBusyError, DEFAULT_MAX, DEFAULT_QUEUE } = require('../utils/hashGate');

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('ES-221 hashGate: por defecto 2 a la vez y cola de 20', () => { assert.deepEqual([DEFAULT_MAX, DEFAULT_QUEUE], [2, 20]); assert.deepEqual(createHashGate().stats(), { active: 0, queued: 0, size: 2, maxQueue: 20 }); });

test('ES-221 hashGate: nunca hay más de `max` en marcha; el resto espera en orden y todos terminan', async () => {
  const gate = createHashGate({ max: 2, maxQueue: 10 }); let running = 0, peak = 0; const order = []; const gates = Array.from({ length: 6 }, deferred);
  const jobs = gates.map((g, i) => gate.run(async () => { running++; peak = Math.max(peak, running); order.push(i); await g.promise; running--; return i; }));
  await new Promise(r => setImmediate(r)); assert.deepEqual(order, [0, 1]); assert.deepEqual(gate.stats(), { active: 2, queued: 4, size: 2, maxQueue: 10 });
  gates.forEach(g => g.resolve()); assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4, 5]);
  assert.equal(peak, 2); assert.deepEqual(order, [0, 1, 2, 3, 4, 5]); assert.deepEqual(gate.stats(), { active: 0, queued: 0, size: 2, maxQueue: 10 });
});

test('ES-221 hashGate: un fallo libera el cupo (no se queda bloqueado) y se propaga', async () => {
  const gate = createHashGate({ max: 1, maxQueue: 5 });
  await assert.rejects(gate.run(async () => { throw new Error('falla sintética'); }), /falla sintética/);
  assert.equal(await gate.run(async () => 'sigue funcionando'), 'sigue funcionando'); assert.deepEqual(gate.stats(), { active: 0, queued: 0, size: 1, maxQueue: 5 });
});

test('ES-221 hashGate: con la cola llena rechaza con ServerBusyError (503, bilingüe) sin tocar a los que esperan', async () => {
  const gate = createHashGate({ max: 1, maxQueue: 2 }); const hold = deferred();
  const first = gate.run(() => hold.promise.then(() => 'a')); const q1 = gate.run(async () => 'b'); const q2 = gate.run(async () => 'c');
  await assert.rejects(gate.run(async () => 'd'), error => error instanceof ServerBusyError && error.status === 503 && error.code === 'server_busy' && / \/ /.test(error.message));
  assert.deepEqual(gate.stats(), { active: 1, queued: 2, size: 1, maxQueue: 2 });
  hold.resolve(); assert.deepEqual(await Promise.all([first, q1, q2]), ['a', 'b', 'c']);
});

test('ES-221 hashGate: valores inválidos vuelven a los de fábrica', () => {
  for (const bad of [0, -1, 1.5, NaN, 'x']) assert.equal(createHashGate({ max: bad }).stats().size, 2, String(bad));
  for (const bad of [-1, 1.5, NaN, 'x']) assert.equal(createHashGate({ maxQueue: bad }).stats().maxQueue, 20, String(bad));
  assert.equal(createHashGate({ maxQueue: 0 }).stats().maxQueue, 0); // sin cola es válido: rechaza en cuanto se llena
});

test('ES-221 hashGate: /register hashea dentro del semáforo, ANTES de consultar el correo, y responde 503 si la cola está llena', () => {
  const src = require('node:fs').readFileSync(require.resolve('../routes/auth.js'), 'utf8');
  const register = src.slice(src.indexOf("router.post('/register'"), src.indexOf("router.post('/login'"));
  assert.ok(register.indexOf('terms.validate') < register.indexOf('hashGate.run(() => bcrypt.hash(password, 10))') && register.indexOf('hashGate.run') < register.indexOf('findUserByEmail'));
  assert.match(register, /error instanceof ServerBusyError\) return res\.status\(503\)/);
  assert.doesNotMatch(register, /await bcrypt\.hash\(/); // todo hash del registro pasa por el semáforo
});
