// ES-265 (2.º PR): sesión vencida (401) en la ficha y la sala. Con texto escrito sin guardar → aviso con «Entrar» (no se pierde a ciegas); sin texto → a /login.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const dir = '../src/pages/therapist/'

test('ES-265: guardados con texto (nota de la ficha, nota en vivo, cierre) avisan con «Entrar» y no invalidan solos', () => {
  for (const file of ['FollowupNotes.tsx', 'LiveNotes.tsx', 'CloseSession.tsx']) {
    const src = read(dir + file)
    assert.match(src, /res\.status === 401/, file)
    // solo al pulsar «Entrar», con el token con que se envió: con un token DISTINTO avisa (session_renewed) y con token ausente o igual va a /login
    assert.ok(src.includes('enterAgain(usedToken.current)'), file)
    assert.ok(src.includes("'session_renewed'"), file)
    assert.match(src, /session_enter/, file)
    assert.match(src, /session_expired_note/, file)
  }
})

test('ES-265: cargas sin texto escrito (ficha, resumen, agenda, sala) invalidan la sesión con el token usado', () => {
  for (const file of ['TherapistPatient.tsx', 'AiSummaryBlock.tsx', 'ScheduleSession.tsx', 'SessionRoom.tsx']) {
    const src = read(dir + file)
    assert.match(src, /res\.status === 401\) \{ invalidateStoredSession\(token\)/, file)
  }
})

test('ES-265: la nota en vivo conserva el texto, avisa antes de salir y no ofrece «Guardar ahora» en estado vencido', () => {
  const src = read(dir + 'LiveNotes.tsx')
  assert.match(src, /status === 'conflict' \|\| status === 'expired'\) event\.preventDefault\(\)/)
  assert.match(src, /const showSaveNow = status !== 'expired' &&/)
  assert.match(src, /setStatus\('expired'\); return false/)
})

test('ES-265: textos nuevos en ES y EN', () => {
  const copy = read('../src/i18n/therapistCopy.ts')
  assert.equal((copy.match(/session_expired_note:/g) ?? []).length, 2)
  assert.equal((copy.match(/session_enter:/g) ?? []).length, 2)
})

test('ES-265 (enterAgain en nota, sala y cierre): el foco pasa a «Entrar» en los diálogos y, tras el aviso de sesión más nueva, vuelve al cuadro de texto', () => {
  for (const [file, field] of [['FollowupNotes.tsx', 'fu-text'], ['CloseSession.tsx', 'sr-close-note'], ['LiveNotes.tsx', 'sr-live-notes']]) {
    const src = read(dir + file)
    assert.ok(src.includes(`document.getElementById('${field}')?.focus()`), file)
    assert.ok(src.includes("from './sessionEnter'"), file)
  }
  for (const file of ['FollowupNotes.tsx', 'CloseSession.tsx']) { const src = read(dir + file); assert.ok(src.includes('enterButton.current?.focus()') && src.includes('document.activeElement'), file) }
})
