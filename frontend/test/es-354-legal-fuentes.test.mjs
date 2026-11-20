// ES-354: las páginas legales no cambian de tipografía con reflujo (CLS 0,197 en /privacidad EN a 390 px al llegar Barlow). Barlow REAL con font-display: swap (los títulos SÍ usan Barlow Condensed) y una reserva local con
// el ancho medido contra este texto (scripts/legal-fallback-sweep.cjs; CLS con scripts/legal-cls.cjs), con unicode-range latino como el marco (E331-1).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/legal/legal.css', import.meta.url), 'utf8')
const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map(m => m[1])

test('ES-354: Barlow y Barlow Condensed del contenido legal usan font-display: swap con los mismos archivos que cartografia/fonts.css', () => {
  const real = faces.filter(f => /@fontsource/.test(f))
  assert.equal(real.length, 3)
  for (const face of real) { assert.match(face, /font-display: swap/); assert.match(face, /@fontsource\/barlow(-condensed)?\/files\/barlow(-condensed)?-latin-(400|600|700)-normal\.woff2/); assert.match(face, /unicode-range: U\+0000-00FF/) }
  const fonts = fs.readFileSync(new URL('../src/cartografia/fonts.css', import.meta.url), 'utf8')
  for (const file of css.match(/@fontsource\/[a-z-]+\/files\/[a-z0-9-]+\.woff2/g)) assert.ok(fonts.includes(file), `${file} ya lo usa cartografia/fonts.css (no se descarga un archivo más)`)
  assert.doesNotMatch(css, /font-display: (optional|auto|block)/)
})

test('ES-354: las reservas locales llevan el size-adjust medido (98 % / 96 % / 80 %) y .lg las usa tras la fuente real', () => {
  const fallbacks = faces.filter(f => /local\('Arial'\)/.test(f))
  assert.equal(fallbacks.length, 3)
  assert.match(fallbacks[0], /'Barlow Legal Fallback'[^}]*font-weight: 400 500; size-adjust: 98%/)
  assert.match(fallbacks[1], /'Barlow Legal Fallback'[^}]*font-weight: 600 700; size-adjust: 96%/)
  assert.match(fallbacks[2], /'Barlow Condensed Legal Fallback'[^}]*font-weight: 700; size-adjust: 80%/)
  assert.match(css, /\.lg \{ --cg-font-cond: 'Barlow Condensed Legal', 'Barlow Condensed Legal Fallback', 'Arial Narrow', system-ui, sans-serif; --cg-font-sans: 'Barlow Legal', 'Barlow Legal Fallback', system-ui, sans-serif; font-family: var\(--cg-font-sans\); \}/)
})
