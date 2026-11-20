// E366-2 (ES-357): editar un plan con moneda o período HEREDADO (fuera de lista) ya no reenvía el valor oculto ni responde «Error guardando.» sin decir el campo.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PLAN_CHOICE_ERRORS, PLAN_CURRENCIES, PLAN_PERIODS, normalizeChoices, serverFieldError } from '../src/pages/admin/planChoices.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('E366-2: las listas del formulario son las del servidor y los mensajes son los mismos textos de API (ES/EN)', () => {
  const backend = read('../../backend/utils/pricingValidation.js')
  assert.deepEqual([...PLAN_CURRENCIES], backend.match(/const CURRENCIES = Object\.freeze\(\[([^\]]+)\]\)/)[1].split(',').map(x => x.trim().replace(/'/g, '')))
  assert.deepEqual([...PLAN_PERIODS], backend.match(/const PERIODS = Object\.freeze\(\[([^\]]+)\]\)/)[1].split(',').map(x => x.trim().replace(/'/g, '')))
  assert.ok(backend.includes(`currency: '${PLAN_CHOICE_ERRORS.currency}'`)); assert.ok(backend.includes(`period: '${PLAN_CHOICE_ERRORS.period}'`))
  for (const message of Object.values(PLAN_CHOICE_ERRORS)) assert.match(message, / \/ /, 'bilingüe')
  const screen = read('../src/pages/admin/AdminContent.tsx')
  for (const c of PLAN_CURRENCIES) assert.ok(screen.includes(`<option value="${c}">`)); for (const p of PLAN_PERIODS) assert.ok(screen.includes(`<option value="${p}">`))
})

test('E366-2: normalizeChoices conserva lo válido y pasa lo heredado a lo que el desplegable muestra, marcando SOLO el campo corregido', () => {
  assert.deepEqual(normalizeChoices({ currency: 'COP', period: 'year' }), { values: { currency: 'COP', period: 'year' }, errors: {} })
  assert.deepEqual(normalizeChoices({ currency: 'JPY', period: 'month' }), { values: { currency: 'USD', period: 'month' }, errors: { 'plan-currency': PLAN_CHOICE_ERRORS.currency } })
  assert.deepEqual(normalizeChoices({ currency: 'EUR', period: 'forever' }), { values: { currency: 'EUR', period: 'month' }, errors: { 'plan-period': PLAN_CHOICE_ERRORS.period } })
  const both = normalizeChoices({ currency: 'XXX', period: 'decada' })
  assert.deepEqual(both.values, { currency: 'USD', period: 'month' }); assert.deepEqual(Object.keys(both.errors).sort(), ['plan-currency', 'plan-period'])
  for (const hostile of ['', 'usd', 'Usd', ' USD', null, undefined, 5]) assert.equal(normalizeChoices({ currency: hostile, period: 'month' }).values.currency, 'USD', String(hostile)) // «usd» en minúscula tampoco es una opción del desplegable
})

test('E366-2: serverFieldError solo toma un 400 invalid_plan con campo conocido y mensaje acotado; todo lo demás queda como «Error guardando.»', () => {
  assert.deepEqual(serverFieldError(400, { code: 'invalid_plan', field: 'currency', error: PLAN_CHOICE_ERRORS.currency }), { id: 'plan-currency', message: PLAN_CHOICE_ERRORS.currency })
  for (const [field, id] of [['slug', 'plan-slug'], ['name_es', 'plan-name-es'], ['name_en', 'plan-name-en'], ['price', 'plan-price'], ['period', 'plan-period']]) assert.equal(serverFieldError(400, { code: 'invalid_plan', field, error: 'x / y' }).id, id)
  for (const [status, body] of [[500, { code: 'invalid_plan', field: 'currency', error: 'x' }], [409, { code: 'slug_taken', field: 'slug', error: 'x' }], [400, { code: 'invalid_plan', field: 'features_es', error: 'x' }], [400, { code: 'invalid_plan', field: '__proto__', error: 'x' }],
    [400, { code: 'invalid_plan', field: 'currency' }], [400, { code: 'invalid_plan', field: 'currency', error: '' }], [400, { code: 'invalid_plan', field: 'currency', error: 'x'.repeat(301) }], [400, null], [400, 'texto'], [200, {}]]) {
    assert.equal(serverFieldError(status, body), null, JSON.stringify([status, body]).slice(0, 60))
  }
})

test('E366-2: la pantalla abre «Editar» normalizado, limpia el error al elegir y pinta el 400 del servidor bajo su campo con foco', () => {
  const screen = read('../src/pages/admin/AdminContent.tsx')
  assert.match(screen, /const \{ values, errors: legacy \} = normalizeChoices\(p\)\n\s+setForm\(\{ \.\.\.p, \.\.\.values \}\)/)
  assert.match(screen, /setErrors\(legacy\)/)
  assert.match(screen, /<SelectField id="plan-currency".*error=\{errors\['plan-currency'\] \|\| undefined\}.*setErrors\(current => \(\{ \.\.\.current, 'plan-currency': '' \}\)\)/)
  assert.match(screen, /<SelectField id="plan-period".*error=\{errors\['plan-period'\] \|\| undefined\}.*setErrors\(current => \(\{ \.\.\.current, 'plan-period': '' \}\)\)/)
  assert.match(screen, /const fieldError = serverFieldError\(r\.status, await r\.json\(\)\.catch\(\(\) => null\)\)/)
  assert.match(screen, /if \(fieldError\) \{ setErrors\(\{ \[fieldError\.id\]: fieldError\.message \}\); focusAfterSave\.current = fieldError\.id; return \}\n\s+return setMsg\('Error guardando\.'\)/)
  // el foco se da cuando el formulario vuelve a estar habilitado (mientras guarda el <fieldset> está deshabilitado y focus() no haría nada)
  assert.match(screen, /useEffect\(\(\) => \{ if \(!saving && focusAfterSave\.current\) \{ document\.getElementById\(focusAfterSave\.current\)\?\.focus\(\); focusAfterSave\.current = null \} \}, \[saving\]\)/)
  assert.ok(!/setForm\(\{ \.\.\.p \}\)/.test(screen), 'ya no se abre con el valor heredado tal cual')
})
