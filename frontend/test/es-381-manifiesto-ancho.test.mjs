// ES-381: /manifiesto medía CLS hasta 0,63 (CPU×4, 1024–1360 px) por dos causas, ambas en manifesto.css: (1) el ancho de lectura en `ch` cambia al llegar Barlow (mismo fallo que /privacidad, ES-375);
// (2) mientras el texto llega, el botón «Volver» y el pie estaban a la vista y saltaban fuera de pantalla al aparecer el manifiesto. Medición y A/B: scripts/es381-check.cjs (peor caso tras el cambio 0,063).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/pages/manifesto.css', import.meta.url), 'utf8')
const css = source.replace(/\/\*[\s\S]*?\*\//g, '') // sin comentarios
const rule = css.match(/\.manifesto \{([^}]+)\}/)[1]

test('ES-381: el ancho de lectura del manifiesto no usa la unidad ch (depende de la fuente) sino 40,8 rem, igual que /privacidad', () => {
  assert.doesNotMatch(css, /\d\s?ch\b/)
  assert.match(rule, /max-width: 40\.8rem/)
})

test('ES-381: el artículo reserva una pantalla de alto para que «Volver» y el pie no salten al llegar el texto', () => {
  assert.match(rule, /min-height: 100svh/)
})

test('ES-381: no cambia el contenido ni los estilos del cuerpo (interlineado, saltos de párrafo, ajuste de palabras)', () => {
  assert.match(css, /\.manifesto__body p \{[^}]*line-height: 1\.7; white-space: pre-line; overflow-wrap: anywhere;/)
})
