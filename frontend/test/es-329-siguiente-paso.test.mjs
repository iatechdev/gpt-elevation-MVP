// ES-329 (Siguiente paso): pruebas estructurales de la pantalla migrada al marco de persona (hallazgo E329-3 de QA).
// Cada aserción apunta a un comportamiento que, si se rompe, debe hacer fallar la prueba.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIGRATED_PERSON_PATHS } from '../src/shell/personLayoutState.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = rel => fs.readFileSync(path.join(here, rel), 'utf8')
const shell = read('../src/career/CareerShell.tsx')
const pages = read('../src/career/CareerPages.tsx')
const css = read('../src/cartografia/pages.css')

test('E329-3: la ruta /app/next-step está en MIGRATED_PERSON_PATHS', () => {
  assert.ok(MIGRATED_PERSON_PATHS.includes('/app/next-step'))
})

test('E329-3: la pantalla vive dentro de PersonScreen y no trae cabecera propia', () => {
  assert.match(shell, /<PersonScreen title=\{t\('title'\)\} wide>/)
  assert.doesNotMatch(shell, /career-header/)
})

test('E329-3: la subnavegación marca aria-current="page" solo en la ruta activa', () => {
  assert.match(shell, /aria-current=\{location\.pathname === to \? 'page' : undefined\}/)
  assert.match(shell, /<nav className="pc-subnav" aria-label=\{t\('title'\)\}>\{nav\('\/app\/next-step', 'routes'\)\}\{nav\('\/app\/next-step\/experiments', 'experiments'\)\}\{nav\('\/app\/next-step\/plan', 'plan'\)\}<\/nav>/)
  assert.match(css, /\.pc-subnav a\[aria-current="page"\] \{[^}]*border-bottom-color: var\(--cg-mark\)/)
})

test('E329-3: alto táctil de la subnavegación (var(--cg-touch)) y foco visible', () => {
  assert.match(css, /\.pc-subnav a \{[^}]*min-height: var\(--cg-touch\)/)
  assert.match(css, /\.pc-subnav a:focus-visible \{[^}]*outline: var\(--cg-focus\)/)
})

test('E329-3: al cambiar de ruta el foco va al contenedor #career-main (tabIndex -1)', () => {
  assert.match(shell, /<div id="career-main" tabIndex=\{-1\} className="pc-main">/)
  assert.match(shell, /if \(previousPath\.current !== location\.pathname\) document\.getElementById\('career-main'\)\?\.focus\(\)/)
})

test('E329-3: tras una acción, el foco vuelve al título del experimento o del aviso de base', () => {
  assert.match(pages, /document\.getElementById\('career-carried-title'\) \?\? document\.getElementById\('career-experiment-title'\)\)\?\.focus\(\)/)
  assert.match(pages, /<h3 id="career-carried-title" tabIndex=\{-1\}>/)
})

test('E329-3: la guarda de salida usa el Dialog de Cartografía con «Mantener» (primario) y «Salir» (ghost, deshabilitado si busy)', () => {
  assert.match(shell, /<Dialog open=\{pending !== null\} onClose=\{stay\} title=\{t\('leaveTitle'\)\} actions=\{<><Button onClick=\{stay\}>\{t\('keep'\)\}<\/Button><Button variant="ghost" disabled=\{busy\} onClick=\{leave\}>\{t\('leave'\)\}<\/Button><\/>\} \/>/)
  assert.match(shell, /const stay = \(\) => setPending\(null\)/)
  assert.match(shell, /registerLeaveGuard\(to => \{/)
  // «Salir» limpia lo sin guardar y navega al destino pendiente (historial o ruta)
  assert.match(shell, /const leave = \(\) => \{ const target = pending; dirtyKeys\.current\.clear\(\); setDirtyValue\(false\); setPending\(null\); if \(typeof target === 'number'\) window\.history\.go\(target\); else if \(target !== null\) routerNavigate\(target\) \}/)
})

test('E329-3: «Sí, descartar» es el botón de peligro y «Conservar» no lo es', () => {
  assert.match(pages, /<Button danger disabled=\{blocked\} onClick=\{\(\) => void act\('discard', part\)\}>\{c\.t\('discardYes'\)\}<\/Button>/)
  assert.match(pages, /<Button onClick=\{\(\) => setAsking\(null\)\}>\{c\.t\('keepDraft'\)\}<\/Button>/)
  assert.match(pages, /className=\{`cg-btn\$\{danger \? ' cg-btn--danger' : primary \? '' : ' cg-btn--ghost'\}`\}/)
  assert.equal((pages.match(/<Button danger/g) ?? []).length, 1) // solo el descarte es de peligro
  assert.match(read('../src/cartografia/cartografia.css'), /.cg-btn--danger/)
})

test('E329-3: el rótulo de vista previa (Banner) y la marca «sintético» de cada ruta se mantienen', () => {
  assert.match(shell, /<Banner title=\{t\('preview'\)\} \/>/)
  assert.match(pages, /<Chip>\{c\.t\('synthetic'\)\} · \{c\.t\(route\.slot\)\}<\/Chip>/)
  const copy = read('../src/career/copy.ts')
  assert.match(copy, /preview: \['Vista preliminar con datos sintéticos\./)
  assert.match(copy, /'Preview with synthetic data\./)
  assert.match(copy, /synthetic: \['SINTÉTICO', 'SYNTHETIC'\]/)
})

test('E329-3: la pantalla solo se muestra con VITE_ENABLE_CAREER_PREVIEW y sesión vigente', () => {
  assert.match(shell, /const enabled = import\.meta\.env\.VITE_ENABLE_CAREER_PREVIEW === 'true'/)
  assert.match(shell, /session && token\(\) === session && enabled && <nav className="pc-subnav"/)
  assert.match(shell, /<p role="status">\{t\('disabled'\)\}<\/p>/)
})
