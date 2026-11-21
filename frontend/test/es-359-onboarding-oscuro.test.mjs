// ES-359 (E398-1): en /app/onboarding, modo oscuro, la tarjeta «Empieza desde tu hoja de vida» tenía texto claro sobre fondo claro porque
// resume.css (.participant-context-scope .rs-*, 0,2,0) empataba con .cg-onboarding .rs-* y ganaba por orden de carga. El prefijo doble sube la especificidad.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/context/onboardingCartografia.css', import.meta.url), 'utf8')
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')

test('E398-1: ninguna regla .rs-* de Cartografía empata en especificidad con resume.css', () => {
  assert.equal((rules.match(/(?<!participant-context-scope)\.cg-onboarding \.rs-/g) ?? []).length, 0, 'todo selector .rs-* lleva .participant-context-scope.cg-onboarding delante')
  assert.ok((rules.match(/\.participant-context-scope\.cg-onboarding \.rs-/g) ?? []).length >= 30)
})

test('E398-1: la tarjeta con tinte resuelve sus colores con tokens --cg-* (sin hex)', () => {
  const tint = rules.split('\n').find(line => line.includes('.rs-tint,'))
  assert.match(tint, /background: color-mix\(in srgb, var\(--cg-good\) 12%, var\(--cg-panel\)\)/); assert.match(tint, /color: var\(--cg-ink\)/); assert.doesNotMatch(tint, /#[0-9a-fA-F]{3,6}\b/)
})
