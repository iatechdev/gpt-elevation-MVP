import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { parsePlans } from '../src/pricing/plans.ts'
import { landingText } from '../src/content/landingContent.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
const data = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const primitives = data(compile(read('../src/components/landing/LandingPrimitives.tsx')))
const { PlanCards } = await import(data(compile(read('../src/components/landing/PlanCards.tsx'))
  .replace("'./LandingPrimitives'", JSON.stringify(primitives))
  .replace("'react-router-dom'", JSON.stringify(import.meta.resolve('react-router-dom')))
  .replace("'../../pricing/plans'", JSON.stringify(new URL('../src/pricing/plans.ts', import.meta.url).href))))
const plans = parsePlans([{ id: 7, slug: 'synthetic', name_es: 'Plan sintético', name_en: 'Synthetic plan', description_es: 'Descripción de prueba', description_en: 'Synthetic description', features_es: ['Función de prueba'], features_en: ['Synthetic feature'], price: '0.00', currency: 'USD', period: 'month', order: 1, isHighlighted: true }])
const render = (lang, extra = {}) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(PlanCards, {
  plans, lang, text: key => landingText(key, lang), selected: 7, authenticated: false, disabled: false, pendingId: null, send() {}, ...extra,
})))

test('ES-73: actual cards use only API plan data, correct ES/EN, zero and featured without popularity claims', () => {
  for (const lang of ['es', 'en']) {
    const html = render(lang)
    for (const field of ['name', 'description', 'features']) assert.ok(html.includes(String(plans[0][`${field}_${lang}`])))
    assert.ok(html.includes(landingText('landing.pricing.free', lang)))
    assert.ok(html.includes(landingText('landing.pricing.featured', lang)))
    assert.match(html, /href="\/login\?mode=register&amp;plan=7"/)
    assert.doesNotMatch(html, /popular|POPULAR|12 USD|29 USD|59 USD/)
    assert.match(render(lang, { heading: 2 }), /<h2>/)
  }
})

test('ES-73: paid/edited API values render without redeploy, copy is escaped and pending disables actions with reason', () => {
  const edited = [{ ...plans[0], priceCents: 1725, name_en: '<img src=x>', features_en: ['<script>bad</script>'] }]
  const html = render('en', { plans: edited, authenticated: true, disabled: true, pendingId: 7 })
  assert.match(html, /17\.25 USD/); assert.match(html, /&lt;img/); assert.match(html, /&lt;script/)
  assert.doesNotMatch(html, /<img|<script|<a /)
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-describedby="landing-pricing-action-status"/)
})
