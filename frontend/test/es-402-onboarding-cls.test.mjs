// ES-402 (F45-4) + ES-403: /app/onboarding saltaba (CLS 0,14 a 320/390 px) porque el pie estaba a la vista mientras llegaba el contexto y salía de pantalla al aparecer el formulario.
// Arreglo: SOLO esa pantalla reserva una pantalla de alto (modificador .cg-onboarding--start, min-height: 100svh); «Actualizar mi hoja de vida» comparte el tema sin la reserva (ES-403).
// Medición real: scripts/es402-check.cjs, scripts/cls-ab-onboarding.cjs y scripts/es403-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const css = read('../src/context/onboardingCartografia.css').replace(/\/\*[\s\S]*?\*\//g, '')
const base = css.match(/\.participant-context-scope\.cg-onboarding \{([^}]+)\}/)[1]

test('ES-402: la pantalla de «Tu punto de partida» reserva una pantalla de alto con el modificador propio', () => {
  assert.match(css, /\.participant-context-scope\.cg-onboarding\.cg-onboarding--start \{ min-height: 100svh; \}/)
  assert.match(read('../src/context/ParticipantContextForm.tsx'), /className="participant-context-scope cg-onboarding cg-onboarding--start"/)
})

test('ES-403: la regla común del tema NO reserva altura (la comparten /app/context/resumes/update y otras): min-height: 0', () => {
  assert.match(base, /min-height: 0/); assert.doesNotMatch(base, /100svh/)
  assert.doesNotMatch(read('../src/context/resume/ResumeUpdatePage.tsx'), /cg-onboarding--start/)
  const users = ['../src/context/ParticipantContextForm.tsx', '../src/context/resume/ResumeUpdatePage.tsx']
  assert.equal(users.filter(file => read(file).includes('cg-onboarding--start')).length, 1)
})

test('ES-402: el resto de la regla no cambia (ancho de lectura, relleno, fondo transparente)', () => {
  assert.match(base, /background: transparent/); assert.match(base, /padding: 1\.4rem 0 2rem/); assert.match(css, /\.participant-context-scope\.cg-onboarding \{ max-width: 40rem; margin-inline: auto; \}/)
})
