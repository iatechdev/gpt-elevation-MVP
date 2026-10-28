import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = file => fs.readFileSync(new URL('../src/exercises/' + file, import.meta.url), 'utf8')
async function load(file, replacements = []) {
  let code = ts.transpileModule(source(file), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
const catalog = JSON.parse(fs.readFileSync(new URL('../../shared/companion-exercises.json', import.meta.url), 'utf8'))
const { publicationEnabled, exercisesEnabled } = await load('publication.ts', [['import.meta.env.VITE_ENABLE_COMPANION_EXERCISES', 'undefined']])
const { exerciseEs, exerciseEn } = await load('copy.ts')
test('ES-16: publication is disabled by default and requires literal true, never truthy coercion', () => {
  assert.equal(exercisesEnabled, false)
  for (const value of [undefined, null, false, true, 1, '1', 'TRUE', 'false', ' true ']) assert.equal(publicationEnabled(value), false)
  assert.equal(publicationEnabled('true'), true)
})
test('ES-16: the three stable exercises have ES/EN purpose, one question and editorial time', () => {
  assert.deepEqual(catalog.exercises.map(e => e.key), ['reflection', 'values', 'contribution'])
  for (const exercise of catalog.exercises) {
    assert.deepEqual(exercise.minutes, [3, 5])
    for (const lang of ['es', 'en']) {
      for (const field of ['title', 'purpose', 'question', 'help']) assert.ok(exercise[lang][field].trim())
      assert.equal(exercise[lang].question.match(/\?/g)?.length, 1)
    }
  }
})
test('ES-16: no invented editorial approval and no individual/user fields in the catalog', () => {
  assert.equal(catalog.version, 1); assert.equal(catalog.reviewStatus, 'draft')
  assert.deepEqual(Object.keys(catalog).sort(), ['exercises', 'reviewStatus', 'version'])
  for (const exercise of catalog.exercises) assert.deepEqual(Object.keys(exercise).sort(), ['en', 'es', 'key', 'minutes'])
})
test('ES-16: ES/EN UI keys match; closing and copy failure never claim server persistence', () => {
  assert.deepEqual(Object.keys(exerciseEs), Object.keys(exerciseEn)); assert.ok(Object.values(exerciseEs).every(Boolean)); assert.ok(Object.values(exerciseEn).every(Boolean))
  assert.equal(exerciseEs['exercise.private'], 'Estas notas no se guardan ni se comparten.')
  assert.doesNotMatch(exerciseEn['exercise.closed'], /\?/)
  assert.ok(exerciseEn['exercise.copy_error'].includes('manually'))
})
