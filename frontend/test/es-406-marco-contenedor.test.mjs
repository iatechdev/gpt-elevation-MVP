// ES-406: un solo contenedor --cg-wrap para cabecera, cuerpo y pie (la barra lateral va DENTRO) y barra alcanzable en ventanas bajas. El navegador lo mide scripts/es406-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const shell = fs.readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
const progress = fs.readFileSync(new URL('../src/progress/progress.css', import.meta.url), 'utf8')
const rule = selector => new RegExp('^' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{[^\\n]*\\}', 'm').exec(shell)?.[0] ?? ''

test('ES-406: --cg-wrap vale 1240px y cabecera, cuerpo y pie lo usan (ningún 1240px suelto)', () => {
  assert.match(shell, /\.cg-frame \{ --cg-wrap: 1240px;/)
  for (const sel of ['.cg-header', '.cg-body', '.cg-footer']) assert.ok(rule(sel).includes('max-width: var(--cg-wrap)'), sel)
  assert.equal((shell.match(/1240px/g) ?? []).length, 1)
})

test('ES-406: la barra lateral ya no se SUMA al contenedor y tiene altura máxima con desplazamiento propio', () => {
  assert.doesNotMatch(shell, /calc\(1240px \+ 15rem\)|calc\(var\(--cg-wrap\) \+/)
  assert.match(shell, /\.cg-body--wideside > \.cg-side--groups \{ max-height: calc\(100dvh - 2rem\); overflow-y: auto; \}/)
})

test('ES-406: sin scrollbar-gutter por pantalla en progress.css', () => {
  assert.doesNotMatch(progress, /scrollbar-gutter/)
})
