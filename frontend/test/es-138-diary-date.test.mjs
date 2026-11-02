// ES-138: diario «Nueva entrada» con fecha de hoy por defecto y errores propios ES/EN asociados a cada campo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/space/copy.ts'
import { validDate } from '../src/space/api.ts'

const page = fs.readFileSync(new URL('../src/space/JournalPage.tsx', import.meta.url), 'utf8')

test('ES-138 textos: los tres errores existen en ES y EN, sin tuteo roto ni voseo', () => {
  for (const key of ['dateMissing', 'dateInvalid', 'contentMissing']) {
    assert.ok(copy.es[key]?.trim() && copy.en[key]?.trim(), key)
    assert.notEqual(copy.es[key], copy.en[key], key)
    assert.doesNotMatch(copy.es[key], /\b(vos|elegí|escribí|tenés)\b/i, key)
  }
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
})

test('ES-138 formulario: sin burbuja nativa, error propio por campo con aria y foco en el primero con error', () => {
  assert.match(page, /<form noValidate/)
  for (const field of ['date', 'content']) {
    assert.match(page, new RegExp(`aria-invalid=\{!!errors\.${field}\}`))
    assert.match(page, new RegExp(String.raw`aria-describedby=\{errors\.${field} \? 'entry-${field}-error'`))
    assert.match(page, new RegExp(`id="entry-${field}-error" className="space-error" role="alert"`))
  }
  assert.match(page, /getElementById\(found\.date \? 'entry-date' : 'entry-content'\)\?\.focus\(\)/)
})

test('ES-138 fecha por defecto: la entrada nueva arranca con hoy (local) y eso no cuenta como cambio sin guardar', () => {
  assert.match(page, /useState\(isNew \? defaultDate : ''\)/)
  assert.match(page, /saved\?\.date \|\| \(isNew \? defaultDate : ''\)/)
  assert.match(page, /getTimezoneOffset\(\) \* 60000/)
  const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  assert.ok(validDate(local)); assert.equal(validDate(''), false); assert.equal(validDate('2999-01-01'), false)
})
