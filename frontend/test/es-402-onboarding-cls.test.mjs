// ES-402 (F45-4): /app/onboarding saltaba (CLS 0,14 a 320/390 px) porque el pie estaba a la vista mientras llegaba el contexto y salía de pantalla al aparecer el formulario.
// Arreglo: la pantalla reserva una pantalla de alto (min-height: 100svh), sin tocar textos, layout ni flujo. Medición real: scripts/es402-check.cjs y scripts/cls-ab-onboarding.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/context/onboardingCartografia.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = css.match(/\.participant-context-scope\.cg-onboarding \{([^}]+)\}/)[1]

test('ES-402: la pantalla de «Tu punto de partida» reserva una pantalla de alto (el pie no salta al llegar el formulario)', () => {
  assert.match(rule, /min-height: 100svh/)
  assert.doesNotMatch(rule, /min-height: 0/)
})

test('ES-402: el resto de la regla no cambia (ancho de lectura, relleno, fuente, fondo transparente)', () => {
  assert.match(rule, /background: transparent/); assert.match(rule, /padding: 1\.4rem 0 2rem/); assert.match(css, /\.participant-context-scope\.cg-onboarding \{ max-width: 40rem; margin-inline: auto; \}/)
})
