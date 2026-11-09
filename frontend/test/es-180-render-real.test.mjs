// ES-180 (E180-1): la gráfica y las cifras se pintan con la respuesta REAL de /api/admin/metrics (fixtures generados por la prueba con Postgres real
// del backend, que además falla si la forma cambia). `max30` es { date, count } o null; nunca un número. Se empaqueta el componente de verdad y se
// renderiza en el servidor (sin navegador).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'rolldown'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const out = resolve(here, '.tmp-es180')
const fixture = (n) => JSON.parse(readFileSync(resolve(here, 'fixtures', n), 'utf8'))
let mod

before(async () => {
  mkdirSync(out, { recursive: true })
  await build({ input: resolve(root, 'src/pages/admin/adminOverview.tsx'), platform: 'node', external: [/^react/], output: { format: 'esm', file: resolve(out, 'bundle.mjs') }, logLevel: 'warn', transform: { define: { 'import.meta.env': '({"VITE_BACKEND_URL":"","DEV":false})' } } })
  mod = await import(pathToFileURL(resolve(out, 'bundle.mjs')).href)
})
after(() => rmSync(out, { recursive: true, force: true }))

test('ES-180: con la respuesta real, el máximo sale del objeto { date, count } (sin «[object Object]») y hay barras', () => {
  const m = fixture('es-180-metrics-full.json')
  assert.equal(typeof m.max30, 'object')
  const html = renderToStaticMarkup(createElement(mod.ActivityChart, { metrics: m, showSummary: true }))
  assert.doesNotMatch(html, /\[object Object\]|NaN|undefined/)
  assert.match(html, new RegExp(`máximo ${m.max30.count.toLocaleString('es-CO')} el `))
  assert.match(html, /height:100%/, 'el día de mayor valor llega al 100 %')
  assert.equal((html.match(/height:1px/g) ?? []).length, m.days30.filter((d) => d.count === 0).length, 'cada día en cero es una línea de 1 px')
  assert.ok(html.includes(m.max30.count.toLocaleString('es-CO')), 'la cifra «máximo en un día» se muestra')
})

test('ES-180: sin registros (max30 = null) dice «Sin registros» y no pinta barras', () => {
  const m = fixture('es-180-metrics-empty.json')
  assert.equal(m.max30, null)
  const html = renderToStaticMarkup(createElement(mod.ActivityChart, { metrics: m, showSummary: true }))
  assert.match(html, /Sin registros entre/)
  assert.doesNotMatch(html, /\[object Object\]|NaN|undefined/)
  assert.doesNotMatch(html, /height:\d+(\.\d+)?%/)
})

test('ES-180: las cifras con la respuesta real salen con palabra y «Sin datos» cuando es null', () => {
  const html = renderToStaticMarkup(createElement(mod.SummaryCards, { metrics: fixture('es-180-metrics-empty.json') }))
  assert.match(html, /Sin datos/)
  assert.doesNotMatch(html, /\[object Object\]|NaN|undefined/)
  const full = renderToStaticMarkup(createElement(mod.SummaryCards, { metrics: fixture('es-180-metrics-full.json') }))
  assert.match(full, /\d,\d de 5/)
})
