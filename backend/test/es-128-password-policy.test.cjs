const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { validRegistrationPassword, passwordProblems, policy } = require('../utils/registrationPassword');
const { models, record, startApp } = require('./support.cjs');

test('ES-128: mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial; ids de requisitos estables', () => {
  const cases = [
    ['Abcdef1!', []],
    ['Abcdef1!x', []],
    ['Contraseña9?', []],
    ['Ab1!', ['length']],
    ['Abcde1!', ['length']],
    ['abcdefg1!', ['upper']],
    ['ABCDEFG1!', ['lower']],
    ['Abcdefgh!', ['digit']],
    ['Abcdefg12', ['special']],
    ['abcdefgh', ['upper', 'digit', 'special']],
    ['12345678', ['upper', 'lower', 'special']],
    ['', ['length', 'upper', 'lower', 'digit', 'special']],
    ['        ', ['upper', 'lower', 'digit', 'special']],
    ['Abcdefg1 ', ['special']],
    ['Abcdef1😀', []],
    ['Password1!', ['common']],
    ['  PASSWORD1!  ', ['lower', 'common']],
    ['  Password1!  ', ['common']],
    ['P@ssw0rd', ['common']],
  ];
  for (const [value, expected] of cases) assert.deepEqual(passwordProblems(value), expected, JSON.stringify(value));
  for (const value of [null, undefined, 123, {}, [], true]) assert.deepEqual(passwordProblems(value), policy.rules);
  assert.equal(validRegistrationPassword('Abcdef1!'), true);
  assert.equal(validRegistrationPassword('abcdef1!'), false);
});

test('ES-128: el espacio no cuenta como carácter especial; letras, números y símbolos Unicode se clasifican igual en toda la política', () => {
  assert.ok(passwordProblems('Abcdefg1 ').includes('special'));
  assert.ok(passwordProblems('Abcdefg1²').includes('special'));
  assert.ok(!passwordProblems('Abcdefg1_').includes('special'));
  assert.deepEqual(passwordProblems('Ñandú123·'), []);
  assert.deepEqual(passwordProblems('Ñandú123-'), []);
  assert.ok(passwordProblems('ñandú123-').includes('upper'));
});

test('ES-128: máximo 72 bytes UTF-8 sin truncar ni normalizar, con entradas extremas sin lanzar', () => {
  const fits = 'Aa1!' + 'x'.repeat(68);
  assert.equal(Buffer.byteLength(fits), 72);
  assert.deepEqual(passwordProblems(fits), []);
  assert.deepEqual(passwordProblems(fits + 'x'), ['max_bytes']);
  assert.deepEqual(passwordProblems('Aa1!' + '😀'.repeat(17)), []);
  assert.deepEqual(passwordProblems('Aa1!' + '😀'.repeat(18)), ['max_bytes']);
  assert.ok(passwordProblems('é'.repeat(37) + 'A1!').includes('max_bytes'));
  assert.deepEqual(passwordProblems('Aa1!' + 'x'.repeat(10000)), ['max_bytes']);
  assert.ok(Array.isArray(passwordProblems('\u0000‮')));
});

test('ES-128: registro débil no consulta ni escribe cuentas; registro válido conserva hash y rol, e inactiva no se reactiva', async t => {
  let reads = 0; const writes = [];
  models.User.findOne = async () => { reads++; return null; };
  models.User.create = async values => { writes.push(values); return record(values); };
  const request = await startApp(t);
  const rejected = [
    ['123', ['length', 'upper', 'lower', 'special']],
    ['abcdefgh', ['upper', 'digit', 'special']],
    ['Password1!', ['common']],
    ['Aa1!' + 'x'.repeat(69), ['max_bytes']],
    ['Aa1!' + '😀'.repeat(18), ['max_bytes']],
  ];
  for (const [password, missing] of rejected) {
    const response = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password } });
    assert.equal(response.status, 400, password); assert.equal(response.body.code, 'password_policy');
    assert.deepEqual(response.body.missing, missing);
    assert.equal(response.body.error, `${policy.message.es} / ${policy.message.en}`);
    assert.equal(reads, 0); assert.equal(writes.length, 0);
  }
  const password = `Aa1!${randomBytes(24).toString('hex')}`;
  const registered = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password, role: 'superadmin' } });
  assert.equal(registered.status, 201); assert.equal(writes.length, 1); assert.equal(writes[0].role, 'user');
  assert.notEqual(writes[0].password, password); assert.equal(await bcrypt.compare(password, writes[0].password), true);
  const account = record({ id: 202, active: false, password: writes[0].password });
  account.update = async () => { throw new Error('Must not reactivate'); };
  models.User.findOne = async () => account;
  assert.equal((await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password } })).status, 403);
  assert.equal(writes.length, 1); assert.equal(account.active, false);
});

test('ES-128: correo ya registrado con contraseña débil devuelve password_policy (no revela si la cuenta existe) y con contraseña válida conserva el error de duplicado', async t => {
  models.User.findOne = async () => record({ id: 7, active: true });
  const request = await startApp(t);
  const weak = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'dup@example.invalid', password: 'weak' } });
  assert.equal(weak.status, 400); assert.equal(weak.body.code, 'password_policy');
  const dup = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'dup@example.invalid', password: 'Valid-pass-9' } });
  assert.equal(dup.status, 400); assert.equal(dup.body.error, 'El correo ya está registrado.');
});

test('ES-128: entradas extremas responden 400 controlado, nunca 5xx', async t => {
  models.User.findOne = async () => null;
  models.User.create = async () => { throw new Error('Must not write'); };
  const request = await startApp(t);
  for (const password of ['', ' '.repeat(20), 'x'.repeat(10000), '😀'.repeat(500), '\u0000'.repeat(10), null, 123, [], {}, true]) {
    const response = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'edge@example.invalid', password } });
    assert.ok(response.status >= 400 && response.status < 500, `${JSON.stringify(password).slice(0, 20)} -> ${response.status}`);
  }
});
