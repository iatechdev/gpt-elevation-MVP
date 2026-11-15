// ES-307 (PR 3): el Diario en Cartografía. Sin DOM: contratos del código; el comportamiento (doble clic, ACK perdido, diálogos, axe, CLS) lo verifica scripts/es163-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isMigratedPersonPath } from '../src/shell/personLayoutState.ts'
import { journalCopy } from '../src/space/journalCopy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/space/JournalPage.tsx'); const recent = read('../src/space/JournalRecent.tsx')

test('ES-307: las tres rutas del diario están en el marco migrado y la pantalla usa PersonScreen, no el marco anterior', () => {
  for (const path of ['/app/diary', '/app/diary/new', '/app/diary/12']) assert.equal(isMigratedPersonPath(path), true, path)
  assert.match(page, /<PersonScreen title=\{j\.title\} lead=\{j\.private\}/)
  for (const source of [page, recent]) assert.doesNotMatch(source, /SpaceShell|ConfirmDialog|elv-|space-card|space-actions|space-error|className="[^"]*journal-|<dialog/)
  assert.equal(fs.existsSync(new URL('../src/space/ConfirmDialog.tsx', import.meta.url)), false)
})

test('ES-307: los diálogos de borrar y de salir son el Dialog de Cartografía con los mismos textos y acciones', () => {
  assert.match(page, /<Dialog open=\{!!dialog && !expired\} onClose=\{\(\) => setDialog\(null\)\}/)
  assert.match(page, /title=\{dialog === 'delete' \? c\.remove : c\.leave\}/); assert.match(page, /\{c\.stay\}<\/Button>/)
  assert.match(page, /if \(dialog === 'delete'\) \{ void remove\(\); return \}/); assert.match(page, /if \(isNew \|\| dialog === 'discard'\) navigate\('\/app\/diary'\)/)
  assert.match(page, /variant=\{dialog === 'delete' \? 'danger' : 'primary'\}/)
})

test('ES-307: el estado del guardado sigue siendo una región viva y el aviso lleva ⚠ (no solo color); el único texto nuevo es «Entradas»/«Entries»', () => {
  assert.match(page, /id="journal-save-status" role="status" aria-live="polite" className=\{statusWarn \? 'pg-status pg-status--warn' : 'pg-status'\}/)
  assert.match(read('../src/space/journal.css'), /\.pg-status--warn::before \{ content: '.26A0/)
  assert.equal(journalCopy.es.listTitle, 'Entradas'); assert.equal(journalCopy.en.listTitle, 'Entries')
  assert.match(recent, /journalCopy\[lang\]\.listTitle/)
})

test('ES-307: el texto de la persona va en Spectral y journal.css solo usa tokens --cg-* (sin colores fijos)', () => {
  const css = read('../src/space/journal.css')
  assert.match(css, /\.pg-reading \{[^}]*font-family: var\(--cg-font-name\)/); assert.match(css, /\.pg-paper \.cg-textarea[^{]*\{[^}]*font-family: var\(--cg-font-name\)/)
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|rgb\(|--elv-|--color-/)
})

test('ES-307: borrador, requestId y guardado incierto siguen igual (nada en almacenamiento; los botones del reintento y del borrado conservan su condición)', () => {
  assert.doesNotMatch(page.replace(/localStorage\.getItem/g, ''), /localStorage\.setItem|sessionStorage|console\./)
  assert.match(page, /const requestId = useRef\(crypto\.randomUUID\(\)\)/)
  assert.match(page, /<Button variant="danger" disabled=\{busy \|\| !!uncertain\} onClick=\{\(\) => setDialog\('delete'\)\}>/)
  assert.match(page, /useDraftGuard\(!expired && \(dirty \|\| busy \|\| !!uncertain\), c\.leave\)/)
})
