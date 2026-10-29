import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { landingText, loadLandingContent } from '../src/content/landingContent.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: {
  jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = dataUrl(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingClosing, LandingFooter } = await import(dataUrl(compile(read('../src/components/landing/LandingClosing.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))
  .replace("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => /^landing\.(closing|footer)\./.test(entry.key))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => {
  const props = { text: key => landingText(key, lang, values) }
  return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Fragment, null,
    createElement(LandingClosing, props), createElement(LandingFooter, props))))
}

test('ES-65: actual ES/EN closing has explicit signup, full notice and non-interactive D-08 markers', () => {
  assert.equal(entries.length, 10)
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<a /g) ?? []).length, 1)
    assert.match(html, /href="\/login\?mode=register"/)
    assert.match(html, /<footer class="elv-footer landing-footer">/)
    assert.equal((html.match(/<li>/g) ?? []).length, 3)
    assert.doesNotMatch(html, /href="#"|href="\/privacy|mailto:|tel:|<button|onclick|I am a professional|Soy profesional/)
    for (const entry of entries) assert.ok(html.includes(escape(entry[lang].replaceAll('{year}', String(new Date().getFullYear())))), `${lang}:${entry.key}`)
  }
})

test('ES-65: CMS edits affect all copy, are escaped and cannot change destinations; empty/offline stays bilingual', async t => {
  for (const lang of ['es', 'en']) for (const entry of entries) {
    const html = render(lang, { [entry.key]: '<img src=x onerror="alert(1)">' })
    assert.ok(html.includes('&lt;img'))
    assert.doesNotMatch(html, /<img|<script/)
    assert.match(html, /href="\/login\?mode=register"/)
    for (const value of ['', ' ', null, 7, {}, []]) assert.equal(render(lang, { [entry.key]: value }), render(lang))
  }
  for (const fetcher of [async () => { throw new Error('Synthetic offline') }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({}) })]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})
