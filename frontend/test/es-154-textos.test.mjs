// ES-154: textos ES/EN desde docs/ux/plataforma/textos.json. Faltas de clave, marcadores, plurales/formatos y carga bajo demanda.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { interpolate, placeholdersOf, formatNumber, formatDate, pluralForm } from '../src/i18n/format.ts'
import { splitCatalog } from '../scripts/build-catalog.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const read = file => fs.readFileSync(path.join(here, file), 'utf8')
const source = JSON.parse(read('../../docs/ux/plataforma/textos.json'))
const entries = Object.entries(source.textos)
// Claves hoy sin texto en un idioma en la fuente. Es una lista cerrada: una clave nueva con falta rompe la prueba.
// Dev no inventa texto; el contenido lo define UX/PO. Cuando se rellenen, se quitan de aquí.
const KNOWN_EMPTY = new Set(['rs_s4q', 'rs_s4c'])

test('ES-154 fuente: toda clave tiene es y en (salvo la lista cerrada de faltas conocidas)', () => {
  assert.ok(entries.length >= 2200)
  const missing = entries.filter(([, v]) => !String(v.es ?? '').trim() || !String(v.en ?? '').trim()).map(([k]) => k)
  assert.deepEqual(missing.sort(), [...KNOWN_EMPTY].sort(), 'faltas de es/en distintas de las conocidas')
  for (const key of KNOWN_EMPTY) assert.ok(source.textos[key], `${key} ya no existe: quítala de KNOWN_EMPTY`)
})

test('ES-154 fuente: ES y EN usan los mismos marcadores {n}, {name}…', () => {
  for (const [key, value] of entries) assert.deepEqual(placeholdersOf(value.es ?? ''), placeholdersOf(value.en ?? ''), key)
})

test('ES-154 catálogo generado coincide con la fuente (corre `npm run i18n:build` si falla)', () => {
  const expected = splitCatalog(source)
  assert.deepEqual(JSON.parse(read('../src/i18n/catalog/es.json')), expected.es)
  assert.deepEqual(JSON.parse(read('../src/i18n/catalog/en.json')), expected.en)
  assert.equal(Object.keys(expected.es).length, entries.length - KNOWN_EMPTY.size)
})

test('ES-154 sustitución de marcadores: valores, marcador sin valor y números', () => {
  assert.equal(interpolate('¿Desvincularte de {name}?', { name: 'Ana' }), '¿Desvincularte de Ana?')
  assert.equal(interpolate('{n} de {max}', { n: 3, max: 5 }), '3 de 5')
  assert.equal(interpolate('Hola {name}', {}), 'Hola {name}') // nunca «undefined»
  assert.equal(interpolate('Sin marcadores'), 'Sin marcadores')
  assert.equal(interpolate('{a}{a}', { a: 0 }), '00')
})

test('ES-154 formatos por idioma: coma decimal en ES, punto en EN; fecha inválida vacía; plurales', () => {
  assert.equal(formatNumber(3.5, 'es'), '3,5'); assert.equal(formatNumber(3.5, 'en'), '3.5')
  assert.equal(formatDate('no es fecha', 'es'), ''); assert.notEqual(formatDate('2026-11-08T12:00:00Z', 'en'), '')
  const forms = { one: '1 sesión', other: 'varias sesiones' }
  assert.equal(pluralForm(1, 'es', forms), forms.one); assert.equal(pluralForm(0, 'es', forms), forms.other); assert.equal(pluralForm(2, 'en', forms), forms.other)
})

test('ES-154 proveedor: catálogo bajo demanda por idioma, t() con parámetros, lang del documento y elección guardada', () => {
  const provider = read('../src/i18n/LanguageProvider.tsx'), catalog = read('../src/i18n/catalog.ts'), context = read('../src/i18n/context.tsx')
  assert.ok(provider.includes('loadCatalog(lang)') && provider.includes('useSyncExternalStore') && provider.includes('interpolate('))
  assert.ok(/translations\[lang\]\[key\] \?\? lazyText\(lang, key\) \?\? catalog\?\.\[key\] \?\? key/.test(provider)) // los diccionarios actuales ganan; luego el registro perezoso (ES-232); luego el catálogo; luego la clave
  assert.ok(provider.includes('document.documentElement.lang = lang') && provider.includes("localStorage.setItem('elv_lang'"))
  assert.ok(catalog.includes("import('./catalog/es.json')") && catalog.includes("import('./catalog/en.json')")) // un bloque por idioma
  assert.equal(/import .*catalog\/(es|en)\.json/.test(provider + context), false, 'el catálogo no debe ir en el bloque de entrada')
  assert.ok(context.includes('params?: Params'))
})

test('ES-154 los textos «(ejemplo)» están contados: ninguna historia los deja en producción', () => {
  const examples = entries.filter(([, v]) => /\(ejemplo\)|\(example\)/i.test(`${v.es} ${v.en}`)).map(([k]) => k)
  assert.equal(examples.length, 17, `cambió el número de textos de ejemplo: ${examples.join(', ')}`)
})
