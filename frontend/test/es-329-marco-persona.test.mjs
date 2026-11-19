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

// ES-347 (E311-3): M4 y M5 de #311 no los detectaba ninguna prueba. Cada una falla con su mutación (ver la tabla en el PR).
test('ES-347 (M4): al abrir el detalle de un rol, y al recuperarse de un error, el foco va al título del rol (un solo h1, el del marco de pantalla)', () => {
  const source = read('../src/routeCatalog/PersonCatalog.tsx').replace(/\/\/.*$/gm, '')
  // El efecto corre cuando aparece el rol (carga inicial, tras «Reintentar» de un error o al cambiar de rol): depende de la clave del rol, no de [] ni de nada que no cambie.
  assert.match(source, /useEffect\(\(\) => \{ if \(role\) titleRef\.current\?\.focus\(\) \}, \[role\?\.roleKey\]\)/)
  // El título que recibe el foco es el del rol: Screen lo recibe con el nombre del rol y la referencia, y PersonScreen la pone en el único h1.
  assert.match(source, /const heading = role \? string\(object\(role\.labels\)\[lang\]\) \|\| tr\('unknown'\) : tr\('title'\)/)
  assert.match(source, /<Screen title=\{heading\} lead=\{roleKey \? undefined : tr\('intro'\)\} titleRef=\{titleRef\}>/)
  assert.match(read('../src/space/PersonScreen.tsx'), /<h1 className="pg-title" ref=\{titleRef\} tabIndex=\{titleRef \? -1 : undefined\}>/)
  // El detalle no vuelve a dibujar su propio título (dos h1, y el foco iría a uno que no es el visible).
  const detail = source.slice(source.indexOf('function RoleDetail'))
  assert.doesNotMatch(detail, /<h1\b/, 'RoleDetail no dibuja otro h1')
  assert.doesNotMatch(detail, /role-title/, 'sin el id/aria-labelledby del título antiguo')
})

test('ES-347 (M5): /app/progress no recupera alto fijo, relleno propio ni columna centrada dentro del marco de persona (los pone PersonLayout/PersonScreen)', () => {
  const css = read('../src/progress/progress.css').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({ selector: selector.trim(), body }))
  const own = rules.filter(rule => rule.selector.split(',').map(s => s.trim()).some(s => s === '.prg' || s === '.prg-main'))
  assert.ok(own.length >= 2, 'siguen existiendo las reglas .prg y .prg-main')
  for (const rule of own) assert.doesNotMatch(rule.body, /(^|[;\s])(min-height|max-height|height|padding(-[a-z]+)?|max-width|margin(-[a-z]+)?)\s*:/, `${rule.selector}: sin alto, relleno, ancho máximo ni margen propios`)
  const source = read('../src/pages/UserProgress.tsx').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(source, /cg-page|100dvh|min-h-screen|style=\{\{/, 'sin clases ni estilos que fijen alto o página')
  assert.match(source, /<PersonScreen title=\{t\('pr_title'\)\} lead=\{t\('pr_period'\)\} titleRef=\{titleRef\}>\s*<div className="prg prg-main">/)
})
