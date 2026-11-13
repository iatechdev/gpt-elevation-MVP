// ES-254: «Tu progreso» sin emojis ni estrellas, escala «N de 5», tendencia en texto y aviso no clínico, con textos ES/EN en catálogo.
// Estructura y textos; el comportamiento real (respuesta real del endpoint, base, axe, error con reintento) lo mide scripts/es254-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { progressEs, progressEn } from '../src/pages/progressCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// ES-173: la página se repartió en UserProgress.tsx (lectura y estados), progress/ProgressPanel.tsx (cifras e historial) y progress/ProgressMatching.tsx (emparejamiento).
const page = read('../src/pages/UserProgress.tsx')
const panel = read('../src/progress/ProgressPanel.tsx')
const progressPart = page + panel

test('ES-254: la pantalla de progreso no usa emojis ni estrellas como indicador', () => {
  assert.doesNotMatch(progressPart, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|★|☆/u) // E254-1: ni el botón «Buscar terapeuta» del encabezado lleva emoji (el modal es de ES-169 PR2)
  assert.doesNotMatch(page, /MOOD_EMOJI/)
  assert.doesNotMatch(progressPart, /'#22C55E'|'#EF4444'/) // sin verde/rojo de tendencia
})

test('ES-254: cifras como «N de 5», tendencia en texto y aviso no clínico', () => {
  assert.match(panel, /fill\(t\('pr_of5'\), \{ n: avg\(stats\.avgMood\) \}\)/)
  assert.match(panel, /fill\(t\('pr_of5'\), \{ n: avg\(stats\.avgRating\) \}\)/)
  // la tendencia sale de trendOf (palabra pr_up / pr_same / pr_down); el símbolo solo la acompaña (ES-173: palabra + símbolo)
  assert.match(panel, /trendOf\(log\.checkin_mood as number, log\.checkout_mood as number\)/); assert.match(panel, /\{ up: 'pr_up', same: 'pr_same', down: 'pr_down' \}/)
  assert.match(page, /<p role="note"[^>]*>\{t\('pr_note'\)\}<\/p>/)
  // error recuperable con «Reintentar»
  assert.match(page, /kind="error" title=\{t\('pr_error'\)\}/); assert.match(page, /setAttempt\(value => value \+ 1\)/)
  // una calificación vacía no se muestra como «1 de 5»
  assert.match(page, /filter\(\(row: SessionRating\) => typeof row\.rating === 'number'\)/)
})

test('ES-254 textos ES/EN: mismas claves; el aviso dice que no es una medición de salud ni un diagnóstico; la tendencia es una palabra', () => {
  assert.deepEqual(Object.keys(progressEs).sort(), Object.keys(progressEn).sort())
  assert.match(progressEs.pr_note, /No son una medición de salud ni un diagnóstico/)
  assert.match(progressEn.pr_note, /not a health measurement or a diagnosis/)
  assert.deepEqual([progressEs.pr_up, progressEs.pr_same, progressEs.pr_down], ['Subió', 'Igual', 'Bajó'])
  assert.deepEqual([progressEn.pr_up, progressEn.pr_same, progressEn.pr_down], ['Went up', 'Stayed the same', 'Went down'])
  for (const copy of [progressEs, progressEn]) { assert.equal(copy.pr_of5.includes('%'), false); for (const value of Object.values(copy)) assert.doesNotMatch(value, /[\u{1F300}-\u{1FAFF}]|★/u) }
  assert.deepEqual([1, 2, 3, 4, 5].map(n => progressEs[`pr_mood_${n}`]), ['muy bajo', 'bajo', 'medio', 'alto', 'muy alto'])
})
