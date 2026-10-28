import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { exampleAccessibleTitle, exampleApproved } from '../src/content/landingExample.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const component = read('../src/components/landing/ExampleStrip.tsx')
const page = read('../src/pages/LandingPage.tsx')
const css = read('../src/components/landing/landing.css')
const catalog = JSON.parse(read('../../shared/landing-content.json'))
const byKey = Object.fromEntries(catalog.map(entry => [entry.key, entry]))

test('ES-64: la franja está oculta salvo que la bandera valga exactamente "true"', () => {
  for (const value of [undefined, null, '', 'false', 'TRUE', '1', ' true', true, 'yes']) assert.equal(exampleApproved(value), false, String(value))
  assert.equal(exampleApproved('true'), true)
})

test('ES-64: el nombre accesible convierte la flecha en pausa, en ES y EN', () => {
  assert.equal(exampleAccessibleTitle(byKey['landing.example.title'].es), 'Acciones, posibles capacidades')
  assert.equal(exampleAccessibleTitle(byKey['landing.example.title'].en), 'Actions, possible capabilities')
  assert.equal(exampleAccessibleTitle('Sin flecha'), 'Sin flecha')
})

test('ES-64: textos del catálogo según el diseño, rotulados como ejemplo ilustrativo y sin promesas', () => {
  assert.equal(byKey['landing.example.label'].es, 'Ejemplo ilustrativo · caso ficticio · docencia')
  assert.equal(byKey['landing.example.label'].en, 'Illustrative example · fictional case · teaching')
  const all = ['es', 'en'].flatMap(lang => ['label', 'title', 'flow'].map(k => byKey[`landing.example.${k}`][lang])).join(' ')
  assert.match(byKey['landing.example.flow'].es, /No es un diagnóstico ni una promesa de empleo/)
  assert.match(byKey['landing.example.flow'].en, /Not a diagnosis, not a job promise/)
  assert.doesNotMatch(all, /\d|%|garantiz|asegur|guarantee|testimon/i) // sin cifras, porcentajes ni testimonios
})

test('ES-64: el componente solo usa landing.example.* y no inyecta HTML ni datos', () => {
  const used = [...component.matchAll(/text\('(landing\.[^']+)'\)/g)].map(match => match[1])
  assert.deepEqual(new Set(used), new Set(['landing.example.title', 'landing.example.label', 'landing.example.flow']))
  assert.match(component, /if \(!exampleApproved\(import\.meta\.env\.VITE_LANDING_EXAMPLE_APPROVED\)\) return null/)
  assert.match(component, /aria-labelledby="landing-example-title"/)
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|fetch\(|localStorage/)
})

test('ES-64: LandingPage monta la franja bajo el héroe sin tocar el resto', () => {
  assert.match(page, /<ExampleStrip text=\{landing\.text\} \/>/)
  // Dentro del marco centrado de 1080 px de la maqueta (QA-LAND-01)
  assert.match(page, /<div className="landing-frame">[\s\S]*<HeroDoors[^>]*\/>[\s\S]*<ExampleStrip text=\{landing\.text\} \/>\s*<\/div>/)
  assert.ok(page.indexOf('<ExampleStrip') < page.indexOf('<LandingJourney'))
})

test('QA-64-01: la etiqueta se parte en pantallas estrechas en lugar de ensanchar la columna', () => {
  assert.match(css, /\.landing-example \.landing-container \{[^}]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /\.landing-example-tag \{[^}]*width: fit-content[^}]*min-width: 0[^}]*max-width: 100%[^}]*overflow-wrap: anywhere/)
})

test('ES-64: estilos con fondo suave, borde superior y etiqueta con borde ocre', () => {
  assert.match(css, /\.landing-example \{[^}]*border-top: 1px solid[^}]*background: var\(--color-base-200\)/)
  assert.match(css, /\.landing-example-tag \{[^}]*border: 1px solid var\(--color-secondary\)/)
})
