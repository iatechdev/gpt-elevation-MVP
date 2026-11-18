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
  assert.match(chart, /const zero = d\.count === 0/)
  assert.match(chart, /zero \? 0\.6/, 'el cero es una línea mínima (~1 px), nunca una barra')
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
  assert.match(read('adminOverview.tsx'), /<Banner kind="error"/, 'el error por aviso usa Banner (role="alert" en cartografia/pieces.tsx)')
  assert.match(read('../../cartografia/pieces.tsx'), /role=\{kind === 'error' \? 'alert' : 'note'\}/)
})

test('ES-180: no hay versión ni fecha del manifiesto escritas a mano', () => {
  const dash = read('AdminDashboard.tsx')
  assert.doesNotMatch(dash, /v1\.0|02 abr 2026/)
})

// ES-310 (QA E318-2/E318-3): el aviso de perfil incompleto lleva a la ruta real y el Panel reserva el alto de sus bloques mientras cargan (CLS).
test('ES-310: «Perfil incompleto → Ver» navega a /admin/users?role=therapist (ruta que existe) y no a /admin/usuarios', () => {
  const dash = readFileSync(new URL('../src/pages/admin/AdminDashboard.tsx', import.meta.url), 'utf8')
  assert.match(dash, /navigate\('\/admin\/users\?role=therapist'\)/)
  assert.doesNotMatch(dash, /navigate\('\/admin\/usuarios/)
  const routes = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(routes, /<Route path="users"\s+element=\{<AdminUsers \/>\}/, 'la ruta hija «users» de /admin está declarada')
})

test('ES-310: mientras cargan, cifras, avisos y profesionales reservan su alto con una copia oculta (sin saltos al llegar los datos)', () => {
  const dash = readFileSync(new URL('../src/pages/admin/AdminDashboard.tsx', import.meta.url), 'utf8')
  assert.equal((dash.match(/ao-ghost"/g) || []).length, 3, 'cifras, avisos y profesionales')
  assert.match(dash, /<SummaryCards metrics=\{null\} \/>/); assert.match(dash, /<TopProfessionals metrics=\{null\} \/>/)
  assert.equal((dash.match(/aria-hidden="true"/g) || []).length >= 3, true)
  const css = readFileSync(new URL('../src/pages/admin/adminOverview.css', import.meta.url), 'utf8')
  assert.match(css, /\.ao-ghost \{ visibility: hidden/); assert.match(css, /\.ao-chart-hold \{ min-height/)
})
