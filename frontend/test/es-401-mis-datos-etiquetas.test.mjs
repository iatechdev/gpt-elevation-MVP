// ES-401 (F45-3): «Mis datos» no muestra claves internas. Cruza TODAS las claves que exporta el servidor (backend/utils/personalData.js) con las etiquetas ES y EN.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describeSections, otherSections, sectionLabels, hiddenSections } from '../src/space/dataCopy.ts'

const serverSource = fs.readFileSync(new URL('../../backend/utils/personalData.js', import.meta.url), 'utf8')
const serverKeys = [...serverSource.matchAll(/^\s*\['([A-Za-z]+)', '[A-Za-z]+', '[A-Za-z]+', \[/gm)].map(m => m[1])
const NINE = ['passwordResets', 'therapistOrdinals', 'reviewResponses', 'reviewObjections', 'professionalReviews', 'reviewShares', 'pilotFeedbacks', 'invitations', 'reviewerInvitesRedeemed']

test('ES-401: cada clave que exporta el servidor tiene etiqueta ES y EN (si el servidor añade una sin etiqueta, esta prueba falla)', () => {
  assert.ok(serverKeys.length >= 30, `se leyeron ${serverKeys.length} claves del servidor`)
  for (const key of NINE) assert.ok(serverKeys.includes(key), `el servidor exporta ${key}`)
  for (const lang of ['es', 'en']) for (const key of serverKeys) assert.ok(sectionLabels[lang][key], `${lang}.${key}`)
})

test('ES-401: las etiquetas nuevas son legibles (sin la clave interna, ES distinto de EN) y los textos son los aprobados', () => {
  for (const key of NINE) { assert.notEqual(sectionLabels.es[key], sectionLabels.en[key], key); for (const lang of ['es', 'en']) assert.doesNotMatch(sectionLabels[lang][key], /[a-z][A-Z]/, `${lang}.${key} no parece una clave`) }
  assert.equal(sectionLabels.es.pilotFeedbacks, 'Opinión sobre el piloto'); assert.equal(sectionLabels.en.reviewShares, 'Reviewer authorizations')
  assert.deepEqual(otherSections, { es: 'Otros datos', en: 'Other data' })
  assert.deepEqual(Object.keys(sectionLabels.es).sort(), Object.keys(sectionLabels.en).sort())
})

test('ES-401: las claves desconocidas nunca salen crudas: una sola «Otros datos (n)» con la suma; sin conteos, sin número', () => {
  const sections = [{ name: 'diary', count: 2 }, { name: 'claveNueva', count: 3 }, { name: 'otraClave', count: null }, { name: 'tercera', count: 4 }]
  assert.deepEqual(describeSections(sections, 'es'), ['Diario (2)', 'Otros datos (7)'])
  assert.deepEqual(describeSections(sections, 'en'), ['Journal (2)', 'Other data (7)'])
  assert.deepEqual(describeSections([{ name: 'x', count: null }, { name: 'y', count: null }], 'es'), ['Otros datos'])
  assert.deepEqual(describeSections([], 'es'), [])
  const raw = [...NINE, 'zzz']
  for (const lang of ['es', 'en']) for (const line of describeSections(raw.map(name => ({ name, count: 1 })), lang)) assert.ok(!raw.some(key => line === key || line.startsWith(key + ' (')), `${lang}: ${line} no es una clave cruda`)
  assert.deepEqual(describeSections([{ name: 'constructor', count: 1 }, { name: '__proto__', count: 1 }], 'es'), ['Otros datos (2)']) // claves heredadas del prototipo no cuentan como etiquetas
})

test('ES-401: la pantalla usa describeSections (no la clave) y los metadatos siguen ocultos', () => {
  const page = fs.readFileSync(new URL('../src/space/DataPage.tsx', import.meta.url), 'utf8')
  assert.match(page, /describeSections\(preview\.sections, lang\)\.join\(' · '\)/); assert.doesNotMatch(page, /labels\[s\.name\] \?\? s\.name/)
  assert.deepEqual(hiddenSections, ['schemaVersion', 'type', 'locale'])
})
