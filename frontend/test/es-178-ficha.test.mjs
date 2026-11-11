// ES-178 (F1): cifras y cambios de ánimo de la ficha (sin 0 por nulos, «Sin datos» = null) y estructura: sin emojis ni estrellas, notas con versión, textos en ES y EN.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const out = resolve(here, '.tmp-es178')
let mod
before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(here, '../src/pages/therapist/followupFormat.ts'), platform: 'node', output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn' })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

test('ES-178: la calificación nula no cuenta como 0; sin valores válidos = null; fuera de escala se ignora', () => {
  assert.equal(mod.averageRatingOf([{ rating: 4 }, { rating: null }, { rating: 4 }, { rating: null }]), 4)
  assert.equal(mod.averageRatingOf([{ rating: null }, { rating: null }]), null)
  assert.equal(mod.averageRatingOf([]), null)
  assert.equal(mod.averageRatingOf([{ rating: 4 }, { rating: 4 }, { rating: 5 }]), 4.3)
  assert.equal(mod.averageRatingOf([{ rating: 3 }, { rating: 9 }, { rating: 0 }]), 3)
  assert.equal(mod.averageMoodOf([{ checkin_mood: 2, checkout_mood: null }, { checkin_mood: null, checkout_mood: 4 }, { checkin_mood: 3, checkout_mood: 3 }]), 3)
  assert.equal(mod.averageMoodOf([{ checkin_mood: null, checkout_mood: null }]), null)
})

test('ES-178: el cambio de ánimo se dice en palabras y es null si falta la entrada o la salida', () => {
  assert.equal(mod.moodChange({ checkin_mood: 2, checkout_mood: 4 }), 'up')
  assert.equal(mod.moodChange({ checkin_mood: 4, checkout_mood: 2 }), 'down')
  assert.equal(mod.moodChange({ checkin_mood: 3, checkout_mood: 3 }), 'same')
  assert.equal(mod.moodChange({ checkin_mood: 3, checkout_mood: null }), null)
  assert.equal(mod.MAX_HISTORY, 60)
})

test('ES-178: bloques sin emojis ni estrellas, la edición manda la versión de la nota y los textos existen en ES y EN', () => {
  const notes = read('../src/pages/therapist/FollowupNotes.tsx'), history = read('../src/pages/therapist/FollowupHistory.tsx'), copy = read('../src/i18n/therapistCopy.ts'), page = read('../src/pages/therapist/TherapistPatient.tsx')
  assert.doesNotMatch(notes + history, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[★☆]/u)
  assert.doesNotMatch(page, /MOOD_EMOJI/)
  assert.match(notes, /expectedUpdatedAt: expected/); assert.match(notes, /note_changed/); assert.match(notes, /showModal\(\)/)
  assert.match(notes, /timeZone: 'UTC'/); assert.match(history, /timeZone: 'UTC'/) // fechas DATEONLY: un día, no un instante
  const keys = [...(notes + history).matchAll(/t\('((?:fu_|panel_)[a-z_]+)'/g)].map(m => m[1]).concat(['fu_type_session_note', 'fu_type_observation', 'fu_type_goal', 'fu_up', 'fu_down', 'fu_same'])
  for (const key of new Set(keys)) assert.equal((copy.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length >= 2, true, `${key} en ES y EN`)
})

test('ES-178 F2: resumen con IA y agendar — códigos del servidor, sin «y n notas», sin reenvío a ciegas y textos en ES y EN', () => {
  const ai = read('../src/pages/therapist/AiSummaryBlock.tsx'), sch = read('../src/pages/therapist/ScheduleSession.tsx'), copy = read('../src/i18n/therapistCopy.ts')
  assert.doesNotMatch(ai + sch, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|[★☆]/u)
  for (const code of ['ai_budget_exhausted', 'ai_budget_not_configured']) assert.match(ai, new RegExp(code))
  assert.match(ai, /retry: false/); assert.doesNotMatch(copy, /y \{n\} notas|and \{n\} notes/)
  for (const code of ['scheduled_in_past', 'duration_invalid', 'session_conflict', 'invalid_input']) assert.match(sch, new RegExp(code))
  assert.match(sch, /status=scheduled/); assert.match(sch, /showModal\(\)/); assert.match(sch, /DURATIONS = \[30, 45, 50, 60, 90\]/)
  const keys = [...(ai + sch).matchAll(/t\('((?:fu_)[a-z_]+)'/g)].map(m => m[1]).concat(['fu_sch_required', 'fu_sch_past', 'fu_sch_duration', 'fu_sch_conflict', 'fu_sch_noaccess', 'fu_sch_error', 'fu_sch_unsure', 'fu_ai_budget', 'fu_ai_budget_nodate'])
  for (const key of new Set(keys)) assert.equal((copy.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length >= 2, true, `${key} en ES y EN`)
})

// E226-1: la fecha propuesta de una nota nueva es HOY en calendario local, no el día UTC.
test('ES-178 (E226-1): localToday da el día de calendario local en Bogotá y en Auckland', () => {
  assert.equal(mod.localToday(Date.parse('2026-11-11T01:00:00Z'), 'America/Bogota'), '2026-11-10', '20:00 del 10 en Bogotá (antes proponía el 11)')
  assert.equal(mod.localToday(Date.parse('2026-11-10T20:00:00Z'), 'Pacific/Auckland'), '2026-11-11', '09:00 del 11 en Auckland')
  assert.equal(mod.localToday(Date.parse('2026-11-10T12:00:00Z'), 'UTC'), '2026-11-10')
  assert.equal(mod.localToday(Date.parse('2026-11-11T04:59:59Z'), 'America/Bogota'), '2026-11-10'); assert.equal(mod.localToday(Date.parse('2026-11-11T05:00:00Z'), 'America/Bogota'), '2026-11-11')
  assert.doesNotMatch(read('../src/pages/therapist/FollowupNotes.tsx'), /toISOString\(\)\.split/)
})

// E226-2: con el tope de 60 las cifras lo dicen (sin inventar un total).
test('ES-178 (E226-2): las cifras llevan el tope de 60 junto al número cuando se alcanza', () => {
  const history = read('../src/pages/therapist/FollowupHistory.tsx'), copy = read('../src/i18n/therapistCopy.ts')
  assert.match(history, /fu_fig_entries_cap/); assert.match(history, /fu_fig_mood_cap/); assert.match(history, /fu_fig_rating_cap/)
  for (const key of ['fu_fig_entries_cap', 'fu_fig_mood_cap', 'fu_fig_rating_cap']) assert.equal((copy.match(new RegExp(`\\b${key}:`, 'g')) ?? []).length, 2, key)
})
