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
