// ES-169 (PR1): «Mi profesional» (/app/my-therapist). Vocabulario «profesional», sin emojis, textos por claves ES/EN, error con reintento por sección.
// Estructura y textos; el comportamiento y la accesibilidad los mide scripts/es169-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { myProfessionalEs, myProfessionalEn } from '../src/pages/myProfessionalCopy.ts'
import { therapistEs, therapistEn } from '../src/i18n/therapistCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/MyTherapist.tsx')
const card = read('../src/components/TherapistSharingCard.tsx')
const EMOJI = /\p{Extended_Pictographic}/u

test('ES-169: la pantalla dice «profesional» (ES y EN) y la ruta no cambia', () => {
  assert.equal(myProfessionalEs.mp_title, 'Mi profesional'); assert.equal(myProfessionalEn.mp_title, 'My professional')
  assert.equal(myProfessionalEs.mp_find, 'Buscar mi profesional'); assert.equal(myProfessionalEn.mp_find, 'Find my professional')
  assert.equal(myProfessionalEs.mp_none_title, 'Aún no tienes un profesional asignado')
  assert.equal(therapistEs.mt_share_title, 'Compartir mis datos con mi profesional'); assert.equal(therapistEn.mt_share_title, 'Share my data with my professional')
  for (const [lang, copy] of [['es', myProfessionalEs], ['en', myProfessionalEn]]) for (const [key, text] of Object.entries(copy)) {
    assert.ok(!(lang === 'es' ? /terapeut/i : /therapist/i).test(text), `${lang}.${key} conserva el vocabulario anterior`)
  }
  assert.ok(!/terapeut/i.test(therapistEs.mt_share_title + therapistEs.mt_share_desc + therapistEs.mt_unlink_body))
  assert.ok(!/to="\/app\/professional|navigate\('\/app\/my-professional/.test(page)) // la ruta sigue siendo /app/my-therapist
})

test('ES-169: sin emojis en la pantalla ni en sus textos; el ánimo se dice con las palabras del producto', () => {
  assert.ok(!EMOJI.test(page), 'MyTherapist.tsx no contiene emojis')
  assert.ok(!EMOJI.test(card), 'TherapistSharingCard.tsx no contiene emojis')
  for (const text of [...Object.values(myProfessionalEs), ...Object.values(myProfessionalEn)]) assert.ok(!EMOJI.test(text))
  assert.match(page, /t\('mp_mood'\)\.replace\('\{word\}', t\(`room_t_mood_\$\{value\}`\)\)/) // room_t_mood_1..5 ya existen en ES y EN
  for (let n = 1; n <= 5; n++) { assert.ok(therapistEs[`room_t_mood_${n}`]); assert.ok(therapistEn[`room_t_mood_${n}`]) }
  assert.ok(!/MOOD_EMOJI/.test(page))
})

test('ES-169: sin textos por ternario de idioma y con las mismas claves en ES y EN', () => {
  assert.ok(!/lang === 'es' \? ['"`](?!es-CO)/.test(page), 'MyTherapist.tsx no decide textos con lang === es (solo el formato de fecha usa el idioma)')
  assert.deepEqual(Object.keys(myProfessionalEs).sort(), Object.keys(myProfessionalEn).sort())
  assert.deepEqual(Object.keys(therapistEs).sort(), Object.keys(therapistEn).sort())
  assert.match(myProfessionalEs.mp_mood, /\{word\}.*\{n\}/); assert.match(myProfessionalEn.mp_mood, /\{word\}.*\{n\}/)
})

test('ES-169: error con «Reintentar» en la carga de perfil y sesiones y en «Compartir» (ya no se oculta en silencio)', () => {
  assert.match(page, /\{!loading && failed && \(\s*<div role="alert"/)
  assert.match(page, /onClick=\{retry\}/)
  assert.match(page, /const retry = \(\) => \{ setLoading\(true\); setFailed\(false\); setReloadKey\(k => k \+ 1\) \}/)
  assert.match(card, /if \(alive\) setStatus\('loaderror'\)/)
  assert.match(card, /if \(status === 'loaderror'\) \{[\s\S]*role="alert"[\s\S]*mt_share_retry/)
  assert.ok(!/if \(alive\) setStatus\('hidden'\)\s*\n\s*\}\s*\n\s*\}\)\(\)/.test(card), 'un error de lectura ya no oculta la tarjeta')
  assert.ok(therapistEs.mt_share_load_error && therapistEn.mt_share_load_error)
})

test('ES-169: las secciones son encabezados (h2) enlazados con aria-labelledby', () => {
  for (const id of ['mp-profile', 'mp-upcoming', 'mp-past']) {
    assert.match(page, new RegExp(`aria-labelledby="${id}"`)); assert.match(page, new RegExp(`<h2 id="${id}"`))
  }
})
