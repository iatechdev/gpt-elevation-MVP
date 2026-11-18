// ES-328 (PR 1): /pricing en el marco público migrado de Cartografía; planes con piezas del sistema; sin estilos en línea ni colores fijos; B-T0-1 resuelto por construcción.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/PricingPage.tsx')
const plans = read('../src/components/landing/LandingPlans.tsx')
const cards = read('../src/components/landing/PlanCards.tsx')
const css = read('../src/pricing/pricing.css')

test('ES-328: /pricing usa PublicFrame migrated y ya no dibuja su propia cabecera (B-T0-1: el selector ES/EN es el LangSwitch del marco)', () => {
  assert.match(page, /<PublicFrame migrated>/)
  assert.ok(!/LandingHeader|LandingSurface|<main|<footer/.test(page), 'cabecera, <main> y pie los pone el marco')
  assert.match(page, /<LandingPlans text=\{text\} fullPage \/>/)
  assert.ok(page.includes("text('landing.pricing.notice')"), 'el aviso de límites del asistente se conserva, del CMS')
})

test('ES-328: los planes usan Card, Chip y Button de Cartografía, sin clases heredadas, estilos en línea ni colores fijos', () => {
  for (const source of [plans, cards]) {
    assert.ok(!/style=\{\{/.test(source), 'sin estilos en línea')
    assert.ok(!/\b(elv-|landing-(?!pricing-action-status|pricing-title)|grid-cols-|xl:|md:)/.test(source.replace(/id="landing-pricing-title"|landing-pricing-action-status/g, '')), 'sin clases elv-/landing-/Tailwind')
  }
  assert.match(cards, /import \{ Button, Card, Chip \} from '..\/..\/cartografia'/)
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(css), 'sin colores fijos en pricing.css: solo tokens --cg-*')
  assert.ok(!plans.includes('landing.pricing.number'), 'se retira el número decorativo «12» (decisión aprobada)')
})

test('ES-328: «Destacado» = chip + barra superior; el plan elegido lleva contorno de 4 px (no solo color); la rejilla pasa de 4 a 2 y a 1 columna', () => {
  assert.match(cards, /plan\.isHighlighted && <Chip>/)
  assert.match(css, /\.pp-plan--hl \{ border-top: 6px solid var\(--cg-mark\); \}/)
  assert.match(css, /\.pp-plan--sel \{ outline: 4px solid var\(--cg-mark\)/)
  assert.match(css, /max-width: 1100px[^}]*\{ \.pp-grid \{ grid-template-columns: repeat\(2/)
  assert.match(css, /max-width: 640px[^}]*\{ \.pp-grid \{ grid-template-columns: minmax\(0, 1fr\)/)
})

test('ES-328: el botón de solicitar dice en su nombre accesible lo mismo que muestra (label-content-name-mismatch), también en «pendiente»', () => {
  assert.match(cards, /aria-label=\{`\$\{pendingId === plan\.id \? text\('landing\.pricing\.pending'\) : text\('landing\.pricing\.request'\)\} · /)
  assert.match(cards, /aria-label=\{`\$\{text\('landing\.pricing\.register'\)\} · /)
})
