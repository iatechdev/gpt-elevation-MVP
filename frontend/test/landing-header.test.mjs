import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveInitialLang } from '../src/i18n/resolveLang.ts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const header = read('../src/components/landing/LandingHeader.tsx')
const provider = read('../src/i18n/LanguageProvider.tsx')
const page = read('../src/pages/LandingPage.tsx')
const css = read('../src/components/landing/landing.css') + read('../src/components/landing/landingScope.css') // ES-155 C: las reglas de las secciones viven en landingScope.css
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const keys = new Set(catalog.map(entry => entry.key))
const compiled = ts.transpileModule(header, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  .replace("'react'", JSON.stringify(import.meta.resolve('react')))
  .replace("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))
const { LandingHeader } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

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

test('ES-62/68/70/73: actual header links reach existing sections, and home sections (ES-360: sin enlace a Planes)', () => {
  const used = [...header.matchAll(/text\((?:'|`)(landing\.[^'`]+)(?:'|`)\)/g)].map(match => match[1])
    .flatMap(key => key.includes('${code}') ? ['es', 'en'].map(code => key.replace('${code}', code)) : [key])
  assert.ok(used.length >= 5)
  for (const key of used) assert.ok(keys.has(key), `clave inexistente: ${key}`)
  for (const homeSections of [false, true]) {
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LandingHeader, {
      homeSections, lang: 'es', setLang() {}, text: key => catalog.find(entry => entry.key === key).es,
    })))
    assert.ok(html.includes(`href="${homeSections ? '/' : ''}#como-funciona"`))
    assert.ok(html.includes(`href="${homeSections ? '/' : ''}#skill-map"`))
    assert.ok(!html.includes('href="#planes"'))
  }
  assert.match(header, /showProfessionals && <a[^>]+href="#profesionales"/)
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
  // ES-155 C: la cabecera, el enlace de salto y el <main> los pone el marco público (PublicFrame); LandingHeader se conserva como componente
  assert.ok(!page.includes('<LandingHeader') && !page.includes('<main id="contenido"'))
  assert.ok(page.includes('<PublicFrame migrated>'))
})

test('ES-62: estilos de salto, idioma activo en tinta invertida, 44 px y foco ocre', () => {
  assert.match(css, /\.landing-skip:focus \{ left: 0\.5rem/)
  assert.match(css, /\.landing-lang\[aria-pressed='true'\] \{ background: var\(--color-primary\)/)
  assert.match(css, /\.landing-lang \{ min-width: 44px/)
  assert.match(css, /\.landing-logo \{[^}]*min-height: 44px/)
  assert.match(css, /\.landing-logo-dot \{[^}]*width: 7px; height: 7px/)
  assert.match(css, /\.landing-scope :is\(button, a\):focus-visible \{ outline: 3px solid var\(--color-secondary\)/)
})

test('ES-67 H-67-05 / ES-290: los botones de idioma tienen nombre accesible en su propio idioma y que contiene el texto visible (WCAG 2.5.3)', () => {
  const visible = { 'landing.header.es': 'ES', 'landing.header.en': 'EN' }
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LandingHeader, { text: key => visible[key] ?? key, lang: 'es', setLang: () => {} })))
  assert.match(html, /<button[^>]*aria-label="ES — Español"[^>]*>ES<\/button>/)
  assert.match(html, /<button[^>]*aria-label="EN — English"[^>]*>EN<\/button>/)
  const pairs = [...html.matchAll(/<button[^>]*aria-label="([^"]*)"[^>]*landing-lang[^>]*>([^<]*)<\/button>/g)]
  assert.equal(pairs.length, 2)
  for (const [, label, content] of pairs) assert.ok(label.includes(content), `${label} contiene ${content}`)
})

test('ES-67 H-67-04: «Saltar al contenido» tiene objetivo táctil de al menos 44 px', () => {
  assert.match(css, /\.landing-scope \.landing-skip \{[^}]*min-height: 44px/)
})
