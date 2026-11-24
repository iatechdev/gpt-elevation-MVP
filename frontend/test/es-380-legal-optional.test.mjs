// ES-380: /privacidad y /terminos entre 320 y 679 px medían CLS hasta 0,16 (ES a 420 y 480 px, EN a 480 px; p. ej. a 420 px 0,152) porque Barlow llegaba tarde y el texto se repartía en líneas distintas
// que con la reserva local: el reparto cambia por ancho (a 420 px lo iguala 96 %, a 480 px 98 %, a 540 px 96 %, a 600 px 98 %), así que ningún size-adjust único lo evita. Con font-display: optional la fuente que
// no llega a tiempo NO se aplica en esa visita y no hay cambio de tipografía (CLS 0 a todos los anchos medidos). El contenido legal no cambia. La medición A/B la hace scripts/es380-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/legal/legal.css', import.meta.url), 'utf8')
const faces = [...css.matchAll(/@font-face \{([^}]+)\}/g)].map(m => m[1])

test('ES-380: las tres Barlow reales de las páginas legales usan font-display: optional y ninguna usa swap, auto ni block', () => {
  const real = faces.filter(f => /@fontsource/.test(f))
  assert.equal(real.length, 3)
  for (const face of real) assert.match(face, /font-display: optional/)
  assert.doesNotMatch(css, /font-display: (swap|auto|block)/)
})

test('ES-380: se conservan las reservas locales (Arial/Liberation/Helvetica) con su size-adjust: son lo que se ve mientras la fuente no se aplica', () => {
  assert.ok(faces.filter(f => /local\('Arial'\)/.test(f)).length >= 4)
  for (const family of ['Barlow Legal Fallback', 'Barlow Legal Fallback Wide', 'Barlow Condensed Legal Fallback']) assert.ok(faces.some(f => f.includes(`'${family}'`)), family)
  assert.match(css, /max-width: 40\.8rem/) // ES-375 intacto: el ancho de lectura no depende de la fuente
})

test('ES-380: no se añadió ningún archivo de fuente ni texto: las páginas legales siguen sin copy nuevo', () => {
  const files = css.match(/@fontsource\/[a-z-]+\/files\/[a-z0-9-]+\.woff2/g) ?? []
  const fonts = fs.readFileSync(new URL('../src/cartografia/fonts.css', import.meta.url), 'utf8')
  for (const file of files) assert.ok(fonts.includes(file), file)
  assert.doesNotMatch(css, /content:\s*['"]/)
})
