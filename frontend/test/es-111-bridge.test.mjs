// ES-111: El Puente. Composición de lo que cruza (solo texto), topes, interruptor de ejemplos, textos ES/EN y estructura accesible.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bridgeCopy } from '../src/bridge/copy.ts'
import { fixturesEnabled, loadInsights } from '../src/bridge/insights.ts'
import { isCrossed, whyNot, withInsight, withoutField, pending, sortInsights, formatDate, MAX_FIELDS, MAX_PER_KEY } from '../src/bridge/logic.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const field = (key, text) => ({ key, text })

test('ES-111 textos: ES y EN con las mismas claves y marcadores; sin promesas de empleo ni niveles', () => {
  assert.deepEqual(Object.keys(bridgeCopy.es).sort(), Object.keys(bridgeCopy.en).sort())
  const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  for (const key of Object.keys(bridgeCopy.es)) {
    assert.ok(bridgeCopy.es[key] && bridgeCopy.en[key], key); assert.equal(placeholders(bridgeCopy.es[key]), placeholders(bridgeCopy.en[key]), key)
    for (const text of [bridgeCopy.es[key], bridgeCopy.en[key]]) assert.doesNotMatch(text, /garantiz|guarantee|empleo seguro|job offer|conseguir(á|as) trabajo|salario|salary|nivel (experto|avanzado|alto)\b|\d+ ?%/i, key)
  }
  assert.match(bridgeCopy.es.intro, /Eres el único que decide qué cruza/); assert.match(bridgeCopy.en.onlyText, /Only the insight text crosses/); assert.match(bridgeCopy.es.onlyText, /Tu diario y tus conversaciones no salen de aquí/)
})

test('ES-111 composición: autorizar añade un texto a lo ya autorizado, revocar quita solo ese, y todo sale como texto directo (sin fragmento ni identificadores)', () => {
  const active = [field('values', 'Valor A'), field('interests', 'Interés B')]
  const insight = { key: 'energy_gives', text: 'Liderazgo bajo presión', fragment: 'FRAGMENTO PRIVADO DEL DIARIO', id: 'x', date: '2024-11-15', status: 'hypothesis', example: true }
  const next = withInsight(active, insight)
  assert.deepEqual(next, [{ key: 'values', text: 'Valor A', origin: { type: 'direct' } }, { key: 'interests', text: 'Interés B', origin: { type: 'direct' } }, { key: 'energy_gives', text: 'Liderazgo bajo presión', origin: { type: 'direct' } }])
  assert.doesNotMatch(JSON.stringify(next), /FRAGMENTO|fragment|"id"|date|status|example/)
  assert.deepEqual(withoutField(next, field('values', 'Valor A')).map(f => f.text), ['Interés B', 'Liderazgo bajo presión'])
  assert.deepEqual(withoutField([field('values', 'Valor A')], field('values', 'Valor A')), []) // sin nada que cruzar se revoca la versión activa
  assert.deepEqual(withoutField(active, field('values', 'Otro')).length, 2)
  assert.throws(() => withInsight(active, { key: 'inventada', text: 'x' }))
  assert.equal(isCrossed(active, { key: 'values', text: 'Valor A' }), true); assert.equal(isCrossed(active, { key: 'values', text: 'Valor C' }), false); assert.equal(isCrossed(active, { key: 'interests', text: 'Valor A' }), false)
})

test('ES-111 topes: 12 textos en total y 3 por categoría, como el servidor; se avisa antes de pedir la vista previa', () => {
  assert.equal(MAX_FIELDS, 12); assert.equal(MAX_PER_KEY, 3)
  assert.equal(whyNot([], { key: 'values' }), null)
  assert.equal(whyNot([field('values', 'a'), field('values', 'b'), field('values', 'c')], { key: 'values' }), 'limit_key'); assert.equal(whyNot([field('values', 'a'), field('values', 'b'), field('values', 'c')], { key: 'interests' }), null)
  const full = Array.from({ length: 12 }, (_, i) => field(['values', 'interests', 'motivations', 'constraints'][i % 4], `t${i}`)); assert.equal(whyNot(full, { key: 'energy_gives' }), 'limit_total')
})

test('ES-111 insights: sin el interruptor la lista está vacía; con él hay ejemplos marcados como tales en ES y EN; nunca se mezclan con datos reales', () => {
  assert.equal(fixturesEnabled(undefined), false); assert.equal(fixturesEnabled({}), false); assert.equal(fixturesEnabled({ VITE_BRIDGE_INSIGHTS_FIXTURES: 'false' }), false); assert.equal(fixturesEnabled({ VITE_BRIDGE_INSIGHTS_FIXTURES: 'true' }), true)
  assert.deepEqual(loadInsights('es', {}), [])
  for (const lang of ['es', 'en']) {
    const rows = loadInsights(lang, { VITE_BRIDGE_INSIGHTS_FIXTURES: 'true' })
    assert.ok(rows.length >= 3); assert.ok(rows.every(row => row.example === true && row.id.startsWith('ejemplo-') && ['hypothesis', 'unassessed'].includes(row.status)))
    assert.equal(new Set(rows.map(r => r.id)).size, rows.length)
  }
  assert.notEqual(loadInsights('es', { VITE_BRIDGE_INSIGHTS_FIXTURES: 'true' })[0].text, loadInsights('en', { VITE_BRIDGE_INSIGHTS_FIXTURES: 'true' })[0].text)
  const rows = loadInsights('es', { VITE_BRIDGE_INSIGHTS_FIXTURES: 'true' })
  assert.equal(pending(rows, [field(rows[0].key, rows[0].text)]).length, rows.length - 1)
  assert.deepEqual(sortInsights(rows).map(r => r.date), [...rows.map(r => r.date)].sort().reverse())
  assert.match(formatDate('2024-11-15', 'es'), /15.*nov.*2024/i); assert.match(formatDate('2024-11-15', 'en'), /Nov.*15.*2024/)
})

test('ES-111 estructura: confirmación en la tarjeta, ojo accesible, nada cruza sin confirmar, Escape cancela, revocar uno y todos, y no se guarda nada en el navegador', () => {
  const page = read('../src/bridge/BridgePage.tsx'); const css = read('../src/bridge/bridge.css'); const nav = read('../src/space/SpaceNav.tsx'); const app = read('../src/App.tsx')
  assert.match(page, /aria-pressed=\{open\}/); assert.match(page, /aria-label=\{open \? c\.hide : c\.show\}/); assert.match(page, /aria-hidden=\{!open\}/) // el fragmento arranca difuminado y oculto
  assert.match(page, /useState<ReadonlySet<string>>\(new Set\(\)\)/) // ningún fragmento visible por defecto
  assert.match(page, /event\.key === 'Escape'/); assert.match(page, /confirmButton\.current\?\.focus\(\)/); assert.match(page, /trigger\.current\?\.focus\(\)/)
  assert.match(page, /role="group" aria-label=\{c\.confirmQ\}/); assert.match(page, /onClick=\{event => ask\(insight\.id, event\.currentTarget\)\}/) // pulsar «Autorizar» solo pregunta
  assert.match(page, /onClick=\{\(\) => void authorize\(insight\)\}/); assert.match(page, /crypto\.randomUUID\(\)/); assert.match(page, /await api\.revoke\(\)/)
  assert.match(page, /role="status" aria-live="polite"/); assert.match(page, /role="alert"/)
  assert.doesNotMatch(page, /localStorage|sessionStorage|indexedDB|document\.cookie/); assert.doesNotMatch(page, /insight\.fragment[^}]*(api|fetch|preview|confirm)/)
  assert.match(css, /bridge-blur/); assert.match(css, /dashed/); assert.doesNotMatch(css, /#0d9488|#B5503C|#4a6741/i)
  assert.match(nav, /to="\/app\/bridge"/); assert.match(app, /path="\/app\/bridge"/); assert.match(app, /path="\/app\/compass"/) // la Brújula convive
})
