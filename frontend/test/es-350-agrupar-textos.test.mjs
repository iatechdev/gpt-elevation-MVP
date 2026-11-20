// ES-350: «Textos públicos» agrupa los 337 textos por prefijo (acordeón) y los filtra con un buscador. Lógica pura + estructura de la pantalla.
// Los textos nuevos (buscador, contador, resumen) son la PROPUESTA de UX/UI-Claude (ES-350, comentario 12624): quedan detrás de la aprobación de Alejo; esta prueba solo exige que tengan ES y EN.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adminText } from '../src/i18n/adminCopy.ts'
import { countPhrase, groupFields, matchingKeys, normalize } from '../src/pages/admin/landingGroups.ts'
import { landingFieldLabel } from '../src/pages/admin/landingLabels.ts'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const screen = read('../src/pages/admin/AdminContent.tsx')
const fieldsFor = lang => [{ key: 'hero_title', label: 'Título Hero' }, { key: 'hero_subtitle', label: 'Subtítulo Hero' }, { key: 'cta_primary', label: 'CTA Principal' },
  ...catalog.map(({ key }) => ({ key, label: landingFieldLabel(key, lang) }))]

test('ES-350: cada texto cae en UN grupo (o queda suelto si es de nombre propio) y el total no cambia, en ES y EN', () => {
  for (const lang of ['es', 'en']) {
    const fields = fieldsFor(lang); const { loose, groups } = groupFields(fields)
    assert.deepEqual(loose, ['hero_title', 'hero_subtitle', 'cta_primary'])
    const keys = [...loose, ...groups.flatMap(g => g.keys)]
    assert.equal(keys.length, fields.length, 'ningún texto se pierde'); assert.equal(new Set(keys).size, fields.length, 'ninguno se repite')
    assert.equal(groups.length, 19, `19 grupos en ${lang}`)
    assert.ok(groups.every(g => g.keys.length > 0 && g.name.length > 0 && !g.name.includes(' · ')))
    assert.equal(groups[0].name, lang === 'es' ? 'Navegación' : 'Navigation', 'el primer grupo es el de la navegación')
  }
})

test('ES-350: la búsqueda ignora mayúsculas y acentos, busca por la etiqueta en el idioma activo y vacía devuelve todo', () => {
  const es = fieldsFor('es'); const en = fieldsFor('en')
  assert.equal(normalize('  Navegación  Principal '), 'navegacion principal')
  assert.equal(matchingKeys(es, '').size, es.length); assert.equal(matchingKeys(es, '   ').size, es.length)
  assert.ok(matchingKeys(es, 'NAVEGACION').has('landing.nav.skip'), 'sin acentos ni mayúsculas')
  assert.ok(matchingKeys(en, 'navigation').has('landing.nav.skip') && !matchingKeys(en, 'navegacion').has('landing.nav.skip'), 'busca en el idioma de la interfaz')
  assert.equal(matchingKeys(es, 'zzzz-no-existe').size, 0)
  assert.ok(matchingKeys(es, 'título hero').has('hero_title'), 'también los textos sueltos')
})

test('ES-350: el contador usa el plural del idioma y 0 no se dice como número', () => {
  assert.equal(countPhrase(1, 'es', '1 resultado', '{n} resultados'), '1 resultado'); assert.equal(countPhrase(5, 'es', '1 resultado', '{n} resultados'), '5 resultados')
  assert.equal(countPhrase(1, 'en', '1 result', '{n} results'), '1 result'); assert.equal(countPhrase(12, 'en', '1 result', '{n} results'), '12 results')
  assert.match(screen, /matches\.size === 0 \? tr\('Sin resultados'\)/)
})

test('ES-350: los textos nuevos existen en ES y EN (propuesta de UX/UI, pendiente de Alejo)', () => {
  const pairs = [['Buscar un texto', 'Search for a text'], ['Por nombre del texto', 'By text name'], ['Buscar textos públicos', 'Search public texts'], ['1 resultado', '1 result'], ['{n} resultados', '{n} results'],
    ['Sin resultados', 'No results'], ['1 texto', '1 text'], ['{n} textos', '{n} texts']]
  for (const [es, en] of pairs) { assert.equal(adminText(es, 'es'), es); assert.equal(adminText(es, 'en'), en) }
})

test('ES-350: la pantalla tiene buscador (role=search, etiqueta visible), contador role=status, acordeones nativos y filas OCULTAS que siguen montadas (lo escrito sin guardar no se pierde)', () => {
  assert.match(screen, /<div className="ac-search" role="search" aria-label=\{tr\('Buscar textos públicos'\)\}>/)
  assert.match(screen, /<TextField id="landing-search" type="search" label=\{tr\('Buscar un texto'\)\} placeholder=\{tr\('Por nombre del texto'\)\}/)
  assert.match(screen, /role="status" aria-live="polite" className="cg-hint ac-count"/)
  assert.match(screen, /<details key=\{group\.id\} className="ac-group" open=\{searching \? visible > 0 : index === 0\} hidden=\{searching && visible === 0\}>/)
  assert.match(screen, /<li className="cg-item ac-frow" hidden=\{hidden\}>/); assert.match(screen, /hidden=\{!matches\.has\(f\.key\)\}/)
  assert.doesNotMatch(screen.slice(screen.indexOf('function LandingTab')), /fields\.filter\(f => matches/, 'filtrar no desmonta filas')
  assert.match(screen, /`\$\{group\.name\}, \$\{countPhrase\(/, 'el resumen dice «grupo, n textos»')
})

test('ES-350: sin estilos en línea ni colores propios en lo nuevo', () => {
  const css = read('../src/pages/admin/adminContent.css').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|--elv-|--color-/)
  assert.doesNotMatch(screen, /style=\{\{/); assert.match(css, /\.ac-group\b/); assert.match(css, /\.ac-summary\b/)
})
