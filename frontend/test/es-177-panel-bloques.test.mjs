// ES-177 (B1): cifras del panel profesional y estructura de bloques. Promedios solo con quienes comparten; «sin datos» es null (no 0); sin emojis ni estrellas.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const out = resolve(here, '.tmp-es177b')
let mod
before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(here, '../src/pages/therapist/panelFormat.ts'), platform: 'node', output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn' })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

const person = (over) => ({ id: 1, name: 'A', ordinal: 1, active: true, sharing: true, avgRating: null, trend: null, sessionsThisWeek: 0, totalSessions: 0, lastMood: null, ...over })

test('ES-177 B1: los promedios cuentan solo a quienes comparten y devuelven null (no 0) sin datos', () => {
  const people = [
    person({ id: 1, lastMood: { checkin_mood: 4, checkout_mood: 5, date: '2026-11-01' }, avgRating: 4, sessionsThisWeek: 2 }),
    person({ id: 2, lastMood: { checkin_mood: 3, checkout_mood: null, date: '2026-11-01' }, avgRating: 5 }),
    person({ id: 3, name: null, sharing: false, lastMood: { checkin_mood: 1, checkout_mood: 1, date: '2026-11-01' }, avgRating: 1, sessionsThisWeek: 9 }),
  ]
  assert.equal(mod.averageMood(people), 3.5)
  assert.equal(mod.averageRating(people), 4.5)
  assert.equal(mod.activeThisWeek(people), 1, 'quien no comparte no cuenta como activa')
  assert.equal(mod.averageMood([]), null); assert.equal(mod.averageRating([person({ sharing: false, avgRating: 3 })]), null)
  assert.equal(mod.averageMood([person({})]), null)
})

test('ES-177 B1: días desde el último registro y ventana «ahora» de una sesión', () => {
  const now = Date.parse('2026-11-10T12:00:00Z')
  assert.equal(mod.daysSince('2026-11-10T08:00:00Z', now), 0)
  assert.equal(mod.daysSince('2026-11-07T11:00:00Z', now), 3)
  assert.equal(mod.daysSince(null, now), null); assert.equal(mod.daysSince('no-es-fecha', now), null)
  assert.equal(mod.sessionIsNow('2026-11-10T12:10:00Z', 50, now), true, 'faltan 10 min')
  assert.equal(mod.sessionIsNow('2026-11-10T12:30:00Z', 50, now), false, 'faltan 30 min')
  assert.equal(mod.sessionIsNow('2026-11-10T11:30:00Z', 50, now), true, 'va por el minuto 30 de 50')
  assert.equal(mod.sessionIsNow('2026-11-10T10:00:00Z', 50, now), false, 'ya terminó')
})

test('ES-177 B1: los bloques no usan emojis ni estrellas, cada carga tiene su error con reintento y el panel no se pinta si falla una sección', () => {
  const sections = read('../src/pages/therapist/PanelSections.tsx'), dash = read('../src/pages/therapist/TherapistDashboard.tsx'), hook = read('../src/pages/therapist/useSection.ts')
  assert.doesNotMatch(sections, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[★☆]/u)
  assert.doesNotMatch(dash.split('VALIDACIÓN ACADÉMICA')[0], /MOOD_EMOJI|TREND_BADGE|display: noAccess/)
  assert.doesNotMatch(dash + sections + hook, /catch \{ \/\* non-blocking \*\/ \}/)
  assert.match(hook, /setStatus\('error'\)/)
  assert.match(sections, /role="alert"/); assert.match(sections, /panel_retry/)
  assert.match(dash, /useSection<PanelPerson\[\]>\('\/api\/therapist\/pacientes'\)/)
  for (const lang of ['Es', 'En']) assert.match(read('../src/i18n/therapistCopy.ts'), new RegExp(`therapist${lang}[\\s\\S]*panel_section_error`))
})
