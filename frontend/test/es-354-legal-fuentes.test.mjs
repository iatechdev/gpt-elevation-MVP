// ES-354: las páginas legales no cambian de tipografía a mitad de vista (CLS 0,197 en /privacidad EN a 390 px al llegar Barlow). Misma solución que «Tu progreso» (E275-1): font-display: optional + la reserva «Barlow Frame» ya existente.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/legal/legal.css', import.meta.url), 'utf8')
const shell = fs.readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')

test('ES-354: Barlow y Barlow Condensed del contenido legal se declaran con font-display: optional (mismos archivos que cartografia/fonts.css)', () => {
  const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map(m => m[1])
  assert.equal(faces.length, 3)
  for (const face of faces) { assert.match(face, /font-display: optional/); assert.match(face, /@fontsource\/barlow(-condensed)?\/files\/barlow(-condensed)?-latin-(400|600|700)-normal\.woff2/) }
  const fonts = fs.readFileSync(new URL('../src/cartografia/fonts.css', import.meta.url), 'utf8')
  for (const file of css.match(/@fontsource\/[a-z-]+\/files\/[a-z0-9-]+\.woff2/g)) assert.ok(fonts.includes(file), `${file} ya lo usa cartografia/fonts.css (no se descarga un archivo más)`)
})

test('ES-354: .lg usa esas familias con la reserva de ancho ajustado del marco y las aplica de verdad (font-family explícita)', () => {
  assert.match(css, /\.lg \{ --cg-font-cond: 'Barlow Condensed Legal', 'Barlow Condensed Frame', 'Arial Narrow', system-ui, sans-serif; --cg-font-sans: 'Barlow Legal', 'Barlow Frame', system-ui, sans-serif; font-family: var\(--cg-font-sans\); \}/)
  assert.ok(shell.includes("font-family: 'Barlow Frame'") && shell.includes("font-family: 'Barlow Condensed Frame'"), 'las reservas existen en shell.css')
  assert.doesNotMatch(css, /font-display: (swap|auto|block)/)
})
