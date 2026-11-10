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
const { exerciseEs, exerciseEn } = await load('copy.ts')
// ES-170 (decisión 7 del PO): la bandera de compilación se retiró; la pantalla pide los ejercicios PUBLICADOS al servidor (ES-194) y ya no lee el archivo empaquetado.
test('ES-170: la pantalla de ejercicios no usa la bandera ni el JSON empaquetado; lee GET /api/exercises', () => {
  const page = source('ExercisePage.tsx')
  assert.equal(fs.existsSync(new URL('../src/exercises/publication.ts', import.meta.url)), false)
  assert.doesNotMatch(page, /companion-exercises|exercisesEnabled|VITE_ENABLE_COMPANION_EXERCISES/)
  assert.match(page, /\/api\/exercises\$\{path\}/)
  assert.doesNotMatch(fs.readFileSync(new URL('../src/space/SpaceNav.tsx', import.meta.url), 'utf8'), /VITE_ENABLE_COMPANION_EXERCISES/)
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
