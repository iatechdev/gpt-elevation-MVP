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
  assert.equal(mod.daysSince('2026-11-10T08:00:00Z', now, 'UTC'), 0)
  assert.equal(mod.daysSince('2026-11-07T11:00:00Z', now, 'UTC'), 3)
  assert.equal(mod.daysSince(null, now, 'UTC'), null); assert.equal(mod.daysSince('no-es-fecha', now, 'UTC'), null); assert.equal(mod.daysSince('2026-13-45x', now, 'UTC'), null)
  assert.equal(mod.daysSince('2099-01-01', now, 'UTC'), 0, 'una fecha futura no da días negativos')
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

// E210-1: el registro de ánimo es una FECHA (DATEONLY), no un instante: los días se cuentan entre días de calendario locales.
test('ES-177 B1 (E210-1): un registro de hoy dice «hoy» en Bogotá a las 20:00 y uno de ayer no dice «hoy» en Auckland', () => {
  // 10-nov 20:00 en Bogotá (UTC-5) = 11-nov 01:00 UTC
  const bogotaEvening = Date.parse('2026-11-11T01:00:00Z')
  assert.equal(mod.daysSince('2026-11-10', bogotaEvening, 'America/Bogota'), 0, 'hoy (antes: hace 1 d)')
  assert.equal(mod.daysSince('2026-11-09', bogotaEvening, 'America/Bogota'), 1)
  // 11-nov 09:00 en Auckland (UTC+13 en noviembre) = 10-nov 20:00 UTC
  const aucklandMorning = Date.parse('2026-11-10T20:00:00Z')
  assert.equal(mod.daysSince('2026-11-10', aucklandMorning, 'Pacific/Auckland'), 1, 'ayer (antes: hoy)')
  assert.equal(mod.daysSince('2026-11-11', aucklandMorning, 'Pacific/Auckland'), 0)
  // justo antes y después de la medianoche local
  assert.equal(mod.daysSince('2026-11-10', Date.parse('2026-11-11T04:59:59Z'), 'America/Bogota'), 0)
  assert.equal(mod.daysSince('2026-11-10', Date.parse('2026-11-11T05:00:00Z'), 'America/Bogota'), 1)
  // un instante ISO se pasa al día local de la misma zona
  assert.equal(mod.daysSince('2026-11-11T03:30:00Z', bogotaEvening, 'America/Bogota'), 0)
  assert.equal(mod.daysSince('2026-11-10T03:30:00Z', bogotaEvening, 'America/Bogota'), 1, 'las 22:30 del 9-nov en Bogotá')
})

test('ES-177 B1 (E210-2/3): botones de 44 px, nombres largos que se parten y reintentos con nombre accesible propio', () => {
  const sections = read('../src/pages/therapist/PanelSections.tsx')
  assert.match(sections, /primaryBtn: CSSProperties = \{ minHeight: 44, minWidth: 44/)
  assert.ok((sections.match(/overflowWrap: 'anywhere'/g) ?? []).length >= 5)
  assert.match(sections, /aria-label=\{`\$\{t\('panel_retry'\)\}: \$\{sectionName\}`\}/)
})
