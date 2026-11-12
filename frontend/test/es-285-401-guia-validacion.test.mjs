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
    assert.match(src, /invalidateStoredSession\(usedToken\.current\)/, file)
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
