// ES-284: el enlace de la marca del marco del profesional lleva un nombre accesible que contiene el texto visible («Elevation. Profesional»), WCAG 2.5.3.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')

test('ES-284: Frame acepta brandLabel y lo usa en el aria-label del enlace de la marca (por defecto, el de siempre)', () => {
  const frame = read('../src/shell/Frame.tsx')
  assert.match(frame, /brandLabel\?: string/)
  assert.match(frame, /aria-label=\{brandLabel \?\? c\.brandLabel\}/)
})

test('ES-284: el marco del profesional pasa un nombre que incluye el texto visible, en ES y EN', () => {
  const frames = read('../src/shell/frames.tsx')
  assert.match(frames, /brandLabel=\{`\$\{c\.brandLabel\}\. \$\{PROFESSIONAL_LABEL\[lang\]\}`\}/)
  const copy = read('../src/shell/copy.ts')
  assert.match(copy, /PROFESSIONAL_LABEL = \{ es: 'Profesional', en: 'Professional' \}/)
  // los demás marcos no cambian de nombre accesible
  assert.equal((frames.match(/brandLabel=/g) ?? []).length, 1)
})
