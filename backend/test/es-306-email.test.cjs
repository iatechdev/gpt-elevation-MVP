// ES-306 · Lógica pura del correo sin distinguir mayúsculas (utils/emailNormalize.js). La prueba con PostgreSQL real y HTTP está en test/integration/es-306-postgres.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { normalizeEmail, findUserByEmail } = require('../utils/emailNormalize');

test('ES-306: normalizeEmail recorta y baja a minúsculas; lo que no es texto pasa sin tocar', () => {
  assert.equal(normalizeEmail('  Ana.Perez@Example.INVALID \t'), 'ana.perez@example.invalid');
  assert.equal(normalizeEmail('ya@normal.invalid'), 'ya@normal.invalid');
  for (const value of [undefined, null, 5, {}, []]) assert.equal(normalizeEmail(value), value);
});

test('ES-306: findUserByEmail prueba el texto exacto (sin espacios) y luego lower(email); no consulta con vacíos ni no-texto', async () => {
  const seen = [];
  const User = { findOne: async (options) => { seen.push(options); return null; } };
  assert.equal(await findUserByEmail(User, '  ANA@Example.invalid '), null);
  assert.equal(seen.length, 2); assert.equal(seen[0].where.email, 'ANA@Example.invalid', 'primero el exacto (camino rápido; cuentas antiguas duplicadas)');
  assert.equal(seen[1].where.email, undefined, 'luego lower(email)'); assert.deepEqual(seen[1].order, [['id', 'ASC']], 'si hubiera varias, la más antigua');
  seen.length = 0; for (const value of [undefined, null, 5, {}, '', '   ']) assert.equal(await findUserByEmail(User, value), null); assert.equal(seen.length, 0, 'nada que buscar = ninguna consulta');
});

test('ES-306: con el texto exacto encontrado hace UNA consulta; pasa las opciones (transacción, bloqueo) a cada una', async () => {
  const account = { id: 3 }; const calls = [];
  const User = { findOne: async (options) => { calls.push(options); return options.where.email === 'ana@example.invalid' ? account : null; } };
  assert.equal(await findUserByEmail(User, ' ana@example.invalid ', { transaction: 'tx' }), account);
  assert.equal(calls.length, 1); assert.equal(calls[0].transaction, 'tx');
  calls.length = 0; assert.equal(await findUserByEmail(User, 'otra@example.invalid', { transaction: 'tx' }), null); assert.equal(calls.length, 2); assert.ok(calls.every((c) => c.transaction === 'tx'));
});

test('ES-306: registro, login y recuperación usan el mismo helper y el registro guarda el correo normalizado (estructura)', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
  const auth = read('routes/auth.js');
  const register = auth.slice(auth.indexOf("router.post('/register'"), auth.indexOf("router.post('/login'")); const loginRoute = auth.slice(auth.indexOf("router.post('/login'"));
  assert.match(register, /findUserByEmail\(User, email\)/); assert.match(register, /email: normalizeEmail\(email\)/); assert.doesNotMatch(register, /findOne\(\{ where: \{ email \} \}\)/);
  assert.match(loginRoute, /findUserByEmail\(User, email\)/); assert.doesNotMatch(loginRoute, /User\.findOne\(\{ where: \{ email \} \}\)/);
  assert.match(read('routes/passwordReset.js'), /findUserByEmail\(User, email\)/);
});
