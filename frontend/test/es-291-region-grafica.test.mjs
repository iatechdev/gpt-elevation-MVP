// ES-291: las regiones con scroll del panel de administración (tabla por día, profesionales con más personas) son regiones enfocables con nombre
// (axe scrollable-region-focusable, WCAG 2.1.1), y la gráfica de 30 días ya no usa un contenedor con scroll horizontal (la sustituyó un SVG en #318).
// El control en navegador es scripts/es290-291-audit.cjs con DATA=1 (216 páginas, 0 hallazgos en main; antes de #318 la gráfica daba 2 hallazgos a 320 px).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = fs.readFileSync(path.join(here, '../src/pages/admin/adminOverview.tsx'), 'utf8')
const css = fs.readFileSync(path.join(here, '../src/pages/admin/adminOverview.css'), 'utf8')

test('ES-291: cada contenedor con scroll de adminOverview es una región enfocable con nombre', () => {
  for (const cls of ['ao-tablewrap', 'ao-people']) {
    assert.match(css, new RegExp(`\.${cls} \{[^}]*overflow(-x)?: auto`), `${cls} desplaza`)
    const tag = src.match(new RegExp(`<div className="${cls}"[^>]*>`))?.[0] ?? ''
    assert.ok(tag, `contenedor ${cls}`)
    assert.match(tag, /tabIndex=\{0\}/); assert.match(tag, /role="region"/); assert.match(tag, /aria-label=\{tr\('[^']+'\)\}/)
  }
})
test('ES-291: la gráfica de 30 días no es un contenedor con scroll horizontal', () => {
  assert.doesNotMatch(src, /overflowX/)
  assert.match(src, /<svg[^>]*className="ao-chart"/)
})
