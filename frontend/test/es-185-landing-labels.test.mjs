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

// E216-9: la tarjeta de un plan inactivo no se atenúa con `opacity` (bajaba el texto a 2,1–3,4:1); se marca con el chip «Inactivo», fondo y borde discontinuo, con texto ≥ 4,5:1.
test('ES-185 E216-9: las tarjetas de planes inactivos no usan opacity y sus colores de texto cumplen 4,5:1', () => {
  const source = fs.readFileSync(new URL('../src/pages/admin/AdminContent.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /opacity:\s*p\.isActive/)
  assert.match(source, /p\.isActive \? \{\} : \{ background: '#F1EFEC', border: '1px dashed #78716C' \}/)
  const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  for (const [fg, bg] of [['#1C1917', '#F1EFEC'], ['#4A4A4A', '#F1EFEC'], ['#57534E', '#F1EFEC'], ['#5C6B4E', '#F1EFEC'], ['#B91C1C', '#F1EFEC'], ['#B91C1C', '#FEE2E2'], ['#5C6B4E', '#EAF0E6'], ['#4A4A4A', '#FFFFFF']]) assert.ok(ratio(fg, bg) >= 4.5, `${fg} sobre ${bg}`)
})
