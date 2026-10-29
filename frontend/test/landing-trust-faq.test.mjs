import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'
import { trustFaqEnabled } from '../src/content/landingTrustFaq.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = url(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingTrust, LandingFaq } = await import(url(compile(read('../src/components/landing/LandingTrustFaq.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives)).replace("import './trust-faq.css';", '')
  .replace("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))
  .replace("'react'", JSON.stringify(import.meta.resolve('react')))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => /^landing\.(trust|faq)\./.test(entry.key))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => renderToStaticMarkup(createElement(MemoryRouter, null,
  createElement(LandingTrust, { text: key => landingText(key, lang, values) }),
  createElement(LandingFaq, { text: key => landingText(key, lang, values) })))

test('ES-69: review switch accepts only literal true string; real sections contain five points and ten closed panels', () => {
  for (const value of [undefined, null, '', false, true, 'false', 'TRUE', '1', 1]) assert.equal(trustFaqEnabled(value), false)
  assert.equal(trustFaqEnabled('true'), true)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<section /g) ?? []).length, 2)
    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 10)
    assert.equal((html.match(/ hidden=""/g) ?? []).length, 10)
    for (let i = 1; i <= 10; i++) {
      assert.ok(html.includes(`aria-controls="landing-faq-answer-${i}"`))
      assert.ok(html.includes(`aria-labelledby="landing-faq-question-${i}"`))
    }
    assert.ok(html.includes('href="/pricing"'))
    assert.doesNotMatch(html, /href="\/privacy"|<form|<input|<script|<img/)
    for (const entry of entries) assert.ok(html.includes(escape(entry[lang])), entry.key)
  }
})

test('ES-69: all forty editorial keys are bilingual/editable and malformed or offline CMS preserves defaults', async t => {
  assert.equal(entries.length, 40)
  assert.equal(new Set(catalog.map(x => x.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const edits = Object.fromEntries(entries.map(x => [x.key, `Synthetic ${lang} ${x.key}`]))
    for (const edit of Object.values(edits)) assert.ok(render(lang, edits).includes(edit))
    for (const invalid of [undefined, '', ' ', null, 7, {}, []]) {
      assert.equal(render(lang, Object.fromEntries(entries.map(x => [x.key, invalid]))), render(lang))
    }
    assert.ok(render(lang, { 'landing.faq.a9': '<img src=x onerror="alert(1)">' }).includes('&lt;img'))
    assert.doesNotMatch(render(lang, { 'landing.trust.2.body': '<script>bad()</script>' }), /<script/)
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

test('ES-69: pending rights/policy, no price or free promise, native keyboard buttons and correct section order', () => {
  const html = render('es') + render('en')
  assert.doesNotMatch(html, /\bGratis\b|\bFree\b|USD|\$|tel:|https?:|href="\/app|href="\/api/)
  assert.ok(html.includes('Próximamente') && html.includes('Coming soon'))
  assert.ok(html.includes('Pendiente de revisión') && html.includes('Pending review'))
  const page = read('../src/pages/LandingPage.tsx')
  assert.ok(page.indexOf('<LandingJourney') < page.indexOf('<LandingTrust'))
  assert.ok(page.indexOf('<LandingTrust') < page.indexOf('<LandingFeatures'))
  assert.ok(page.indexOf('<LandingJoin') < page.indexOf('<LandingFaq'))
  assert.equal((page.match(/trustFaqEnabled\(import.meta.env.VITE_ENABLE_LANDING_TRUST_FAQ\)/g) ?? []).length, 2)
  assert.match(read('../src/components/landing/LandingPrimitives.tsx'), /type=\{type\}/)
})
