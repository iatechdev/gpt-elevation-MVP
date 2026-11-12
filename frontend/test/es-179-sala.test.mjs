// ES-179 (PR B): ayudas del tiempo y del autoguardado de la sala del profesional, y estructura: sin emojis, «Finalizar» no rojo, temporizador sin aria-live, textos en ES y EN.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const out = resolve(here, '.tmp-es179')
let mod
before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(here, '../src/pages/therapist/roomFormat.ts'), platform: 'node', output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn' })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

test('ES-179: el tiempo sale de startedAt del servidor y nunca es negativo', () => {
  const start = '2026-11-10T15:00:00.000Z'
  assert.equal(mod.elapsedSeconds(start, Date.parse('2026-11-10T15:00:32.000Z')), 32)
  assert.equal(mod.elapsedSeconds(start, Date.parse('2026-11-10T14:59:00.000Z')), 0, 'reloj adelantado: no negativo')
  assert.equal(mod.elapsedSeconds(null), 0); assert.equal(mod.elapsedSeconds('no-es-fecha'), 0)
  assert.equal(mod.formatElapsed(32), '00:32'); assert.equal(mod.formatElapsed(3725), '1:02:05')
})

test('ES-179: el temporizador solo anuncia hitos (quedan 5 min y duración prevista), no cada segundo', () => {
  assert.equal(mod.milestone(10, 50), null)
  assert.equal(mod.milestone(44 * 60 + 59, 50), null)
  assert.equal(mod.milestone(45 * 60, 50), 'five_left')
  assert.equal(mod.milestone(49 * 60, 50), 'five_left')
  assert.equal(mod.milestone(50 * 60, 50), 'planned'); assert.equal(mod.milestone(99 * 60, 50), 'planned')
  assert.equal(mod.milestone(60, 5), null, 'una sesión de 5 min o menos no tiene aviso de «quedan 5»')
  assert.equal(mod.milestone(10, null), null)
})

test('ES-179: requestId válido para el servidor (8-64 caracteres [A-Za-z0-9_-]) y distinto cada vez; límites del cierre', () => {
  const a = mod.newRequestId(); const b = mod.newRequestId()
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/); assert.notEqual(a, b)
  assert.deepEqual([mod.MIN_CLOSING, mod.MAX_CLOSING, mod.MAX_LIVE], [10, 4000, 20000])
  assert.deepEqual([...mod.MOODS], [1, 2, 3, 4, 5])
})

test('ES-179: la sala no usa emojis, «Finalizar» no es rojo, el temporizador no es aria-live y los textos existen en ES y EN', () => {
  const room = read('../src/pages/therapist/SessionRoom.tsx'), notes = read('../src/pages/therapist/LiveNotes.tsx'), close = read('../src/pages/therapist/CloseSession.tsx'), css = read('../src/styles/session-room.css'), copy = read('../src/i18n/therapistCopy.ts')
  assert.doesNotMatch(room + notes + close, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[★☆⏱]/u)
  assert.doesNotMatch(room, /DC2626|setInterval\([^)]*aria-live/)
  assert.match(css, /\.sr-btn-finish \{ background: #F5F5F4/); assert.doesNotMatch(css, /sr-btn-finish[^}]*(#DC2626|#B91C1C|red)/i)
  assert.match(room, /role="timer"/); assert.doesNotMatch(room, /role="timer"[^>]*aria-live/)
  assert.match(room, /\/start`/); assert.match(room, /found\.status === 'in_progress'\) void start\(\)/) // recarga: recupera la sala; iniciar en «scheduled» solo con el botón
  assert.match(notes, /requestId/); assert.match(notes, /note_changed/); assert.match(notes, /isLive/)
  assert.match(close, /already_closed/); assert.match(close, /recommendationSkipped/)
  const keys = [...(room + notes + close).matchAll(/t\(['`]((?:sr_|room_)[a-z_$\{\}]+)['`]/g)].map(m => m[1].replace(/\$\{[^}]+\}/g, '')).filter(k => !k.endsWith('_'))
    .concat(['sr_mood_1', 'sr_mood_2', 'sr_mood_3', 'sr_mood_4', 'sr_mood_5', 'sr_skipped_budget', 'sr_skipped_unavailable', 'sr_skipped_provider', 'sr_milestone_five_left', 'sr_milestone_planned'])
  for (const key of new Set(keys)) assert.equal((copy.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length >= 2, true, `${key} en ES y EN`)
})

// E230: quien no comparte se llama «Persona n» (nunca un título vacío) y el 403 al iniciar no ofrece «Reintentar»; el foco entra al encabezado de la sala.
test('ES-179 (E230): «Persona n» en la previa, 403 sin reintentar y foco al encabezado de la sala', () => {
  const room = read('../src/pages/therapist/SessionRoom.tsx'), copy = read('../src/i18n/therapistCopy.ts')
  assert.ok(room.includes("session.patientName ?? (session.patientOrdinal ? t('sr_person'"))
  assert.doesNotMatch(room, /patientName \?\? ''/)
  assert.ok(room.includes("res.status === 403) { setStartFailure('access')") && room.includes("!(phase === 'start_error' && startFailure === 'access')"))
  assert.ok(room.includes('<h1 ref={title} tabIndex={-1} className="sr-visually-hidden">'))
  for (const key of ['sr_person', 'sr_person_plain', 'sr_start_no_access']) assert.equal((copy.match(new RegExp('\\b' + key + ':', 'g')) ?? []).length, 2, key)
})
