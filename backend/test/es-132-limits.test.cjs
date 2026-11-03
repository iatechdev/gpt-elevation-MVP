process.env.PASSWORD_RESET_IP_LIMIT = '2';
process.env.PASSWORD_RESET_CONFIRM_LIMIT = '3';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');

test('ES-132: límite de solicitudes y de confirmaciones por IP con respuesta 429 genérica', async t => {
  models.User.findOne = async () => null;
  models.PasswordReset.findOne = async () => null;
  const request = await startApp(t);
  const requests = [];
  for (let i = 0; i < 4; i++) requests.push((await request('POST', '/api/password-reset/request', { body: { email: `n${i}@example.invalid` } })).status);
  assert.deepEqual(requests, [202, 202, 429, 429]);
  const confirms = [];
  for (let i = 0; i < 5; i++) confirms.push((await request('POST', '/api/password-reset/confirm', { body: { token: `t${i}`, password: 'Nueva-clave-9' } })).status);
  assert.deepEqual(confirms, [400, 400, 400, 429, 429]);
  const limited = await request('POST', '/api/password-reset/request', { body: { email: 'x@example.invalid' } });
  assert.equal(limited.body.code, 'rate_limited'); assert.match(limited.body.error, /Demasiados intentos/); assert.match(limited.body.error, /Too many attempts/);
});
