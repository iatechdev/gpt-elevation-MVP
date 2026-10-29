import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'
import { professionalsEnabled } from '../src/content/landingProfessionals.ts'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  .replaceAll("'react'", JSON.stringify(import.meta.resolve('react')))
  .replaceAll("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))
const url = s => 'data:text/javascript;base64,' + Buffer.from(s).toString('base64')
const primitives = url(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingProfessionals } = await import(url(compile(read('../src/components/landing/LandingProfessionals.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives)).replace("import './professionals.css';", '')))
const { LandingHeader } = await import(url(compile(read('../src/components/landing/LandingHeader.tsx'))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(x => x.key.startsWith('landing.pros.'))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values, applicationAvailable = true) => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(LandingProfessionals, { text: key => landingText(key, lang, values), applicationAvailable })))
const header = (showProfessionals, lang = 'es') => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(LandingHeader, { text: key => landingText(key, lang), lang, setLang() {}, showProfessionals })))

test('ES-71: publication only accepts literal true and the real header omits the anchor unless its section is mounted', () => {
  for (const value of [undefined, null, true, false, '', 'false', 'TRUE', '1', 1, {}]) assert.equal(professionalsEnabled(value), false)
  assert.equal(professionalsEnabled('true'), true)
  assert.doesNotMatch(header(false), /href="#profesionales"/)
  for (const lang of ['es', 'en']) {
    assert.match(header(true, lang), /href="#profesionales"/)
    assert.ok(header(true, lang).includes(landingText('landing.nav.pros', lang)))
  }
})

test('ES-71: actual bilingual component has six features, private boundaries and existing application destination without a form', () => {
  assert.equal(entries.length, 31)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/landing-pros-card/g) ?? []).length, 6)
    assert.equal((html.match(/<h3>/g) ?? []).length, 9)
    for (const entry of entries) assert.ok(html.includes(escape(entry[lang])), entry.key)
    assert.match(html, /href="\/profesionales"/)
    assert.match(html, /aria-describedby="landing-pros-cta-note"/)
    assert.doesNotMatch(html, /<form|<input|<button|<script|<img|href="\/therapist|href="\/app/)
    assert.doesNotMatch(render(lang, null, false), /<a /)
  }
})

test('ES-71: editorial overrides are escaped and wrong values, missing languages and CMS failures retain full defaults', async t => {
  assert.equal(new Set(catalog.map(x => x.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const edits = Object.fromEntries(entries.map(x => [x.key, 'Synthetic ' + lang + ' ' + x.key]))
    for (const value of Object.values(edits)) assert.ok(render(lang, edits).includes(value))
    for (const invalid of [undefined, '', ' ', null, 3, {}, []]) {
      assert.equal(render(lang, Object.fromEntries(entries.map(x => [x.key, invalid]))), render(lang))
    }
    assert.match(render(lang, { 'landing.pros.intro': '<img src=x onerror="alert(1)">' }), /&lt;img/)
  }
  for (const fetcher of [
    async () => { throw new Error('Synthetic offline') },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON') } }),
  ]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})

test('ES-71: approved privacy copy excludes notes from AI and makes pending availability and no automatic access explicit', () => {
  for (const lang of ['es', 'en']) {
    assert.match(landingText('landing.pros.3.body', lang), /No utilizan tus notas|They do not use your notes/)
    assert.match(landingText('landing.pros.cta_note', lang), /no crea una cuenta|does not create an account/)
    assert.match(landingText('landing.pros.bridge.body', lang), /aún no está disponible|not yet available/)
  }
  const page = read('../src/pages/LandingPage.tsx')
  assert.ok(page.indexOf('<LandingFeatures') < page.indexOf('<LandingProfessionals'))
  assert.ok(page.indexOf('<LandingProfessionals') < page.indexOf('<LandingSkillMap'))
  assert.match(page, /showProfessionals && <LandingProfessionals/)
  assert.match(page, /applicationAvailable=\{routes.has\('\/profesionales'\)\}/)
})
