// ES-307 (PR 4): El Puente en Cartografía. Sin DOM: contratos del código; el comportamiento (axe, diálogos, foco, CLS, servidor real) lo verifican scripts/es111-browser.cjs, es168-check.cjs, es247-api-integration.cjs y es307d-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isMigratedPersonPath } from '../src/shell/personLayoutState.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/bridge/BridgePage.tsx'); const panel = read('../src/bridge/SourcesPanel.tsx'); const sw = read('../src/bridge/PermissionSwitch.tsx'); const css = read('../src/bridge/bridge.css')

test('ES-307: /app/bridge está en el marco migrado y las pantallas usan PersonScreen, no SpaceShell ni clases heredadas', () => {
  assert.equal(isMigratedPersonPath('/app/bridge'), true)
  assert.match(page, /<PersonScreen title=\{c\.title\} lead=\{c\.intro\} wide>/)
  for (const source of [page, panel, sw]) assert.doesNotMatch(source, /SpaceShell|modalKeyDown|elv-|space-|className="[^"]*bridge-|role="dialog"/)
})

test('ES-307: los dos diálogos son el Dialog de Cartografía con los mismos textos; «Retirar todo» no cierra con Esc mientras guarda', () => {
  assert.match(page, /<Dialog open=\{askAll\} onClose=\{\(\) => \{ if \(!busy\) closeAll\(\) \}\} title=\{c\.revokeAllQ\}/)
  assert.match(page, /\{active\.length > 0 && <li>\{c\.withdrawAllCrossed\}<\/li>\}\{anyPerm && <li>\{c\.withdrawAllPerms\}<\/li>\}<li>\{c\.withdrawAllKeep\}<\/li>/)
  assert.match(panel, /title=\{asking \? fill\(c\.dlg_title, \{ source: c\[`src_of_\$\{asking\}` as keyof Copy\] \}\) : ''\}/)
  assert.match(panel, /<li>\{c\.dlg_resume\}<\/li>/)
  assert.match(panel, /\{saving \? c\.saving : c\.dlg_yes\}/)
  // «Cancelar» es el primer botón de ambos diálogos: allí cae el foco al abrir
  assert.match(page, /actions=\{<><Button variant="ghost" aria-disabled=\{busy\} onClick=\{closeAll\}>\{c\.cancel\}<\/Button><Button aria-disabled=\{busy\} onClick=\{\(\) => void withdrawAll\(\)\}>/)
  assert.match(panel, /actions=\{<><Button variant="ghost" disabled=\{saving !== null\} onClick=\{\(\) => \{ if \(asking\) close\(asking\) \}\}>\{c\.cancel\}<\/Button>/)
})

test('ES-307: se conservan el interruptor role="switch", el ojo con aria-pressed, la confirmación dentro de la tarjeta y los chips con palabra', () => {
  assert.match(sw, /role="switch" aria-checked=\{checked\}/); assert.match(sw, /className="br-switch"/)
  assert.match(page, /className="br-eye" aria-pressed=\{open\} aria-label=\{open \? c\.hide : c\.show\}/)
  assert.match(page, /role="group" aria-label=\{c\.confirmQ\}/)
  assert.match(page, /<Chip tone="ok" symbol="✓">\{c\.hypothesis\}<\/Chip>/) // lo autorizado
  assert.match(panel, /<Chip tone=\{doubt \? 'wait' : on \? 'ok' : 'neutral'\} symbol=\{on \? '✓' : undefined\}>\{doubt \? c\.src_unsure : on \? c\.src_on : c\.src_off\}<\/Chip>/) // «Autorizado/No autorizado»/«Sin confirmar»
})

test('ES-307: los errores y avisos llevan ⚠ (cg-banner--error) y las regiones vivas siguen existiendo en el DOM', () => {
  assert.match(page, /<p className="br-live" role="status" aria-live="polite">/)
  assert.match(page, /<p className="cg-banner cg-banner--error" role="alert"><span className="cg-banner__title">\{notice\.text\}<\/span><\/p>/)
  assert.match(panel, /<p className="br-live" role="status" aria-live="polite">\{live\}<\/p>/)
  assert.match(panel, /role=\{notice\.kind === 'error' \? 'alert' : 'status'\}/)
})

test('ES-307: bridge.css solo usa tokens --cg-* (sin colores fijos ni variables del tema anterior), mantiene reduced-motion y forced-colors, y el texto de la persona va en Spectral', () => {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(clean, /#[0-9a-fA-F]{3,8}\b|rgb\(|--color-|--space-/)
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /forced-colors/); assert.match(css, /\.br-frag \{[^}]*font-family: var\(--cg-font-name\)/)
  assert.match(css, /\.br-switch \{[^}]*min-height: var\(--cg-touch\)/)
})

test('ES-307: no hay almacenamiento del navegador en El Puente (las propuestas viven solo en la pantalla)', () => {
  assert.doesNotMatch(page + panel + sw, /localStorage|sessionStorage|indexedDB|document\.cookie|console\.(log|info|debug)/)
})
