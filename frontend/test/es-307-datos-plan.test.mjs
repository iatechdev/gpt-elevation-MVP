// ES-307 (PR 1): «Mis datos» y «Mi plan» en Cartografía. La lógica y los textos no cambian (los cubren es-135 y es-174); aquí solo el marco visual y el registro de rutas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { MIGRATED_PERSON_PATHS, isMigratedPersonPath } from '../src/shell/personLayoutState.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-307: /app/data y /app/plan están registradas como migradas (tema claro/oscuro del sistema, sin elv-theme)', () => {
  for (const path of ['/app/data', '/app/plan']) { assert.ok(MIGRATED_PERSON_PATHS.includes(path), path); assert.ok(isMigratedPersonPath(path)) }
  assert.equal(isMigratedPersonPath('/app/compass'), false) // el resto de Persona A migra en sus propios PR
})

test('ES-307: las dos pantallas usan Cartografía y ya no usan SpaceShell, SpaceDialog, clases elv-* ni space-*, ni estilos en línea ni colores fijos', () => {
  for (const file of ['DataPage', 'PlanPage', 'PersonScreen']) {
    const source = read(`../src/space/${file}.tsx`)
    assert.doesNotMatch(source, /SpaceShell|SpaceDialog|className="[^"]*\b(elv-|space-)|style=\{\{|#[0-9a-fA-F]{3,6}\b/, file)
  }
  assert.match(read('../src/space/DataPage.tsx'), /<Dialog open=\{open\}/); assert.match(read('../src/space/DataPage.tsx'), /<Button variant="danger"/)
  assert.match(read('../src/space/PlanPage.tsx'), /className="pg-grid"/)
  assert.doesNotMatch(read('../src/cartografia/pages.css'), /#[0-9a-fA-F]{3,6}\b|rgb\(/) // solo tokens --cg-*
})

test('ES-307: las regiones vivas existen siempre y el error lleva texto y símbolo, no solo color', () => {
  const screen = read('../src/space/PersonScreen.tsx')
  assert.match(screen, /role=\{error \? 'alert' : 'status'\} aria-live="polite"/); assert.match(screen, /cg-banner--error/)
  assert.match(read('../src/cartografia/cartografia.css'), /cg-banner--error \.cg-banner__title::before \{ content: '.26A0/)
})
