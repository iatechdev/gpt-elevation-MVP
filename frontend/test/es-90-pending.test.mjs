// ES-90: los marcadores de contenido pendiente quedan listos en el administrador y nunca llegan a la landing pública.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PENDING_ITEMS, PENDING_KEYS, hasMarker, isPending, countPending, provisionalText } from '../src/pages/admin/landingPending.ts'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-90: las 5 claves pendientes existen en el catálogo y tienen etiqueta y descripción de lo que falta', () => {
  assert.equal(PENDING_ITEMS.length, 4)
  for (const item of PENDING_ITEMS) {
    assert.ok(catalog.some(entry => entry.key === item.key), item.key)
    assert.ok(item.label.length > 3 && item.missing.length > 20, item.key)
  }
  assert.equal(PENDING_KEYS.size, 4)
  assert.equal(PENDING_KEYS.has('landing.join.professional_pending'), false) // ES-95: ya es texto definitivo (formulario público)
})

test('ES-90: ningún texto del catálogo, ES ni EN, trae marcadores entre corchetes', () => {
  for (const entry of catalog) for (const lang of ['es', 'en']) assert.equal(hasMarker(entry[lang]), false, `${entry.key} ${lang}: ${entry[lang]}`)
})

test('ES-90: textos provisionales aprobados', () => {
  assert.equal(provisionalText('landing.modules.elevation.status', 'es'), 'En piloto')
  assert.equal(provisionalText('landing.modules.elevation.status', 'en'), 'In pilot')
  assert.equal(provisionalText('landing.skillmap.routes.adjacent.pending', 'es'), 'Las fuentes, fechas, barreras y brechas se mostrarán cuando el catálogo esté verificado.')
  assert.equal(provisionalText('landing.skillmap.routes.exploratory.pending', 'en'), 'Sources, dates, barriers and gaps will be shown once the catalog is verified.')
  assert.match(provisionalText('landing.join.professional_pending', 'es'), /^Completa el formulario: el equipo de Elevation revisa tu solicitud/)
  assert.match(provisionalText('landing.join.professional_pending', 'en'), /^Fill in the form: the Elevation team reviews your application/)
  assert.equal(provisionalText('no.existe', 'es'), '')
})

test('ES-90: Pendiente mientras el valor sea el provisional, vacío o con corchetes; Listo cuando el superadmin lo reemplaza', () => {
  const key = 'landing.modules.elevation.status'
  assert.equal(isPending(key, 'En piloto', 'es'), true)
  assert.equal(isPending(key, '  En piloto  ', 'es'), true)
  assert.equal(isPending(key, 'In pilot', 'es'), false) // otro idioma: ya no es el provisional de ES
  assert.equal(isPending(key, '', 'es'), true)
  assert.equal(isPending(key, undefined, 'es'), true)
  assert.equal(isPending(key, '[estado: pendiente]', 'es'), true)
  assert.equal(isPending(key, 'Disponible', 'es'), false)
})

test('ES-90: el contador distingue pendientes y listos por idioma', () => {
  const content = Object.fromEntries(PENDING_ITEMS.map(item => [item.key, provisionalText(item.key, 'es')]))
  assert.deepEqual(countPending(content, 'es'), { pending: 4, ready: 0 })
  assert.deepEqual(countPending({ ...content, 'landing.modules.elevation.status': 'Disponible' }, 'es'), { pending: 3, ready: 1 })
  assert.deepEqual(countPending({}, 'en'), { pending: 4, ready: 0 })
})

test('ES-90: la pestaña Landing muestra el panel primero, sin duplicar los campos pendientes en la lista general', () => {
  const admin = read('../src/pages/admin/AdminContent.tsx')
  assert.match(admin, /<LandingPendingPanel [\s\S]*?save=\{saveField\}/)
  assert.match(admin, /landingFields\.filter\(\(\{ key \}\) => !PENDING_KEYS\.has\(key\)\)/)
  assert.ok(admin.indexOf('<LandingPendingPanel') < admin.indexOf('{fields.map(f =>'))
  const panel = read('../src/pages/admin/LandingPendingPanel.tsx')
  assert.match(panel, /<section aria-labelledby="landing-pending-title"/)
  assert.match(panel, /<label htmlFor=\{id\}/); assert.match(panel, /aria-describedby=/)
  assert.match(panel, /Pendiente/); assert.match(panel, /Listo/); assert.doesNotMatch(panel, /fetch\(/) // guarda con el PUT existente, sin otra ruta
})
