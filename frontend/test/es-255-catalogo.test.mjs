// ES-255: catálogo de rutas de la persona — aviso de pestaña nueva en enlaces externos, industria en la lista, sin claves crudas de capacidad, nombres de mercado e idioma y filtro de idioma por idioma del rol.
// Estructura y textos; el comportamiento real (respuesta real del endpoint publicado, DOM, axe) lo mide scripts/es255-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const pages = read('../src/routeCatalog/CatalogPages.tsx'); const copy = read('../src/routeCatalog/copy.ts')

test('ES-255 enlaces externos: el aviso va dentro del mismo enlace, que sigue siendo https con noopener', () => {
  assert.match(pages, /<a className="elv-link" href=\{safe\} target="_blank" rel="noopener noreferrer">\{children\} · \{new URL\(safe\)\.hostname\} <small>\(\{tr\('new_tab'\)\}\)<\/small><\/a>/)
  assert.match(copy, /new_tab: \['se abre en una pestaña nueva', 'opens in a new tab'\]/)
})

test('ES-255 claves crudas: ninguna skillKey / linkedSkillKey se muestra; sin nombre disponible se dice «Capacidad por confirmar»', () => {
  assert.doesNotMatch(pages, /\{string\(object\(v\)\.skillKey\)\}/); assert.doesNotMatch(pages, /\{string\(resource\.linkedSkillKey\)\}/)
  assert.match(pages, /\{tr\('skill_unknown'\)\} · \{tr\(string\(object\(v\)\.importance\)\)\}/)
  assert.match(copy, /skill_unknown: \['Capacidad por confirmar', 'Skill to be confirmed'\]/)
})

test('ES-255 lista y filtros: industria en la tarjeta, mercado/idioma con nombre (Intl.DisplayNames) y filtro de idioma por idioma del ROL', () => {
  assert.match(pages, /\{string\(object\(row\.industry\)\[lang\]\) \|\| tr\('unknown'\)\} · \{names\.country\(row\.market\)\}/)
  assert.match(pages, /new Intl\.DisplayNames\(\[lang\], \{ type \}\)/)
  assert.match(pages, /\(!language \|\| array\(row\.languagesRequired\)\.includes\(language\)\)/) // antes: por los idiomas de los recursos
  assert.doesNotMatch(pages, /resource\.language === language/)
  assert.match(copy, /language_filter: \['Idioma del rol', 'Role language'\]/)
  // un código que el navegador no conoce se dice «Por confirmar», nunca crudo
  assert.match(pages, /out\.toLowerCase\(\) !== value\.toLowerCase\(\) \? out : tr\('unknown'\)/)
})

// E255-1: la fuente de una tarea se dice con el TÍTULO de la fuente (viene en el payload) o «Fuente por confirmar»; nunca con su clave interna (sourceKey)
test('ES-255 E255-1: ninguna clave interna de fuente se muestra', () => {
  assert.doesNotMatch(pages, /string\(exposure\.sourceKey\)/)
  assert.match(pages, /const sourceTitle = \(key: unknown\) => string\(catalog\.sources\.find\(source => source\.sourceKey === key\)\?\.title\) \|\| tr\('source_unknown'\)/)
  assert.match(pages, /\$\{sourceTitle\(exposure\.sourceKey\)\}/)
  assert.match(copy, /source_unknown: \['Fuente por confirmar', 'Source to be confirmed'\]/)
})
