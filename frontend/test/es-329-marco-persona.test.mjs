// ES-329 (E311-1, E311-2): las cuatro pantallas migradas al marco de persona no pueden salirse de la lista ni recuperar su cabecera propia, y el catálogo devuelve el foco al título tras «Reintentar».
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MIGRATED_PERSON_PATHS, isMigratedPersonPath } from '../src/shell/personLayoutState.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const SCREENS = {
  '/app/progress': '../src/pages/UserProgress.tsx', '/app/feedback': '../src/pilot/FeedbackPage.tsx',
  '/app/professional-reviews': '../src/facilitation/PersonReviews.tsx', '/app/route-catalog': '../src/routeCatalog/PersonCatalog.tsx',
}

test('ES-329 (E311-2): las cuatro rutas siguen en MIGRATED_PERSON_PATHS (y sus subrutas también)', () => {
  for (const path of Object.keys(SCREENS)) {
    assert.ok(MIGRATED_PERSON_PATHS.includes(path), path); assert.ok(isMigratedPersonPath(path), path); assert.ok(isMigratedPersonPath(`${path}/algo`), `${path}/algo`)
  }
  assert.ok(!isMigratedPersonPath('/app'), 'una ruta no listada conserva el lienzo claro heredado')
})

test('ES-329 (E311-2): cada pantalla usa PersonScreen y NO vuelve a dibujar su cabecera, selector de idioma, «Saltar al contenido» ni «Volver»', () => {
  for (const [path, file] of Object.entries(SCREENS)) {
    const source = read(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    assert.match(source, /<PersonScreen\b/, `${path} usa PersonScreen`)
    for (const forbidden of [/CartografiaRoot/, /LangSwitch/, /<header\b/, /cg-skip/, /Saltar al contenido|Skip to content/, /\bVolver\b|\bBack\b(?! to)/, /class(?:Name)?="cg cg(?:f|p)\b/]) assert.doesNotMatch(source, forbidden, `${path}: ${forbidden}`)
  }
})

test('ES-329 (E311-1): tras «Reintentar» en la LISTA del catálogo, el foco pasa al título (el aviso con foco se desmonta al cargar)', () => {
  const source = read('../src/routeCatalog/PersonCatalog.tsx')
  assert.match(source, /useEffect\(\(\) => \{ if \(attempt > 0 && !status && catalog && !roleKey\) titleRef\.current\?\.focus\(\) \}, \[attempt, status, catalog, roleKey\]\)/)
  assert.match(source, /titleRef=\{titleRef\}>/, 'el título siempre recibe la referencia')
  assert.match(read('../src/space/PersonScreen.tsx'), /tabIndex=\{titleRef \? -1 : undefined\}/, 'el título es enfocable por programa, no por Tab')
})
