// ES-94: la landing explica cada ruta del Skill Map y la tarjeta de Elevation no lleva etiqueta de estado.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/landing-content.json', import.meta.url), 'utf8'))
const get = (key) => catalog.find(entry => entry.key === key)

test('ES-94: textos aprobados de las tres rutas en ES y EN, basados en las reglas del contrato de rutas', () => {
  const expected = {
    continuity: ['Un rol del mismo contexto del que vienes. Parte de lo que ya sabes hacer y te muestra qué barreras y brechas tendrías para dar el siguiente paso allí.',
      'A role in the same context you already work in. It starts from what you can already do and shows which barriers and gaps you would face to take the next step there.'],
    adjacent: ['Un rol de otro contexto que comparte contigo al menos una capacidad esencial que ya demostraste. Te explica por qué encaja y qué te faltaría.',
      'A role in a different context that shares at least one essential capability you have already shown. It explains why it fits and what you would still need.'],
    exploratory: ['Un rol ligado a tus intereses, donde lo que ya demostraste aún no alcanza del todo. Te propone una prueba pequeña para ver si te gusta antes de decidir.',
      'A role linked to your interests, where what you have shown does not fully cover it yet. It suggests a small test so you can see whether you like it before you decide.'],
  }
  for (const [route, [es, en]] of Object.entries(expected)) {
    const entry = get(`landing.skillmap.routes.${route}.pending`)
    assert.deepEqual([entry.es, entry.en], [es, en], route)
  }
  const body = get('landing.skillmap.routes.body')
  assert.match(body.es, /Tú decides cuál aceptar y puedes rechazar cualquiera\.$/); assert.match(body.en, /You decide which to accept, and you can reject any of them\.$/)
})

test('ES-94: las explicaciones no prometen empleo, porcentajes ni datos que no existen, y ya no dicen «se mostrarán cuando el catálogo esté verificado»', () => {
  for (const route of ['continuity', 'adjacent', 'exploratory']) for (const lang of ['es', 'en']) {
    const text = get(`landing.skillmap.routes.${route}.pending`)[lang]
    assert.doesNotMatch(text, /\d+\s?%|garantiz|guarantee|empleo seguro|job offer|catálogo esté verificado|catalog is verified|\[/i, `${route} ${lang}`)
    assert.ok(text.length > 80, `${route} ${lang}`)
  }
})

test('ES-94: Elevation no lleva etiqueta de estado (la clave ya no existe) y Skill Map conserva «Próximamente»', () => {
  assert.equal(get('landing.modules.elevation.status'), undefined)
  const skillmap = get('landing.modules.skillmap.status'); assert.deepEqual([skillmap.es, skillmap.en], ['Próximamente', 'Coming soon'])
  const journey = fs.readFileSync(new URL('../src/components/landing/LandingJourney.tsx', import.meta.url), 'utf8')
  assert.match(journey, /module === 'skillmap' && <LandingLabel className="landing-module-status">/)
  assert.doesNotMatch(journey, /modules\.\$\{module\}\.status/)
})
