// ES-207: página pública del manifiesto, enlaces por rol, acceso a la edición (admin + superadmin) y textos ES/EN.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { canEnter, zoneForPath, gateDecision } from '../src/shell/access.ts'
import { ADMIN_BOARD_GROUP, BOARD_NAV, PERSON_MENU, PROFESSIONAL_MENU, PUBLIC_NAV, visibleFor } from '../src/shell/nav.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = file => fs.readFileSync(path.join(here, file), 'utf8')
const keys = source => new Set([...source.matchAll(/^\s+(manifest_[a-z_]+):/gm)].map(match => match[1]))

test('ES-207 acceso: editar el manifiesto es de administración y superadministración; la junta ya no entra a /admin/manifest', () => {
  assert.equal(zoneForPath('/admin/manifest'), 'admin')
  for (const role of ['admin', 'superadmin']) assert.equal(gateDecision({ status: 'verified', role }, '/admin/manifest', 'admin'), 'allow', role)
  for (const role of ['user', 'therapist', 'board']) assert.equal(gateDecision({ status: 'verified', role }, '/admin/manifest', 'admin'), 'noAccess', role)
  assert.equal(canEnter('board', 'admin'), false)
  assert.equal(visibleFor(ADMIN_BOARD_GROUP, 'admin').length, 1)
})

test('ES-207 enlaces: /manifiesto en el menú público, de la persona, del profesional y de la junta; el pie de la landing lo recibe por propiedad', () => {
  for (const [name, items] of [['público', PUBLIC_NAV], ['persona', PERSON_MENU], ['profesional', PROFESSIONAL_MENU], ['junta', BOARD_NAV]])
    assert.ok(items.some(item => item.to === '/manifiesto' && item.label === 'adManifest'), name)
  assert.match(read('../src/pages/LandingPage.tsx'), /manifestLabel=\{t\('manifest_public_title'\)\}/)
  assert.match(read('../src/components/landing/LandingClosing.tsx'), /to="\/manifiesto"/)
})

test('ES-207 rutas: /manifiesto es pública (sin guardián) y /board/* redirige a ella', () => {
  const app = read('../src/App.tsx')
  const publicRoute = app.slice(app.indexOf('<Route path="/manifiesto"'), app.indexOf('<Route path="/manifiesto"') + 120)
  assert.match(publicRoute, /<Route path="\/manifiesto" element=\{<ManifestoPage \/>\}/)
  assert.ok(app.indexOf('<Route path="/manifiesto"') < app.indexOf('<Route element={<ProtectedRoute />}>'), 'la ruta pública va antes de las protegidas')
  assert.match(app, /<Route path="\/board\/\*" element=\{<Navigate to="\/manifiesto" replace \/>\} \/>/)
  assert.equal(zoneForPath('/manifiesto'), null)
})

test('ES-207 página: pide solo el endpoint público, muestra texto plano y cubre cargando, vacío, error con reintento y éxito', () => {
  const page = read('../src/pages/ManifestoPage.tsx')
  assert.match(page, /\/api\/manifest\/active/); assert.equal(/Authorization/.test(page), false, 'la lectura pública no envía el token')
  assert.equal(/dangerouslySetInnerHTML|innerHTML/.test(page), false, 'texto plano, nunca HTML')
  assert.equal((page.match(/<h1 /g) ?? []).length, 1)
  for (const key of ['manifest_public_loading', 'manifest_public_empty', 'manifest_public_error', 'manifest_public_retry', 'manifest_public_back', 'manifest_public_version']) assert.ok(page.includes(key), key)
  assert.match(page, /role="status"/); assert.match(page, /kind="error"/)
  assert.equal(/\bstyle=\{/.test(page), false, 'sin estilos en línea')
  assert.equal(/maxHeight|overflowY|max-height|overflow-y/.test(page + read('../src/pages/manifesto.css')), false, 'el texto fluye completo, sin scroll interno')
})

test('ES-207 textos: ES y EN con las mismas claves y marcadores, sin ternarios de idioma', () => {
  const es = read('../src/i18n/es.ts'), en = read('../src/i18n/en.ts')
  assert.deepEqual([...keys(es)].sort(), [...keys(en)].sort()); assert.equal(keys(es).size, 8)
  assert.match(es, /manifest_public_version: 'Versión \{version\} · publicada el \{date\}'/); assert.match(en, /manifest_public_version: 'Version \{version\} · published \{date\}'/)
  assert.equal(/lang === 'es' \?/.test(read('../src/pages/ManifestoPage.tsx')), false)
})
