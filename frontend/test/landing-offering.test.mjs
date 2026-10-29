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
  .replaceAll("'react'", JSON.stringify(import.meta.resolve('react')))
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = dataUrl(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { LandingFeatures, LandingSkillMap } = await import(dataUrl(compile(read('../src/components/landing/LandingOffering.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))))
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const entries = catalog.filter(entry => /^landing\.(features|skillmap)\./.test(entry.key))
const escape = value => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
const render = (lang, values) => [LandingFeatures, LandingSkillMap].map(component => renderToStaticMarkup(createElement(component, {
  text: key => landingText(key, lang, values),
}))).join('')

test('ES-70: real TSX renders six features, four evidence states, four autonomy levels and three routes ES/EN', () => {
  assert.equal(new Set(catalog.map(entry => entry.key)).size, catalog.length)
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    assert.equal((html.match(/<section /g) ?? []).length, 2)
    assert.equal((html.match(/<h2 /g) ?? []).length, 2)
    assert.equal((html.match(/<h4>/g) ?? []).length, 3)
    assert.equal((html.match(/<li>/g) ?? []).length, 8)
    assert.equal((html.match(/landing-offer-status/g) ?? []).length, 10)
    assert.match(html, /id="skill-map" tabindex="-1"/)
    for (const entry of entries) {
      assert.ok(entry[lang].trim(), entry.key)
      assert.ok(html.includes(escape(entry[lang])), `missing ${lang}: ${entry.key}`)
    }
    assert.doesNotMatch(html, /<form|<input|<button|<a |<svg|<canvas|A tu ritmo\. Bajo tu control|At your pace\. Under your control/)
  }
})

test('ES-70: all feature/route availability labels start conservatively and are editable per language', () => {
  const statuses = entries.filter(entry => entry.key.endsWith('.status'))
  assert.equal(statuses.length, 10)
  for (const entry of statuses) {
    assert.equal(entry.es, 'Próximamente')
    assert.equal(entry.en, 'Coming soon')
    for (const [lang, value] of [['es', 'En piloto'], ['en', 'Available']]) {
      assert.ok(render(lang, { [entry.key]: value }).includes(value))
    }
  }
})

test('ES-70: CMS overrides all new fields, blank/wrong values keep ES/EN defaults, HTML is escaped', () => {
  for (const lang of ['es', 'en']) for (const entry of entries) {
    const edit = `Synthetic ${lang} ${entry.key}`
    assert.ok(render(lang, { [entry.key]: edit }).includes(edit))
    for (const value of ['', ' ', null, 7, {}]) {
      assert.ok(render(lang, { [entry.key]: value }).includes(escape(entry[lang])), `${lang}: ${entry.key}`)
    }
  }
  const malicious = render('en', { 'landing.features.journal.body': '<img src=x onerror="alert(1)">' })
  assert.ok(malicious.includes('&lt;img'))
  assert.doesNotMatch(malicious, /<img|<script/)
})

test('ES-70: no-evidence, non-certification, non-prediction and future consent bridge remain explicit', () => {
  const es = render('es')
  const en = render('en')
  assert.match(es, /Sin evidencia se muestra vacío, nunca un déficit inventado/)
  assert.match(en, /With no evidence it stays empty, never an invented deficit/)
  assert.match(es, /no una certificación/)
  assert.match(en, /not a certification/)
  assert.match(es, /No predecimos qué profesión desaparecerá/)
  assert.match(en, /We do not predict which profession will disappear/)
  assert.match(es, /revisadas y autorizadas por la persona/)
  assert.match(es, /aún no está disponible/)
  assert.match(en, /reviewed and authorised by the participant/)
  assert.match(en, /not yet available/)
  assert.doesNotMatch(es + en, /\d\s*%|https?:\/\/|mailto:|<progress|<meter/)
})

test('ES-70: failed, malformed and empty API responses never erase public descriptions', async t => {
  for (const fetcher of [
    async () => { throw new Error('Synthetic offline') },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({}) }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => { throw new Error('Synthetic bad JSON') } }),
  ]) {
    t.mock.method(globalThis, 'fetch', fetcher)
    for (const lang of ['es', 'en']) assert.equal(render(lang, await loadLandingContent(lang)), render(lang))
    t.mock.restoreAll()
  }
})
