// ES-342 (PARTE A): defectos visibles del chat (QA-Claude-2, ES-333). Pruebas estructurales; la verificación en navegador es scripts/es342-chat-defectos.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = rel => fs.readFileSync(path.join(here, rel), 'utf8')
const css = read('../src/space/space.css')
const bar = read('../src/space/ChatBar.tsx')
const block = css.slice(css.indexOf('ES-342 (PARTE A'))

test('ES-342 A2: el texto de los globos parte palabras y URLs largas (overflow-wrap:anywhere)', () => {
  assert.ok(block.length > 0, 'bloque ES-342 en space.css')
  assert.match(block, /\.chat-msg-body, \.chat-msg-text, \.chat-msg-wait \{[^}]*overflow-wrap: anywhere/)
  assert.match(block, /\.chat-msg \{ min-width: 0; \}/)
})

test('ES-342 A1: el aviso de pausa y el de límite se traen a la vista al aparecer', () => {
  assert.match(bar, /useEffect\(\(\) => \{ if \(paused\) pausedNote\.current\?\.scrollIntoView\(\{ block: 'nearest' \}\) \}, \[paused\]\)/)
  assert.match(bar, /useEffect\(\(\) => \{ if \(exhausted\) exhaustedNote\.current\?\.scrollIntoView\(\{ block: 'nearest' \}\) \}, \[exhausted\]\)/)
  assert.match(bar, /<p ref=\{pausedNote\} className="space-scope space-callout" role="status">\{c\.paused\}<\/p>/)
  assert.match(bar, /<p ref=\{exhaustedNote\} className="space-scope space-callout" role="status">/)
  assert.match(block, /\.chat-transcript \.space-callout \{ scroll-margin-block-end: 12px; \}/)
})

test('ES-342 A3: «Enviar» deshabilitado usa tokens --cg-* (sin terracota de acción, sin opacidad)', () => {
  const rule = block.match(/\.chat-shell \.chat-composer \.elv-btn-primary:disabled \{([^}]*)\}/)?.[1] ?? ''
  assert.ok(rule, 'regla del botón deshabilitado')
  assert.match(rule, /opacity: 1/)
  assert.match(rule, /background: var\(--cg-panel\)/)
  assert.match(rule, /color: var\(--cg-muted\)/)
  assert.match(rule, /border-color: var\(--cg-muted\)/)
  assert.doesNotMatch(rule, /#[0-9a-fA-F]{3,8}\b|rgb\(/)
})

test('ES-342 A4: a ≥901 px y ≤800 px de alto «Diario» comparte fila con la caja (el hilo gana ~50 px)', () => {
  const media = block.match(/@media \(min-width: 901px\) and \(max-height: 800px\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.ok(media, 'media query de A4')
  assert.match(media, /\.chat-composer \{ grid-template-columns: auto minmax\(0, 1fr\)/)
  assert.match(media, /\.chat-composer \.chat-composer-top \{ grid-column: 1; grid-row: 2/)
  assert.match(media, /\.chat-composer \.chat-composer-row \{ grid-column: 2; grid-row: 2/)
  assert.match(media, /\.chat-composer \.chat-counter \{ grid-column: 1 \/ -1; grid-row: 1/)
})
