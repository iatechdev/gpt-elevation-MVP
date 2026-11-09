// ES-220 (ES-155 tramo A): el login no revela si un correo tiene cuenta. Correo inexistente, cuenta inactiva y cuenta bloqueada responden igual hacia fuera;
// el costo de bcrypt es el mismo en todos los caminos; los correos sin cuenta se bloquean con el mismo umbral que una cuenta real.
// Ojo: el limitador por IP del login (10/min) es del proceso; esta prueba hace como máximo 10 llamadas HTTP.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { models, record, startApp } = require('./support.cjs');
const attempts = require('../utils/loginAttempts');

const login = (request, email, password) => request('POST', '/api/login', { body: { email, password } });

test('ES-220: inexistente, inactiva y bloqueada responden igual; el bloqueo de un correo sin cuenta es idéntico al de una cuenta real', async t => {
  attempts.reset();
  const good = `Aa1!${randomBytes(12).toString('hex')}`;
  const wrong = `Bb2?${randomBytes(12).toString('hex')}`;
  const hash = await bcrypt.hash(good, 4);
  const accounts = new Map([
    ['real@example.invalid', record({ id: 11, name: 'Real', email: 'real@example.invalid', role: 'user', active: true, password: hash, loginAttempts: 0, lockedUntil: null })],
    ['inactive@example.invalid', record({ id: 12, name: 'Inactive', email: 'inactive@example.invalid', role: 'user', active: false, password: hash, loginAttempts: 0, lockedUntil: null })],
    ['fine@example.invalid', record({ id: 13, name: 'Fine', email: 'fine@example.invalid', role: 'user', active: true, password: hash, loginAttempts: 0, lockedUntil: null })],
  ]);
  models.User.findOne = async ({ where }) => accounts.get(where.email) ?? null;
  const compare = t.mock.method(bcrypt, 'compare');
  const request = await startApp(t);

  // 1-3 (primer intento): mismo status y mismo cuerpo exacto, exista o no la cuenta y esté activa o no.
  const ghost1 = await login(request, 'ghost@example.invalid', wrong);
  const real1 = await login(request, 'real@example.invalid', wrong);
  const inactive1 = await login(request, 'inactive@example.invalid', wrong);
  for (const response of [ghost1, real1, inactive1]) assert.equal(response.status, 401);
  assert.deepEqual(ghost1.body, real1.body); assert.deepEqual(ghost1.body, inactive1.body);
  assert.deepEqual(Object.keys(ghost1.body), ['error']);
  // Tiempo equivalente: los tres caminos hicieron UNA comparación de bcrypt (el inexistente, contra el señuelo) y ninguno saltó el costo.
  assert.equal(compare.mock.callCount(), 3);
  const [decoyCall] = compare.mock.calls;
  assert.equal(decoyCall.arguments[0], wrong); assert.match(decoyCall.arguments[1], /^\$2[aby]\$10\$/); // costo 10 = el de los hashes reales (registro y restablecer)

  // 4-6: el correo inexistente se bloquea a los 3 intentos igual que la cuenta real, con el mismo status y el mismo cuerpo.
  const ghost2 = await login(request, 'ghost@example.invalid', wrong);
  const ghost3 = await login(request, 'ghost@example.invalid', wrong);
  const real2 = await login(request, 'real@example.invalid', wrong);
  const real3 = await login(request, 'real@example.invalid', wrong);
  assert.deepEqual([ghost2.status, real2.status], [401, 401]);
  assert.deepEqual([ghost3.status, real3.status], [423, 423]);
  assert.deepEqual(ghost3.body, real3.body);
  assert.deepEqual(Object.keys(ghost3.body).sort(), ['error', 'locked']);
  assert.match(ghost3.body.error, /15 minutos/);

  // Bloqueado = bloqueado: con la contraseña correcta de la cuenta real sigue 423 y no revela nada distinto.
  const lockedGood = await login(request, 'real@example.invalid', good);
  assert.equal(lockedGood.status, 423); assert.deepEqual(lockedGood.body, ghost3.body);
  assert.equal(accounts.get('real@example.invalid').loginAttempts, 3);

  // Cuenta inactiva con SU contraseña correcta: el aviso de cuenta inactiva solo lo recibe quien la acierta.
  const inactiveGood = await login(request, 'inactive@example.invalid', good);
  assert.equal(inactiveGood.status, 403); assert.equal(inactiveGood.body.deactivated, true);

  // Una cuenta normal sigue entrando con la contraseña correcta y limpia sus intentos.
  accounts.get('fine@example.invalid').loginAttempts = 2;
  const fine = await login(request, 'fine@example.invalid', good);
  assert.equal(fine.status, 200); assert.ok(fine.body.token); assert.equal(accounts.get('fine@example.invalid').loginAttempts, 0);
});

test('ES-220: el contador de correos sin cuenta usa el umbral y la duración del bloqueo por cuenta, vence solo y no se desborda', () => {
  attempts.reset();
  const t0 = 1_000_000;
  assert.equal(attempts.MAX_ATTEMPTS, 3); assert.equal(attempts.LOCK_MS, 15 * 60 * 1000); // no se cambian en ES-220
  assert.equal(attempts.recordFailure('Ghost@Example.invalid ', t0).locked, false);
  assert.equal(attempts.recordFailure('ghost@example.invalid', t0 + 1).locked, false); // mayúsculas y espacios: mismo correo
  const third = attempts.recordFailure('ghost@example.invalid', t0 + 2);
  assert.equal(third.locked, true); assert.equal(third.until.getTime(), t0 + 2 + attempts.LOCK_MS);
  assert.ok(attempts.lockedUntil('ghost@example.invalid', t0 + 1000));
  assert.equal(attempts.lockedUntil('otro@example.invalid', t0 + 1000), null);
  assert.equal(attempts.lockedUntil('ghost@example.invalid', t0 + 3 + attempts.LOCK_MS), null); // vence
  assert.equal(attempts.recordFailure('ghost@example.invalid', t0 + 4 + attempts.LOCK_MS).locked, false); // vuelve a empezar de cero
  // Acotado: nunca más de MAX_ENTRIES entradas aunque lleguen correos distintos sin parar.
  attempts.reset();
  for (let i = 0; i < attempts.MAX_ENTRIES + 500; i++) attempts.recordFailure(`bot${i}@example.invalid`, t0 + i);
  assert.ok(attempts.size() <= attempts.MAX_ENTRIES, String(attempts.size()));
  attempts.reset();
  assert.equal(attempts.size(), 0);
  assert.equal(typeof attempts.recordFailure(undefined).locked, 'boolean'); // entrada rara: sin excepción
});
