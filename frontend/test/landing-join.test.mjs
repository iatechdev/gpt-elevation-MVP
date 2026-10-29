import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  .replaceAll("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = dataUrl(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingJoin } = await import(dataUrl(compile(read('../src/components/landing/LandingJoin.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => entry.key.startsWith('landing.join.'))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(LandingJoin, {
  text: key => landingText(key, lang, values),
})))

test('ES-74: actual S13 renders four ordered steps, future sharing and the professional form link (ES-95) ES/EN', () => {
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<li>/g) ?? []).length, 4)
    assert.equal((html.match(/<h2 /g) ?? []).length, 1)
    assert.equal((html.match(/landing-label/g) ?? []).length, 2)
    assert.match(html, /href="\/login\?mode=register"/)
    assert.equal((html.match(/<a /g) ?? []).length, 2) // registro de personas y formulario de profesionales (ES-95)
    assert.match(html, /href="\/profesionales"/)
    assert.doesNotMatch(html, /Próximamente: el alta|Coming soon: professional/)
    for (const entry of entries) assert.ok(html.includes(escape(entry[lang])), entry.key)
    assert.doesNotMatch(html, /<form|<input|<script|\/therapist|door=|returnTo=|track|analytics/)
  }
})

test('ES-74: all new visible content is editable/escaped and empty/offline CMS retains ES/EN', async t => {
  for (const lang of ['es', 'en']) for (const entry of entries) {
    assert.ok(render(lang, { [entry.key]: 'Synthetic edit' }).includes('Synthetic edit'))
    for (const value of ['', ' ', null, {}]) assert.ok(render(lang, { [entry.key]: value }).includes(escape(entry[lang])))
  }
  const html = render('en', { 'landing.join.professional_body': '<img src=x onerror="alert(1)">' })
  assert.ok(html.includes('&lt;img'))
  assert.doesNotMatch(html, /<img/)
  for (const fetcher of [async () => { throw new Error('Synthetic offline') }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({}) })]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})
