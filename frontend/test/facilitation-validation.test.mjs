// QA-35 obs. 2: el texto se valida en la lógica (vacío, longitud, caracteres de control), no solo con maxLength del navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFixture, PreviewError } from '../src/facilitation/fixture.ts'
import { LIMITS, textProblem } from '../src/facilitation/validation.ts'
import { copy } from '../src/facilitation/copy.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const review = (over = {}) => ({ kind: 'review', participantId: 'synthetic-A', shareId: 'synthetic-share-A', materialVersion: 1, evidenceRefs: ['synthetic-evidence-A'], observation: 'Observación sintética válida', limits: 'Límites sintéticos válidos', locale: 'es', ...over })
const rejects = (fn) => assert.throws(fn, error => error instanceof PreviewError && error.code === 'invalid')

test('QA-35: textProblem distingue vacío, caracteres de control y longitud', () => {
  assert.equal(textProblem('Texto válido', 20), null)
  assert.equal(textProblem('línea 1\nlínea 2\r\n\tsangrado', 100), null) // salto, retorno y tabulación están permitidos
  for (const empty of ['', '   ', '\n\t ', undefined, null, 42]) assert.equal(textProblem(empty, 10), 'required', String(empty))
  for (const bad of ['a\u0000b', 'a\u0007', '\u001bx', 'x\u007f', 'a\u000bb', 'a\u000cb', '\u0001']) assert.equal(textProblem(bad, 50), 'controlChars', JSON.stringify(bad))
  assert.equal(textProblem('x'.repeat(10), 10), null)
  assert.equal(textProblem('x'.repeat(11), 10), 'tooLong')
  assert.equal(textProblem('\u0000'.repeat(3), 10), 'controlChars') // solo control: es un carácter no permitido, no «vacío»
})

test('QA-35: los límites de la lógica son los de los campos de la interfaz', () => {
  assert.deepEqual({ ...LIMITS }, { observation: 4000, limits: 2000, reason: 2000, response: 2000 })
  const pages = read('../src/facilitation/Pages.tsx')
  for (const [field, max] of Object.entries(LIMITS)) assert.match(pages, new RegExp(`textField\\('${field}', '${field}', LIMITS\\.${field},`), `${field} ${max}`)
})

test('QA-35: el servicio simulado rechaza texto vacío, con caracteres de control o demasiado largo en revisión, objeción y respuesta', () => {
  for (const [name, over] of [
    ['observación con control', { observation: 'texto\u0000oculto' }], ['límites con DEL', { limits: 'texto\u007f' }],
    ['observación demasiado larga', { observation: 'x'.repeat(LIMITS.observation + 1) }], ['límites demasiado largos', { limits: 'x'.repeat(LIMITS.limits + 1) }],
    ['observación solo control', { observation: '\u0001\u0002' }], ['límites vacíos', { limits: '   ' }],
  ]) {
    const f = createFixture()
    rejects(() => f.apply('request-bad-' + name.length, review(over), 0, 'reviewer'))
    assert.equal(f.current().reviews.length, 0, name)
  }
  const f = createFixture(); f.apply('request-ok-0001', review(), 0, 'reviewer')
  const reviewId = f.current().reviews[0].id
  for (const reason of ['', 'motivo\u0000', 'x'.repeat(LIMITS.reason + 1)]) rejects(() => f.apply('request-obj-' + reason.length, { kind: 'objection', reviewId, reason, locale: 'es' }, 1, 'participant'))
  assert.equal(f.current().events.length, 0)
})

test('QA-35: el máximo exacto se acepta', () => {
  const f = createFixture()
  f.apply('request-max-0001', review({ observation: 'x'.repeat(LIMITS.observation), limits: 'y'.repeat(LIMITS.limits) }), 0, 'reviewer')
  assert.equal(f.current().reviews.length, 1)
})

test('QA-35: los dos mensajes nuevos existen en ES y EN, distintos entre sí', () => {
  for (const key of ['required', 'tooLong', 'controlChars']) {
    const es = copy.es[`facilitation.${key}`], en = copy.en[`facilitation.${key}`]
    assert.ok(es && en && es !== en, key)
  }
  assert.notEqual(copy.es['facilitation.tooLong'], copy.es['facilitation.controlChars'])
})

test('QA-35: la interfaz usa textProblem y muestra el mensaje del problema (no siempre «required»)', () => {
  const pages = read('../src/facilitation/Pages.tsx')
  assert.match(pages, /textProblem\(draft\.observation, LIMITS\.observation\)/)
  assert.match(pages, /setError\(noEvidence \? 'selectEvidence' : problem/)
  assert.match(pages, /aria-invalid=\{invalid && textProblem\(value, max\) !== null\}/)
})
