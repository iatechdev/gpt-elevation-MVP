import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = dataUrl(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingProject } = await import(dataUrl(compile(read('../src/components/landing/LandingProject.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => entry.key.startsWith('landing.project.'))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => renderToStaticMarkup(createElement(LandingProject, {
  text: key => landingText(key, lang, values),
}))

test('ES-72: actual TSX renders five semantic objectives and full project status ES/EN', () => {
  assert.equal(entries.length, 11)
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<section /g) ?? []).length, 1)
    assert.equal((html.match(/<h2 /g) ?? []).length, 1)
    assert.equal((html.match(/<h3 /g) ?? []).length, 2)
    assert.equal((html.match(/<li>/g) ?? []).length, 5)
    assert.match(html, /<ul class="landing-project-goals" role="list">/)
    for (const entry of entries) assert.ok(html.includes(escape(entry[lang])), `${lang}: ${entry.key}`)
    assert.doesNotMatch(html, /<form|<input|<button|<a |<script|<img|<meter|<progress/)
  }
})

test('ES-72: canonical copy preserves D-06 without exact cohort demographics, dates or invented results', () => {
  const body = key => entries.find(entry => entry.key === key)
  assert.equal(body('landing.project.state.body').es, 'Estamos construyendo la plataforma por etapas. Primero, un piloto cerrado con un grupo pequeño de personas en reconversión profesional, para aprender antes de ampliar. No presentamos cifras de eficacia ni de tracción porque todavía no existen.')
  assert.equal(body('landing.project.state.body').en, 'We are building the platform in stages. First, a closed pilot with a small group of people changing careers, so we learn before we scale. We do not present efficacy or traction figures because they do not exist yet.')
  for (const lang of ['es', 'en']) {
    const copy = entries.filter(entry => entry.key !== 'landing.project.number').map(entry => entry[lang]).join(' ')
    assert.doesNotMatch(copy, /\d|%|\b(seis|six|cinco|five|Colombia|España|Spain|octubre|October)\b/i)
    assert.doesNotMatch(copy, /En construcción|In development|Under construction|testimoni|garantiza|guarantee/i)
  }
})

test('ES-72: every editorial field is overridable, missing/blank values fall back, and HTML stays text', () => {
  for (const lang of ['es', 'en']) for (const entry of entries) {
    const edit = `Synthetic ${lang}: ${entry.key}`
    assert.ok(render(lang, { [entry.key]: edit }).includes(edit))
    for (const value of [undefined, '', ' ', null, 7, {}, []]) {
      assert.ok(render(lang, { [entry.key]: value }).includes(escape(entry[lang])), entry.key)
    }
  }
  const html = render('en', { 'landing.project.state.body': '<img src=x onerror="alert(1)">' })
  assert.ok(html.includes('&lt;img'))
  assert.doesNotMatch(html, /<img|<script/)
})

test('ES-72: empty/offline/malformed API never hides objectives or status', async t => {
  for (const fetcher of [
    async () => { throw new Error('Synthetic offline') },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => { throw new Error('Synthetic invalid JSON') } }),
  ]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})
