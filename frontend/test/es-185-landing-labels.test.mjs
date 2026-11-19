import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { landingFieldLabel } from '../src/pages/admin/landingLabels.ts'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))

test('ES-185: every catalog key has a distinct readable label in both interface languages', () => {
  for (const lang of ['es', 'en']) {
    const labels = catalog.map(({ key }) => landingFieldLabel(key, lang))
    assert.equal(new Set(labels).size, labels.length)
    for (const label of labels) assert.doesNotMatch(label, /landing\.|_/)
  }
  assert.equal(landingFieldLabel('landing.nav.skip', 'es'), 'Navegación · Saltar al contenido')
  assert.equal(landingFieldLabel('landing.faq.q1', 'en'), 'Frequently asked questions · Question 1')
  assert.throws(() => landingFieldLabel('landing.unknown_field', 'es'), /Missing landing field label/)
})

// E216-9: la tarjeta de un plan inactivo no se atenúa con `opacity` (bajaba el texto a 2,1–3,4:1); se marca con el chip «Inactivo», borde discontinuo y texto con tokens de Cartografía ≥ 4,5:1.
// ES-315: los colores ya no están escritos en el archivo; se comprueban los tokens reales (claro y oscuro) con los que se pinta la tarjeta inactiva.
test('ES-185 E216-9: las tarjetas de planes inactivos no usan opacity y sus colores de texto cumplen 4,5:1 (tokens claros y oscuros)', () => {
  const source = fs.readFileSync(new URL('../src/pages/admin/AdminContent.tsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/pages/admin/adminContent.css', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /opacity/); assert.doesNotMatch(css, /opacity/)
  assert.match(source, /p\.isActive \? '' : ' ac-plan--off'/)
  assert.match(css, /\.ac-plan--off \{ border-left: 4px dashed var\(--cg-muted\)/)
  assert.doesNotMatch(source, /style=\{\{|#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'sin estilos en línea ni colores propios (Planes y Textos públicos)')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  const tokens = fs.readFileSync(new URL('../src/cartografia/cartografia.css', import.meta.url), 'utf8')
  const read = (block, name) => block.match(new RegExp('--cg-' + name + ': (#[0-9a-f]{6})'))[1]
  const darkAt = tokens.indexOf('@media (prefers-color-scheme: dark)')
  const light = tokens.slice(tokens.indexOf('.cg {'), darkAt)
  const dark = tokens.slice(darkAt, darkAt + 700)
  const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  for (const [theme, block] of [['claro', light], ['oscuro', dark]]) {
    for (const [fg, bg] of [['ink', 'panel'], ['muted', 'panel'], ['err', 'panel'], ['ink', 'ground'], ['muted', 'ground']]) assert.ok(ratio(read(block, fg), read(block, bg)) >= 4.5, `${theme}: ${fg} sobre ${bg}`)
  }
})
