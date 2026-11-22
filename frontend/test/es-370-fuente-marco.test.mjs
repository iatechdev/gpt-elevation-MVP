// ES-370 (QA-424-3): las reservas tipográficas del marco igualan también la ALTURA de renglón de Barlow. Con solo size-adjust, al llegar la fuente real (swap) el título pasaba de 45 a 54 px
// y toda la página bajaba 5 px (CLS 0,21 a 1280 px con CPU×4). Barlow y Barlow Condensed miden ascent 1,0 y descent 0,2 del tamaño; los overrides se dividen entre el size-adjust de la reserva.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
const faces = [...css.matchAll(/@font-face \{ font-family: '(Barlow(?: Condensed)? Frame)'[^}]*\}/g)].map(m => m[0])

test('ES-370: las cinco reservas del marco llevan ascent/descent/line-gap que igualan a Barlow', () => {
  assert.equal(faces.length, 5)
  for (const face of faces) {
    const size = Number(/size-adjust: ([\d.]+)%/.exec(face)?.[1]); assert.ok(size > 0, face)
    const asc = Number(/ascent-override: ([\d.]+)%/.exec(face)?.[1]), desc = Number(/descent-override: ([\d.]+)%/.exec(face)?.[1])
    assert.ok(Math.abs(asc * size / 100 - 100) < 0.2, `ascent efectivo = 100 % (${face.slice(0, 70)})`)
    assert.ok(Math.abs(desc * size / 100 - 20) < 0.1, `descent efectivo = 20 % (${face.slice(0, 70)})`)
    assert.match(face, /line-gap-override: 0%/)
  }
})

test('ES-370: las reservas siguen siendo locales (sin descargas ni textos nuevos) y la pila del marco no cambia', () => {
  for (const face of faces) { assert.match(face, /src: local\('Arial'\), local\('Liberation Sans'\), local\('Helvetica'\)/); assert.doesNotMatch(face, /url\(/) }
  assert.match(css, /\.cg\.cg-frame \{ --cg-font-cond: 'Barlow Condensed', 'Barlow Condensed Frame', 'Arial Narrow', system-ui, sans-serif; --cg-font-sans: 'Barlow', 'Barlow Frame', system-ui, sans-serif; \}/)
})
