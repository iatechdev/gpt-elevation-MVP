// ES-310 (ES-349): Manifiesto ético de Administración en Cartografía. Comprobaciones de fuente; el recorrido en navegador está en scripts/es182-manifest-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/board/BoardManifest.tsx')
const css = read('../src/pages/board/boardManifest.css').replace(/\/\*[\s\S]*?\*\//g, '')

test('ES-349: el Manifiesto no deja estilos en línea, colores propios ni Playfair y usa piezas de Cartografía', () => {
  assert.doesNotMatch(page, /style=\{\{|React\.CSSProperties|#[0-9a-fA-F]{3,8}\b|rgba?\(|Playfair|Inter,|confirm\(/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|--elv-|--color-/)
  assert.match(page, /import \{ Button, Card, Chip, Dialog, TextAreaField, TextField \} from '..\/..\/cartografia'/)
  assert.match(page, /<h1 className="pg-title">/)
})

test('ES-349: «Reactivar» pide confirmación con el Dialog compartido (Cancelar primero, mismos textos) y ya no usa window.confirm', () => {
  assert.doesNotMatch(page, /window\.confirm|[^.\w]confirm\(/)
  assert.match(page, /<Dialog\s+open=\{confirming !== null\} onClose=\{\(\) => setConfirming\(null\)\}/)
  assert.match(page, /`\$\{t\('board_confirm_activate'\)\} \$\{confirming\.version\}\?`/)
  assert.ok(page.indexOf("t('board_cancel')}</Button>\n          <Button onClick={() => { if (confirming)") > 0, 'Cancelar va antes que Reactivar (el foco entra en Cancelar)')
  const shared = read('../src/cartografia/interactive.tsx'); assert.match(shared, /showModal\(\)/); assert.match(shared, /onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\) \}\}/)
})

test('ES-349: el historial se expande con un botón (aria-expanded + aria-controls), no con un div clicable', () => {
  assert.match(page, /<button type="button" className="bm-ver__head" aria-expanded=\{expandedId === v\.id\} aria-controls=\{`bm-v-\$\{v\.id\}`\}/)
  assert.doesNotMatch(page, /<div[^>]*onClick/)
  assert.match(page, /id=\{`bm-v-\$\{v\.id\}`\}/)
})

test('ES-349: la lógica no cambió: llamadas a la API, mínimo de 50 caracteres (error en el campo) y foco al resultado', () => {
  for (const call of ['/api/board/manifest`', '/api/board/manifest/${id}/activate']) assert.ok(page.includes(call), call)
  assert.match(page, /newContent\.trim\(\)\.length < 50/); assert.match(page, /setFieldError\(t\('board_error_min'\)\)/)
  assert.match(page, /error=\{fieldError \?\? undefined\}/)
  assert.match(page, /if \(success\) statusRef\.current\?\.focus\(\)/)
  assert.match(page, /<Link to="\/manifiesto" className="bm-public">/)
})

test('ES-349: los textos del Manifiesto existen en ES y EN, sin emojis', () => {
  const pairs = source => Object.fromEntries([...source.matchAll(/^\s*((?:board_|manifest_view_public)[a-z_]*): '((?:[^'\\]|\\.)*)'/gm)].map(m => [m[1], m[2]]))
  const es = pairs(read('../src/i18n/es.ts')); const en = pairs(read('../src/i18n/en.ts'))
  const keys = Object.keys(es)
  assert.ok(keys.length >= 24, 'claves board_* de es: ' + keys.length)
  for (const key of keys) {
    assert.ok(en[key], 'falta el inglés de ' + key)
    assert.doesNotMatch(es[key] + en[key], /[✅✔✓⭐]/u, key)
  }
  assert.ok(es.manifest_view_public && en.manifest_view_public)
})
