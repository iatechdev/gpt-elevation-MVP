// ES-375: /privacidad a 1280 px (CLS 0,2). El ancho de lectura no puede depender de la fuente (la unidad `ch` cambia al llegar Barlow: 630 → 653 px y todo el texto se corría 12 px), y a partir de
// 680 px la reserva de la fuente usa el size-adjust que reparte el texto en las mismas líneas que Barlow (96 %); en móvil sigue el de ES-354 (98 %).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/legal/legal.css', import.meta.url), 'utf8')

test('ES-375: el ancho de lectura de las páginas legales es fijo (rem), no `ch`', () => {
  assert.match(css, /^\.lg \{ max-width: 40\.8rem; margin: 0 auto;/m)
  assert.doesNotMatch(css, /\.lg \{[^}]*max-width: \d+ch/)
})

test('ES-375: reserva de 98 % en móvil (ES-354) y reserva ancha de 96 % desde 680 px, ambas locales y con el mismo unicode-range', () => {
  const faces = [...css.matchAll(/@font-face \{ font-family: '(Barlow Legal Fallback(?: Wide)?)'[^}]*\}/g)].map(m => m[0])
  const narrow = faces.filter(f => f.includes("'Barlow Legal Fallback'") && f.includes('font-weight: 400 500'))
  const wide = faces.filter(f => f.includes("'Barlow Legal Fallback Wide'"))
  assert.equal(narrow.length, 1); assert.match(narrow[0], /size-adjust: 98%/)
  assert.equal(wide.length, 1); assert.match(wide[0], /size-adjust: 96%/); assert.match(wide[0], /font-weight: 400 500/)
  for (const face of [...narrow, ...wide]) { assert.match(face, /src: local\('Arial'\), local\('Liberation Sans'\), local\('Helvetica'\)/); assert.doesNotMatch(face, /url\(/) }
  assert.equal(narrow[0].match(/unicode-range: [^;]+/)?.[0], wide[0].match(/unicode-range: [^;]+/)?.[0])
  assert.match(css, /@media \(min-width: 680px\) \{ \.lg \{ --cg-font-sans: 'Barlow Legal', 'Barlow Legal Fallback Wide', system-ui, sans-serif; \} \}/)
})
