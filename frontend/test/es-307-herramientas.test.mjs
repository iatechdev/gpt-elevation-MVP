// ES-307 (PR 2): Herramientas y Ejercicios en Cartografía. Sin DOM: contratos del código; el comportamiento en navegador lo verifica scripts/es307b-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isMigratedPersonPath } from '../src/shell/personLayoutState.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-307: las dos rutas están en el marco migrado y las pantallas usan PersonScreen, no el marco anterior', () => {
  for (const path of ['/app/space/tools', '/app/exercises']) assert.equal(isMigratedPersonPath(path), true, path)
  const tools = read('../src/space/SpaceToolsPage.tsx'); const page = read('../src/exercises/ExercisePage.tsx')
  assert.match(tools, /<PersonScreen title=\{c\.tools\}/); assert.doesNotMatch(tools, /SpaceShell|elv-card|elv-btn|space-grid/)
  assert.match(page, /<PersonScreen title=\{tr\('title'\)\}/); assert.doesNotMatch(page, /exercise-scope|elv-|<dialog|showModal|exercise-skip|setLang/)
})

test('ES-307: ejercicios usa el Dialog de Cartografía para «cerrar sin guardar» y conserva la guardia de salida', () => {
  const page = read('../src/exercises/ExercisePage.tsx')
  assert.match(page, /<Dialog open=\{!!target\}/); assert.match(page, /title=\{tr\('leave'\)\}/)
  assert.match(page, /registerExerciseGuard\(\(\) => copying \|\| !window\.confirm\(t\('exercise\.leave'\)\)\)/); assert.match(page, /addEventListener\('beforeunload', unload\)/)
  // Descartar y volver siguen siendo acciones separadas; cerrar el diálogo (Esc o «Volver al ejercicio») no borra las notas.
  assert.match(page, /onClick=\{\(\) => setTarget\(null\)\}>\{tr\('return'\)\}/); assert.match(page, /if \(target\) finish\(target\)/)
  assert.doesNotMatch(page, /localStorage\.setItem|sessionStorage|console\./)
})

test('ES-307: las notas siguen en memoria y los avisos son regiones vivas (Notice); el error de copia es alert', () => {
  const page = read('../src/exercises/ExercisePage.tsx')
  assert.match(page, /<Notice error=\{status === 'copy_error'\} text=\{status \? tr\(status\) : ''\} \/>/)
  assert.match(page, /<TextAreaField label=\{tr\('notes'\)\} id="exercise-notes"/); assert.match(page, /aria-describedby="exercise-private"/)
  assert.match(page, /navigator\.clipboard\?\.writeText/)
})

test('ES-307: exercises.css ya no tiene colores fijos de la pantalla (solo ExerciseTools del panel) y el aviso usa tokens', () => {
  const css = read('../src/exercises/exercises.css')
  assert.doesNotMatch(css, /exercise-scope/); assert.match(css, /\.exercise-warning \{[^}]*var\(--cg-mark\)/)
})
