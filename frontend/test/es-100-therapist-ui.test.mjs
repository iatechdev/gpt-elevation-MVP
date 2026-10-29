import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { localizeServerError } from '../src/i18n/serverError.ts'
import { therapistEs, therapistEn } from '../src/i18n/therapistCopy.ts'

test('ES-100: localizeServerError elige el lado del idioma y cae al respaldo', () => {
  assert.equal(localizeServerError('Consentimiento requerido. / Consent required.', 'es'), 'Consentimiento requerido.')
  assert.equal(localizeServerError('Consentimiento requerido. / Consent required.', 'en'), 'Consent required.')
  // ES100-QA-01: el backend envía solo inglés; en español se traduce lo conocido y lo demás cae al texto de la pantalla, nunca inglés suelto.
  assert.equal(localizeServerError('Session has not started yet.', 'es'), 'La sesión todavía no ha comenzado.')
  assert.equal(localizeServerError('Session not found.', 'es', 'respaldo'), 'No se encontró la sesión.')
  assert.equal(localizeServerError('AI usage limit reached.', 'es'), 'Se alcanzó el límite de uso de IA del periodo.')
  assert.equal(localizeServerError('Could not fetch patients.', 'es', 'No pudimos cargar a las personas.'), 'No pudimos cargar a las personas.')
  assert.equal(localizeServerError('Something unexpected happened.', 'es', 'No pudimos completar la acción.'), 'No pudimos completar la acción.')
  assert.equal(localizeServerError('Something unexpected happened.', 'es'), '')
  assert.equal(localizeServerError('Session not found.', 'en', 'fallback'), 'Session not found.')
  assert.doesNotMatch(['Session not found.', 'Could not join session.', 'Could not generate summary.', 'Could not end session.', 'Could not start session.', 'Could not save note.'].map(m => localizeServerError(m, 'es', 'x')).join(' '), /Could not|not found\./)
  assert.equal(localizeServerError(undefined, 'es', 'respaldo'), 'respaldo')
  assert.equal(localizeServerError('   ', 'en', 'fallback'), 'fallback')
  assert.equal(localizeServerError({ nope: 1 }, 'en', 'fallback'), 'fallback')
})

test('ES-100: los textos nuevos existen en ES y EN, sin vacíos', () => {
  assert.deepEqual(Object.keys(therapistEs).sort(), Object.keys(therapistEn).sort())
  for (const [key, value] of [...Object.entries(therapistEs), ...Object.entries(therapistEn)]) {
    assert.ok(value.trim().length > 0, `${key} vacío`)
  }
  assert.ok(therapistEs.mt_unlink_title.includes('{name}') && therapistEn.mt_unlink_title.includes('{name}'))
})

test('ES-100: las salas de sesión ya no traen texto de usuario fijo en español', () => {
  for (const file of ['../src/pages/user/SessionRoom.tsx', '../src/pages/therapist/SessionRoom.tsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    for (const literal of ['Conectando a tu sesión', 'Finalizar sesión', 'Guardar y finalizar', 'Reintentar', 'Notas en vivo']) {
      assert.ok(!source.includes(literal), `${file} aún contiene «${literal}»`)
    }
  }
})

function luminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return .2126 * r + .7152 * g + .0722 * b
}

test('ES-100: colores nuevos del panel del terapeuta cumplen contraste AA', () => {
  for (const [fg, bg] of [['#78716c', '#f9f9f7'], ['#075985', '#e0f2fe'], ['#57534e', '#f5f5f4'], ['#b91c1c', '#ffffff'], ['#ffffff', '#4a6741'], ['#d6d3d1', '#292524'], ['#a3b899', '#292524']]) {
    const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
    assert.ok((hi + .05) / (lo + .05) >= 4.5, `${fg} sobre ${bg}`)
  }
})
