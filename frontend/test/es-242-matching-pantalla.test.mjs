// ES-242: la pantalla del emparejamiento no muestra ninguna puntuación inventada («Compatibilidad x/10» / «Match x/10»).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync(new URL('../src/components/MatchingModal.tsx', import.meta.url), 'utf8')

test('ES-242: MatchingModal no pide ni muestra puntuación (ni «Compatibilidad» ni «/10»)', () => {
  assert.ok(!/\bscore\b/i.test(modal), 'el tipo de la sugerencia ya no incluye score')
  assert.ok(!/Compatibilidad|Match\}?:|\/10/.test(modal), 'no hay texto de compatibilidad ni de x/10')
  assert.match(modal, /\{s\.reason\}/) // sí se muestra la razón
})

test('ES-242: ninguna otra pantalla consume la puntuación (UserProgress mostraba «{s.score}/10» y saldría «undefined/10»)', () => {
  const progress = readFileSync(new URL('../src/pages/UserProgress.tsx', import.meta.url), 'utf8')
  assert.ok(!/\bscore\b/.test(progress.slice(progress.indexOf('interface MatchingSuggestion'), progress.indexOf('interface MatchingSuggestion') + 200)), 'el tipo ya no tiene score')
  assert.ok(!/\{s\.score\}\/10/.test(progress))
  assert.ok(!/s\.score/.test(progress))
})
