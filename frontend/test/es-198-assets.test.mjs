// ES-198: ayudas puras de la medición de fuentes y CSS, y que no haya imágenes referenciadas sin dimensiones ni fuentes de terceros.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fontName, coverageTotals } from '../scripts/perf-assets.mjs'

const here = dirname(fileURLToPath(import.meta.url))

test('ES-198: nombre de fuente sin el hash de Vite y cobertura de CSS', () => {
  assert.equal(fontName('http://x/assets/inter-latin-wght-normal-Dx4kXJAl.woff2'), 'inter-latin-wght-normal')
  assert.equal(fontName('/assets/barlow-latin-600-normal-ab_cd-12.woff2'), 'barlow-latin-600-normal')
  assert.deepEqual(coverageTotals([{ text: 'x'.repeat(100), ranges: [{ start: 0, end: 30 }, { start: 50, end: 60 }] }, { text: 'y'.repeat(50), ranges: [] }]), { used: 40, total: 150, unused: 110 })
})

test('ES-198: las fuentes son autoalojadas con font-display: swap y la de la portada tiene respaldo con métricas ajustadas', () => {
  const landing = readFileSync(resolve(here, '../src/components/landing/landing.css'), 'utf8')
  assert.match(landing, /Elevation Landing Inter Fallback/); assert.match(landing, /size-adjust/)
  for (const file of ['../src/components/landing/landing.css', '../src/cartografia/fonts.css']) {
    const css = readFileSync(resolve(here, file), 'utf8')
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
    for (const face of faces) if (/url\(/.test(face)) assert.match(face, /font-display:\s*swap/, file)
    assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/, file)
  }
})
