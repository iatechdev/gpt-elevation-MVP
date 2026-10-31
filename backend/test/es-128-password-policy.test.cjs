const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { validRegistrationPassword, policy } = require('../utils/registrationPassword');
const { models, record, startApp } = require('./support.cjs');

test('ES-128: política por caracteres Unicode y bytes UTF-8, sin truncar ni normalizar la contraseña', () => {
  for (const value of [null, undefined, 123, {}, '123', 'x'.repeat(11), ' '.repeat(12), ...policy.common, 'PASSWORD1234', 'x'.repeat(73), '😀'.repeat(19)]) assert.equal(validRegistrationPassword(value), false);
  for (const value of ['long-passphrase-7', 'x'.repeat(72), '😀'.repeat(18), 'é'.repeat(12)]) assert.equal(validRegistrationPassword(value), true);
});

test('ES-128: registro débil no consulta ni escribe cuentas; registro válido conserva hash y rol, e inactiva no se reactiva', async t => {
  let reads = 0; const writes = [];
  models.User.findOne = async () => { reads++; return null; };
  models.User.create = async values => { writes.push(values); return record(values); };
  const request = await startApp(t);
  for (const password of ['123', 'Password1234', 'x'.repeat(73), '😀'.repeat(19)]) {
    const response = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password } });
    assert.equal(response.status, 400); assert.equal(response.body.code, 'password_policy');
    assert.equal(response.body.error, `${policy.message.es} / ${policy.message.en}`);
    assert.equal(reads, 0); assert.equal(writes.length, 0);
  }
  const password = randomBytes(24).toString('hex');
  const registered = await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password, role: 'superadmin' } });
  assert.equal(registered.status, 201); assert.equal(writes.length, 1); assert.equal(writes[0].role, 'user');
  assert.notEqual(writes[0].password, password); assert.equal(await bcrypt.compare(password, writes[0].password), true);
  const account = record({ id: 202, active: false, password: writes[0].password });
  account.update = async () => { throw new Error('Must not reactivate'); };
  models.User.findOne = async () => account;
  assert.equal((await request('POST', '/api/register', { body: { name: 'Synthetic', email: 'policy@example.invalid', password } })).status, 403);
  assert.equal(writes.length, 1); assert.equal(account.active, false);
});
