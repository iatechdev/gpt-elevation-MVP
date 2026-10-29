// ES-13: Brújula profesional. La bandera está apagada por defecto; salir de la banda no envía nada.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { makeIntent } from '../src/space/api.ts'
import { copy } from '../src/space/copy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-13: el modo viaja solo cuando se pide, y la solicitud normal no lo trae', () => {
  assert.equal('mode' in makeIntent('Hola', 'es', []), false)
  assert.equal(makeIntent('Hola', 'es', [], 'es13-turn-0001', 'compass').mode, 'compass')
  assert.deepEqual(Object.keys(makeIntent('Hola', 'en', [1], 'es13-turn-0002', 'compass')).sort(), ['contextEntryIds', 'lang', 'message', 'mode', 'requestId'])
})

test('ES-13: textos aprobados en ES y EN', () => {
  assert.equal(copy.es.proCompass, 'Brújula profesional'); assert.equal(copy.en.proCompass, 'Professional compass')
  assert.equal(copy.es.proCompassNotNow, 'Ahora no'); assert.equal(copy.en.proCompassNotNow, 'Not now')
  assert.equal(copy.es.proCompassClose, 'Cerrar sin presión'); assert.equal(copy.en.proCompassClose, 'Close, no pressure')
  assert.match(copy.es.proCompassIntro, /No es terapia ni un diagnóstico, y no promete resultados laborales\. Puedes parar cuando quieras\.$/)
  assert.match(copy.en.proCompassIntro, /It is not therapy or a diagnosis, and it does not promise job outcomes\. You can stop whenever you like\.$/)
})

test('ES-13: el enlace del menú y el modo del chat dependen de VITE_ENABLE_COMPASS_CHAT === "true" (apagada por defecto)', () => {
  assert.match(read('../src/space/SpaceNav.tsx'), /VITE_ENABLE_COMPASS_CHAT === 'true' && <NavLink[^>]*to="\/app\/chat\?mode=compass"/)
  const chat = read('../src/pages/ChatPage.tsx')
  assert.match(chat, /const compass = import\.meta\.env\.VITE_ENABLE_COMPASS_CHAT === 'true' && params\.get\('mode'\) === 'compass'/)
  assert.match(chat, /usePersonalChat\(lang, true, compass \? 'compass' : undefined\)/)
  assert.match(chat, /\{compass && <CompassBanner /)
})

test('ES-13: «Ahora no» y «Cerrar sin presión» solo navegan al chat normal: no envían, no crean turno', () => {
  const banner = read('../src/space/CompassBanner.tsx')
  assert.match(banner, /navigate\('\/app\/chat'\)/)
  assert.doesNotMatch(banner, /fetch|request\(|makeIntent|send\(|localStorage/)
  assert.match(banner, /if \(canLeave\(\)\) navigate/) // con texto sin enviar se usa el aviso de salida existente
  assert.match(banner, /\{!started && <button[^>]*onClick=\{leave\}>\{c\.proCompassNotNow\}/)
  assert.match(banner, /<section[^>]*aria-labelledby="space-compass-title"/)
})
