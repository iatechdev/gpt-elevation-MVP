// ES-180 (HU-P29): panel y métricas sin emojis ni estrellas, cero = línea (no barra), «Sin datos» cuando falta el dato, 30 días completos del servidor,
// avisos con estado propio y sin tragarse errores.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/pages/admin')
const read = (f) => readFileSync(resolve(dir, f), 'utf8')
const files = ['AdminDashboard.tsx', 'AdminMetrics.tsx', 'adminOverview.tsx', 'adminOverviewData.ts']

test('ES-180: ninguna pantalla usa emojis ni estrellas', () => {
  for (const f of files) assert.doesNotMatch(read(f), /[☀-➿\u{1F300}-\u{1FAFF}★⭐]/u, `${f} sin emoji/estrella`)
})

test('ES-180: la gráfica usa los 30 días del servidor y el cero es una línea de 1 px', () => {
  const chart = read('adminOverview.tsx')
  assert.match(chart, /days30/)
  assert.doesNotMatch(chart, /sessionsByDay/)
  assert.match(chart, /d\.count === 0 \? 1/)
  assert.match(chart, /role="img"/)
  assert.match(chart, /aria-pressed/)
})

test('ES-180: dato ausente se muestra «Sin datos», nunca 0 ni emoji', () => {
  assert.match(read('adminOverview.tsx'), /tr\('Sin datos'\)/)
  assert.match(read('adminOverviewData.ts'), /typeof n === 'number'/)
})

test('ES-180: cada aviso tiene su estado y la carga no se traga el error', () => {
  const dash = read('AdminDashboard.tsx')
  for (const key of ['guides', 'professionalsIncomplete', 'manifest']) assert.match(dash, new RegExp(`sections\\?\\.${key}|sections.${key}`))
  assert.doesNotMatch(dash, /\.catch\(\(\) => set\w+\(false\)\)/)
  assert.match(read('adminOverviewData.ts'), /setState\('error'\)/)
  assert.match(read('adminOverview.tsx'), /role="alert"/)
})

test('ES-180: no hay versión ni fecha del manifiesto escritas a mano', () => {
  const dash = read('AdminDashboard.tsx')
  assert.doesNotMatch(dash, /v1\.0|02 abr 2026/)
})
