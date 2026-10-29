// ES-90 (actualizado en ES-94): ningún marcador entre corchetes llega a la landing pública y el panel «Pendientes de contenido»
// solo aparece mientras haya algún texto esperando un dato real. Hoy no hay ninguno.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PENDING_ITEMS, PENDING_KEYS, hasMarker, isPending, countPending, provisionalText } from '../src/pages/admin/landingPending.ts'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-94: no hay textos pendientes (los de Elevation, las rutas y los profesionales son definitivos) y todas las claves listadas existen', () => {
  assert.equal(PENDING_ITEMS.length, 0); assert.equal(PENDING_KEYS.size, 0)
  for (const item of PENDING_ITEMS) assert.ok(catalog.some(entry => entry.key === item.key), item.key)
})

test('ES-90: ningún texto del catálogo, ES ni EN, trae marcadores entre corchetes', () => {
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.equal(hasMarker(entry[lang]), false, `${entry.key} ${lang}: ${entry[lang]}`)
})

test('ES-90: la lógica Pendiente/Listo sigue funcionando para cuando se agregue un texto pendiente', () => {
  const key = 'landing.nav.skip' // una clave real del catálogo
  const provisional = provisionalText(key, 'es')
  assert.ok(provisional.length > 3); assert.equal(provisionalText('no.existe', 'es'), '')
  assert.equal(isPending(key, provisional, 'es'), true)
  assert.equal(isPending(key, `  ${provisional}  `, 'es'), true)
  assert.equal(isPending(key, '', 'es'), true)
  assert.equal(isPending(key, undefined, 'es'), true)
  assert.equal(isPending(key, '[pendiente]', 'es'), true)
  assert.equal(isPending(key, 'Otro texto definitivo', 'es'), false)
  assert.deepEqual(countPending({}, 'es'), { pending: 0, ready: 0 })
})

test('ES-94: la pestaña Landing monta el panel antes de la lista general, pero el panel no se dibuja sin pendientes y la lista general ya incluye todos los campos', () => {
  const admin = read('../src/pages/admin/AdminContent.tsx')
  assert.match(admin, /<LandingPendingPanel [\s\S]*?save=\{saveField\}/)
  assert.match(admin, /landingFields\.filter\(\(\{ key \}\) => !PENDING_KEYS\.has\(key\)\)/)
  assert.ok(admin.indexOf('<LandingPendingPanel') < admin.indexOf('{fields.map(f =>'))
  const panel = read('../src/pages/admin/LandingPendingPanel.tsx')
  assert.match(panel, /if \(PENDING_ITEMS\.length === 0\) return null/)
  assert.match(panel, /<section aria-labelledby="landing-pending-title"/); assert.doesNotMatch(panel, /fetch\(/)
})
