// ES-94: la landing explica cada ruta del Skill Map y la tarjeta de Elevation no lleva etiqueta de estado.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))
const get = (key) => catalog.find(entry => entry.key === key)

// ES-360: los dos tests de las tres rutas (continuidad, adyacente y exploratoria) y de sus explicaciones se retiran con el detalle de las rutas de la portada («Qué se retira» del diseño 12863):
// mientras las rutas están «En preparación» basta una tarjeta (landing.skillmap.routes.title/body). Su regla («sin empleo, porcentajes ni datos inexistentes») la barre test/es-360-copies.test.mjs sobre TODO el catálogo.

test('ES-94: Elevation no lleva etiqueta de estado (la clave ya no existe) y Skill Map figura como disponible (ES-133)', () => {
  assert.equal(get('landing.modules.elevation.status'), undefined)
  const skillmap = get('landing.modules.skillmap.status'); assert.deepEqual([skillmap.es, skillmap.en], ['Disponible', 'Available'])
  const journey = fs.readFileSync(new URL('../src/components/landing/LandingJourney.tsx', import.meta.url), 'utf8')
  assert.match(journey, /module === 'skillmap' && <LandingLabel className="landing-module-status">/)
  assert.doesNotMatch(journey, /modules\.\$\{module\}\.status/)
})
