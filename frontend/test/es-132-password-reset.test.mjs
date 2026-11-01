import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readResetToken, resetFailure } from '../src/access/passwordReset.ts'

const catalog = JSON.parse(readFileSync(new URL('../../shared/landing-content.json', import.meta.url)))
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE'

test('ES-132: el token se lee solo del fragmento y con forma válida', () => {
  assert.equal(readResetToken(`#token=${TOKEN}`), TOKEN)
  assert.equal(readResetToken(`token=${TOKEN}`), TOKEN)
  for (const bad of ['', '#', '#token=', '#token=corto', `#other=${TOKEN}`, `#token=${TOKEN}<script>`, `#token=${'a'.repeat(129)}`, `#token=${TOKEN} x`]) assert.equal(readResetToken(bad), null, bad)
})

test('ES-132: cada respuesta rechazada se traduce a un mensaje conocido', () => {
  assert.equal(resetFailure(400, 'password_policy'), 'password_policy')
  assert.equal(resetFailure(400, 'reset_invalid'), 'reset_invalid')
  assert.equal(resetFailure(429, 'rate_limited'), 'rate_limited')
  assert.equal(resetFailure(429, undefined), 'rate_limited')
  assert.equal(resetFailure(500, undefined), 'failed')
  assert.equal(resetFailure(400, 'otro'), 'failed')
})

test('ES-132: todos los textos usados existen en ES y EN', () => {
  const source = read('../src/access/PasswordResetPages.tsx') + read('../src/pages/LoginPage.tsx')
  const used = [...source.matchAll(/'(landing\.access\.[a-z_.]+)'/g)].map(m => m[1])
  assert.ok(used.some(k => k.startsWith('landing.access.reset.')))
  for (const key of new Set(used)) {
    const row = catalog.find(x => x.key === key)
    assert.ok(row && row.es && row.en, `falta ${key}`)
  }
})

test('ES-132: rutas públicas, enlace en el login y token fuera de la URL', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /path="\/forgot-password"/)
  assert.match(app, /path="\/reset-password"/)
  assert.match(read('../src/pages/LoginPage.tsx'), /!isRegistering && <Link to="\/forgot-password"/)
  const pages = read('../src/access/PasswordResetPages.tsx')
  assert.match(pages, /history\.replaceState\(null, '', window\.location\.pathname\)/)
  assert.doesNotMatch(pages, /localStorage|sessionStorage|console\./)
  assert.match(pages, /passwordProblems\(password\)/)
})
