// ES-169 (PR3): sala de sesión de la persona (/app/session/:id). Estados conectando → antes de entrar → en curso, «aún no comienza» y «error» con reintento sin recargar,
// y la explicación del permiso de cámara y micrófono ANTES de que el navegador lo pida. Estructura y textos; el comportamiento lo mide scripts/es169-sala-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { therapistEs, therapistEn } from '../src/i18n/therapistCopy.ts'

const room = readFileSync(new URL('../src/pages/user/SessionRoom.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n') // tolera fin de línea CRLF (Windows)
const EMOJI = /\p{Extended_Pictographic}/u

test('ES-169 sala: el iframe del video solo se monta en la fase «en curso», después de explicar el permiso y de que la persona pulse «Entrar»', () => {
  assert.match(room, /type Phase = 'connecting' \| 'not_started' \| 'error' \| 'ready' \| 'in_room'/)
  const readyBlock = room.slice(room.indexOf("if (phase === 'ready')"), room.indexOf('  return (\n    <div className="th-a11y"'))
  assert.ok(!/<iframe/.test(readyBlock), 'la pantalla «antes de entrar» no carga el video')
  assert.match(readyBlock, /onClick=\{\(\) => setPhase\('in_room'\)\}/)
  assert.equal((room.match(/<iframe/g) || []).length, 1)
  assert.match(room, /allow="camera; microphone; fullscreen; display-capture; autoplay"/)
})

test('ES-169 sala: reintentar vuelve a pedir la sala sin recargar la página y no queda ningún recurso de recarga', () => {
  assert.ok(!/location\.reload/.test(room))
  assert.match(room, /const retry = \(\) => \{ setError\(''\); setPhase\('connecting'\); setAttempt\(a => a \+ 1\) \}/)
  assert.match(room, /\}, \[id, attempt\]\)/)
  assert.match(room, /return \(\) => \{ alive = false \}/) // una respuesta tardía no pisa el estado
})

test('ES-169 sala: sin emojis, vocabulario «profesional» y textos nuevos ES/EN sobre cámara y micrófono', () => {
  assert.ok(!EMOJI.test(room), 'SessionRoom no contiene emojis')
  assert.match(therapistEs.room_pre_title, /Antes de entrar/); assert.match(therapistEn.room_pre_title, /Before you join/)
  assert.match(therapistEs.room_pre_body, /cámara y el micrófono/); assert.match(therapistEn.room_pre_body, /camera and microphone/)
  assert.match(therapistEs.room_pre_body, /servicio externo/); assert.match(therapistEn.room_pre_body, /external service/)
  assert.match(therapistEs.room_not_started_body, /Tu profesional todavía no ha iniciado/); assert.match(therapistEn.room_not_started_body, /Your professional has not started/)
  assert.ok(!/terapeut/i.test(therapistEs.room_not_started_body) && !/therapist/i.test(therapistEn.room_not_started_body))
  // sin promesas sobre qué hace el servicio externo con la cámara
  for (const text of [therapistEs.room_pre_body, therapistEn.room_pre_body]) assert.ok(!/solo se usan|only used|nunca|never|garantiz|guarantee/i.test(text))
  assert.deepEqual(Object.keys(therapistEs).sort(), Object.keys(therapistEn).sort())
})

test('ES-169 sala: cada estado tiene su rol accesible (conectando = status; error y aún no comienza = alerta; títulos h1)', () => {
  assert.match(room, /<div role="status" aria-busy="true"/)
  assert.match(room, /<h1 role="alert"/)
  assert.equal((room.match(/<h1/g) || []).length, 3) // error o aún no comienza, antes de entrar, en curso: uno por pantalla
})
