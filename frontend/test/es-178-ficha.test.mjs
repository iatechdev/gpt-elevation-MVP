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
