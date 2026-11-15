// ES-285: GuideBlock y ValidationBlock tratan el 401 (aviso con «Entrar», sin perder lo escrito) y el 403 (mensaje propio) igual que el resto del panel (ES-265).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const dir = '../src/pages/therapist/'

test('ES-285: ambos bloques avisan con «Entrar» ante un 401 y solo invalidan al pulsarlo, con el token con que se envió', () => {
  for (const file of ['GuideBlock.tsx', 'ValidationBlock.tsx']) {
    const src = read(dir + file)
    assert.match(src, /res\.status === 401/, file)
    assert.match(src, /enterAgain\(usedToken\.current\)/, file) // «Entrar» solo invalida si no hay una sesión más nueva (E243-2)
    assert.match(src, /session_enter/, file)
    assert.match(src, /res\.status === 403/, file)
    assert.match(src, /panel_action_forbidden/, file)
  }
  assert.match(read(dir + 'GuideBlock.tsx'), /session_expired_guide/)
  assert.match(read(dir + 'ValidationBlock.tsx'), /session_expired_file/)
})

test('ES-285: la lectura de control (Comprobar) de la guía también trata el 401', () => {
  const src = read(dir + 'GuideBlock.tsx')
  assert.match(src, /\/api\/therapist\/prompt`, \{ headers[^\n]*\n\s*if \(res\.status === 401\)/)
})

test('ES-285: textos nuevos en ES y EN', () => {
  const copy = read('../src/i18n/therapistCopy.ts')
  for (const key of ['session_expired_guide', 'session_expired_file', 'panel_action_forbidden']) assert.equal((copy.match(new RegExp(key + ':', 'g')) ?? []).length, 2, key)
})

// ---- seguimiento (E243-1..4) ----
test('ES-285 seguimiento (E243-4): la guía trata el 401 en el envío Y en «Comprobar», y ambos bloques pintan el botón «Entrar»', () => {
  const guide = read(dir + 'GuideBlock.tsx'), validation = read(dir + 'ValidationBlock.tsx')
  assert.equal((guide.match(/res\.status === 401/g) ?? []).length, 2) // envío + relectura
  assert.match(guide, /error\.enter && <button/)
  assert.match(validation, /res\.status === 401/)
  assert.match(validation, /message\?\.enter && <div><button/)
  for (const src of [guide, validation]) { assert.match(src, /enterAgain\(usedToken\.current\)/); assert.match(src, /session_renewed/) }
})

test('ES-285 seguimiento (E243-1): el foco pasa a «Entrar» cuando aparece el aviso, sin quitárselo a quien ya se movió', () => {
  for (const file of ['GuideBlock.tsx', 'ValidationBlock.tsx']) {
    const src = read(dir + file)
    assert.match(src, /enterButton\.current\?\.focus\(\)/, file)
    assert.match(src, /document\.activeElement/, file)
    assert.match(src, /active === document\.body/, file)
  }
})

test('ES-285 seguimiento (E243-3): «Entrar» de la validación usa el mismo estilo que el de la guía y el texto ya no dice «elegirlo»', () => {
  const validation = read(dir + 'ValidationBlock.tsx'), copy = read('../src/i18n/therapistCopy.ts')
  assert.match(validation, /style=\{ghost\}[\s\S]*?\{t\('session_enter'\)\}/)
  assert.doesNotMatch(copy, /vuelve a elegirlo|choose it again/)
  assert.equal((copy.match(/session_renewed:/g) ?? []).length, 2)
})

test('ES-285 seguimiento (E243-2 / O247-A): enterAgain lleva a /login con token igual o ausente y solo avisa si hay un token DISTINTO', async () => {
  const store = new Map()
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }
  const events = []
  globalThis.window = { dispatchEvent: e => events.push(e.type) }
  globalThis.Event = class { constructor(type) { this.type = type } }
  const { enterAgain } = await import('../src/pages/therapist/sessionEnter.ts')
  store.set('elevation_token', 'nuevo')
  assert.equal(enterAgain('viejo'), false); assert.equal(store.get('elevation_token'), 'nuevo'); assert.deepEqual(events, []) // token distinto: no se cierra
  assert.equal(enterAgain('nuevo'), true); assert.equal(store.has('elevation_token'), false); assert.deepEqual(events, ['elevation-session-change']) // igual: se invalida
  store.set('elevation_role', 'therapist'); events.length = 0
  assert.equal(enterAgain('viejo'), true); assert.equal(store.has('elevation_role'), false); assert.deepEqual(events, ['elevation-session-change']) // ausente: /login, sin aviso falso
})

test('ES-285 seguimiento (O247-B): tras el aviso de sesión más nueva el foco va a un elemento coherente', () => {
  assert.ok(read(dir + 'GuideBlock.tsx').includes("document.getElementById('panel-guide-text')?.focus()"))
  assert.ok(read(dir + 'ValidationBlock.tsx').includes('submit?.focus()'))
})
