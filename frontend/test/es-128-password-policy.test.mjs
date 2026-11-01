import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { validRegistrationPassword } from '../src/access/registrationPassword.ts'
import { authFailureKey } from '../src/access/session.ts'
const require = createRequire(import.meta.url)
const backend = require('../../backend/utils/registrationPassword.js')
const catalog = JSON.parse(readFileSync(new URL('../../shared/landing-content.json', import.meta.url)))

test('ES-128: cliente y servidor comparten límites y mensajes ES/EN; rechazo no afecta login heredado', () => {
  for (const value of ['', '123', 'x'.repeat(11), 'x'.repeat(12), 'x'.repeat(72), 'x'.repeat(73), 'é'.repeat(36), 'é'.repeat(37), '😀'.repeat(18), '😀'.repeat(19), ...backend.policy.common]) assert.equal(validRegistrationPassword(value), backend.validRegistrationPassword(value));
  const copy = catalog.find(x => x.key === 'landing.access.password_policy')
  assert.equal(copy.es, backend.policy.message.es); assert.equal(copy.en, backend.policy.message.en)
  assert.equal(authFailureKey(400, { code: 'password_policy' }, true), copy.key)
  assert.notEqual(authFailureKey(400, { code: 'password_policy' }, false), copy.key)
});
