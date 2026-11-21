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

test('ES-349 seguimiento: sin texto crudo del servidor, se relee antes de afirmar si se pierde la respuesta, fechas con el idioma activo y una sola reactivación a la vez', () => {
  assert.doesNotMatch(page, /new Error\(data\.error\)|err\.message|err instanceof Error/, 'ningún texto crudo del servidor ni de la red llega a la pantalla')
  assert.match(page, /setError\(t\('board_error_activate'\)\)/); assert.match(page, /setError\(t\('board_error_unconfirmed'\)\)/)
  assert.match(page, /const fresh = await readVersions\(\)[\s\S]*fresh\?\.some\(v => v\.id === id && v\.isActive\)/, 'releer y comparar antes de afirmar')
  assert.match(page, /toLocaleDateString\(lang === 'en' \? 'en-US' : 'es-CO'/)
  assert.match(page, /disabled=\{activating !== null\} onClick=\{\(\) => setConfirming\(v\)\}/, 'mientras una versión se reactiva, ninguna otra puede')
  assert.match(page, /<Chip tone="ok" symbol="●">\{t\('board_active_badge'\)\}<\/Chip>\}\s*(?:\{v\.contentEn && <Chip symbol="EN">\{t\('board_has_en'\)\}<\/Chip>\}\s*)?<strong>\{v\.version\}/, 'el chip ACTIVO va solo con v.isActive (E45-1: puede seguirle la marca EN)')
})

test('ES-182 (decisión 12079): solo superadmin ve publicar y reactivar; administración solo lee (el servidor sigue siendo la autoridad)', () => {
  for (const piece of ["const canPublish = (localStorage.getItem('elevation_role') ?? '') === 'superadmin'", '{canPublish && <Button variant="ghost" aria-expanded={showForm}', '{canPublish && showForm && (', '{canPublish && !v.isActive && (', '<Link to="/manifiesto" className="bm-public">']) assert.ok(page.includes(piece), piece) // el enlace público lo ven todos
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

test('E409-1: mientras carga se reserva la altura de «Versión vigente» (marcador aria-hidden, solo sin datos) para que el historial no salte', () => {
  const page = read('../src/pages/board/BoardManifest.tsx'), css = read('../src/pages/board/boardManifest.css')
  assert.ok(page.includes('{!active && (loading ? <div className="bm-skel" aria-hidden="true" /> : ('))
  assert.match(css, /\.bm-skel \{ min-height: 18\.5rem; margin: 0 0 1rem; \}/)
  // sin vigente al terminar la carga (vacío, error, solo inactivas) el marcador se sustituye por un bloque de la MISMA altura mínima: sin salto (QA-414)
  assert.ok(page.includes('className="pg-card bm-active bm-active--none"'))
  assert.match(css, /\.bm-active--none \{ min-height: 18\.5rem; margin: 0 0 1rem; \}/)
  assert.doesNotMatch(css.slice(css.indexOf('E409-1')), /#[0-9a-fA-F]{3,8}\b|rgb\(|animation/)
})
