import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveInitialLang } from '../src/i18n/resolveLang.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const header = read('../src/components/landing/LandingHeader.tsx')
const provider = read('../src/i18n/LanguageProvider.tsx')
const page = read('../src/pages/LandingPage.tsx')
const css = read('../src/components/landing/landing.css')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const keys = new Set(catalog.map(entry => entry.key))

test('ES-62: el idioma guardado manda; sin él, el del navegador; por defecto ES', () => {
  assert.equal(resolveInitialLang('en', 'es-CO'), 'en')
  assert.equal(resolveInitialLang('es', 'en-US'), 'es')
  assert.equal(resolveInitialLang(null, 'en-US'), 'en')
  assert.equal(resolveInitialLang(undefined, 'EN-gb'), 'en')
  assert.equal(resolveInitialLang(null, 'es-CO'), 'es')
  assert.equal(resolveInitialLang(null, 'fr-FR'), 'es')
  assert.equal(resolveInitialLang('xx', 'fr'), 'es')
  assert.equal(resolveInitialLang(null, undefined), 'es')
  assert.equal(resolveInitialLang('', ''), 'es')
})

test('ES-62: LanguageProvider sincroniza <html lang> y tolera un almacenamiento bloqueado', () => {
  assert.match(provider, /document\.documentElement\.lang = lang/)
  assert.match(provider, /useEffect\(\(\) => \{[^}]*document\.documentElement\.lang = lang[^}]*\}, \[lang\]\)/s)
  assert.match(provider, /try \{ return localStorage\.getItem\('elv_lang'\) \} catch/)
  assert.match(provider, /try \{ localStorage\.setItem\('elv_lang', l\) \} catch/)
  assert.match(provider, /resolveInitialLang\(readSavedLang\(\), navigator\.language\)/)
})

test('ES-62/68: la cabecera usa el catálogo y activa solo la sección de fase 2 existente', () => {
  const used = [...header.matchAll(/text\((?:'|`)(landing\.[^'`]+)(?:'|`)\)/g)].map(match => match[1])
    .flatMap(key => key.includes('${code}') ? ['es', 'en'].map(code => key.replace('${code}', code)) : [key])
  assert.ok(used.length >= 5)
  for (const key of used) assert.ok(keys.has(key), `clave inexistente: ${key}`)
  assert.match(header, /href="#como-funciona"/)
  assert.match(header, /landing\.nav\.how/)
  assert.doesNotMatch(header, /landing\.nav\.(skillmap|pros|plans)/)
  assert.doesNotMatch(header, /dangerouslySetInnerHTML|fetch\(/)
})

test('ES-62: enlaces solo a rutas existentes (/ y /login) y selector con aria-pressed', () => {
  const targets = [...header.matchAll(/<Link to="([^"]+)"/g)].map(match => match[1])
  assert.deepEqual(targets.sort(), ['/', '/login'])
  assert.match(header, /aria-pressed=\{lang === code\}/)
  assert.match(header, /role="group" aria-label=\{text\('landing\.header\.language'\)\}/)
  assert.match(header, /lang=\{code\}/)
})

test('ES-62: el enlace de salto es el primer elemento enfocable y apunta al contenido principal', () => {
  const skip = header.indexOf('href="#contenido"')
  assert.ok(skip > 0)
  for (const later of ['<Link', '<button']) assert.ok(skip < header.indexOf(later), later)
  assert.match(page, /<LandingHeader text=\{landing\.text\} lang=\{lang\} setLang=\{setLang\} \/>/)
  assert.match(page, /<main id="contenido" tabIndex=\{-1\}>/)
  assert.ok(page.indexOf('<LandingHeader') < page.indexOf('<main id="contenido"'))
  assert.ok(page.indexOf('</main>') < page.indexOf('<footer'))
  assert.doesNotMatch(page, /ELEVATION<\/span>\s*<nav/)
})

test('ES-62: estilos de salto, idioma activo en tinta invertida, 44 px y foco ocre', () => {
  assert.match(css, /\.landing-skip:focus \{ left: 0\.5rem/)
  assert.match(css, /\.landing-lang\[aria-pressed='true'\] \{ background: var\(--color-primary\)/)
  assert.match(css, /\.landing-lang \{ min-width: 44px/)
  assert.match(css, /\.landing-logo \{[^}]*min-height: 44px/)
  assert.match(css, /\.landing-logo-dot \{[^}]*width: 7px; height: 7px/)
  assert.match(css, /\.landing-scope :is\(button, a\):focus-visible \{ outline: 3px solid var\(--color-secondary\)/)
})
