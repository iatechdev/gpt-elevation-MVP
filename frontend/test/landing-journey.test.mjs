import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'

// Compile the actual TSX for server rendering; no component doubles or extra dependencies.
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = dataUrl(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingJourney } = await import(dataUrl(compile(read('../src/components/landing/LandingJourney.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => /^landing\.(problem|modules|journey)\./.test(entry.key))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => renderToStaticMarkup(createElement(LandingJourney, {
  text: key => landingText(key, lang, values),
}))

test('ES-68: actual ES/EN render exposes three named sections and six ordered steps', () => {
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<section /g) ?? []).length, 3)
    assert.equal((html.match(/<h2 /g) ?? []).length, 3)
    assert.equal((html.match(/<h3[ >]/g) ?? []).length, 8)
    assert.equal((html.match(/<li>/g) ?? []).length, 6)
    assert.match(html, /<ol class="landing-journey-list" role="list">/)
    assert.match(html, /id="como-funciona" tabindex="-1"/)
    for (const entry of entries) {
      assert.ok(entry[lang].trim(), entry.key)
      assert.ok(html.includes(escape(entry[lang])), `missing ${lang}: ${entry.key}`)
    }
    assert.equal((html.match(/landing-module-status/g) ?? []).length, 1) // solo Skill Map lleva etiqueta de estado (ES-133: Disponible)
    assert.doesNotMatch(html, /<form|<input|<button|<a |TCC|DBT|24\/7|AES-256/)
  }
})

test('ES-68: partial CMS overrides reach every new field; missing/blank/wrong types keep language defaults', () => {
  for (const lang of ['es', 'en']) for (const entry of entries) {
    const edit = `Synthetic ${lang} ${entry.key}`
    assert.ok(render(lang, { [entry.key]: edit }).includes(edit))
    for (const value of ['', '  ', null, 7, {}, []]) {
      assert.ok(render(lang, { [entry.key]: value }).includes(escape(entry[lang])), `${lang}: ${entry.key}`)
    }
  }
})

test('ES-68: CMS text is escaped by React instead of creating executable HTML', () => {
  for (const lang of ['es', 'en']) {
    const html = render(lang, { 'landing.modules.connection': '<img src=x onerror="alert(1)">' })
    assert.ok(html.includes('&lt;img'))
    assert.doesNotMatch(html, /<img|<script/)
  }
})

test('ES-68: failed/empty CMS still renders the complete journey in either language', async t => {
  for (const fetcher of [
    async () => { throw new Error('Synthetic offline') },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => { throw new Error('Synthetic malformed JSON') } }),
  ]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})
