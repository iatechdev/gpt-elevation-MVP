import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { passwordProblems, validRegistrationPassword, knownProblems } from '../src/access/registrationPassword.ts'
import { authFailureKey } from '../src/access/session.ts'
const require = createRequire(import.meta.url)
const backend = require('../../backend/utils/registrationPassword.js')
const catalog = JSON.parse(readFileSync(new URL('../../shared/landing-content.json', import.meta.url)))
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const entry = key => catalog.find(x => x.key === key)

const samples = ['', '123', 'abcdefgh', 'ABCDEFGH', '12345678', 'Abcdef1!', 'Abcdef1', 'Abcdefg1 ', 'Contrasen\u0303a1x', 'Abcdef1😀', 'Abcdefg12', 'Ñandú123·', 'ñandú123-', 'Password1!', '  PASSWORD1!  ', 'P@ssw0rd',
  'Aa1!' + 'x'.repeat(68), 'Aa1!' + 'x'.repeat(69), 'Aa1!' + '😀'.repeat(17), 'Aa1!' + '😀'.repeat(18), 'é'.repeat(37) + 'A1!', ' '.repeat(20), 'Aa1!' + 'x'.repeat(10000), ...backend.policy.common]

test('ES-128: cliente y servidor calculan los mismos requisitos faltantes para cada contraseña de borde', () => {
  for (const value of samples) {
    assert.deepEqual(passwordProblems(value), backend.passwordProblems(value), JSON.stringify(value).slice(0, 40))
    assert.equal(validRegistrationPassword(value), backend.validRegistrationPassword(value))
  }
  assert.equal(validRegistrationPassword('Abcdef1!'), true)
  assert.deepEqual(passwordProblems('abcdefgh'), ['upper', 'digit', 'special'])
})

test('ES-128: mensajes ES/EN del servidor y del catálogo coinciden; el error de política solo aplica al registro', () => {
  const copy = entry('landing.access.password_policy')
  assert.equal(copy.es, backend.policy.message.es); assert.equal(copy.en, backend.policy.message.en)
  assert.equal(authFailureKey(400, { code: 'password_policy' }, true), copy.key)
  assert.notEqual(authFailureKey(400, { code: 'password_policy' }, false), copy.key)
  assert.deepEqual(knownProblems(['upper', 'x', 'special', 7]), ['upper', 'special'])
  assert.deepEqual(knownProblems('upper'), [])
})

test('ES-128: el catálogo tiene todos los textos de los requisitos en ES (tuteo) y EN, sin voseo', () => {
  const keys = ['title', 'length', 'upper', 'lower', 'digit', 'special', 'max_bytes', 'met', 'pending', 'summary', 'missing',
    ...[...backend.policy.rules, 'max_bytes', 'common'].map(id => `missing.${id}`)].map(k => `landing.access.pw.${k}`)
  for (const key of keys) { const item = entry(key); assert.ok(item?.es && item?.en, key); assert.doesNotMatch(item.es, /\b(tenés|usá|vos|elegí)\b/i) }
  assert.match(entry('landing.access.pw.summary').es, /\{n\}.*\{total\}/); assert.match(entry('landing.access.pw.missing').en, /\{list\}/)
})

test('ES-128: el formulario muestra los requisitos solo al registrarse, enlazados al campo, con aviso accesible y foco en el error', () => {
  const page = read('../src/pages/LoginPage.tsx'); const box = read('../src/access/PasswordRequirements.tsx')
  assert.match(page, /isRegistering && \(\s*<PasswordRequirements id="pw-req"/)
  assert.match(page, /aria-describedby=\{isRegistering \? 'pw-req' : undefined\}/)
  assert.match(page, /role=\{authMessage\.success \? 'status' : 'alert'\}/)
  assert.match(page, /passwordInput\.current\?\.focus\(\)/)
  assert.match(page, /invalid=\{policyError\}/) // ES-155: el campo (AccessField) marca aria-invalid cuando hay error de requisitos
  assert.match(box, /aria-live="polite"/); assert.match(box, /aria-hidden="true"/)
  assert.match(box, /landing\.access\.pw\.met/); assert.match(box, /landing\.access\.pw\.pending/)
})
