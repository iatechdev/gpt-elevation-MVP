import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/exercise-admin/form.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { emptyExerciseForm, formFromContent, contentFromForm, exerciseFormChanged, validateExerciseForm } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

test('ES-194: los borradores admiten campos vacíos y normalizan los textos como el servidor', () => {
  const form = emptyExerciseForm()
  form.es.title = '  Título  '
  const content = contentFromForm(form)
  assert.equal(content.es.title, 'Título')
  assert.equal(content.en.help, '')
  assert.equal(content.minutes, null)
  assert.deepEqual(contentFromForm(formFromContent(content)), content)
})

test('ES-194: duración vacía o dos enteros entre 1 y 60, en orden', () => {
  for (const [min, max] of [['', '3'], ['0', '3'], ['3', '61'], ['5', '4'], ['2.5', '3'], ['-1', '3'], ['3', '']]) {
    const form = { ...emptyExerciseForm(), minutesMin: min, minutesMax: max }
    assert.equal(validateExerciseForm(form).minutes, 'minutes')
    assert.throws(() => contentFromForm(form))
  }
  const form = { ...emptyExerciseForm(), minutesMin: '1', minutesMax: '60' }
  assert.deepEqual(contentFromForm(form).minutes, [1, 60])
})

test('ES-194: límites de texto y rechazo de marcado y caracteres de control', () => {
  const form = emptyExerciseForm()
  form.es.title = 'x'.repeat(121)
  form.en.purpose = 'x'.repeat(301)
  form.es.question = '<script>'
  form.en.help = 'a\u0001b'
  assert.deepEqual(validateExerciseForm(form), {
    'es.title': 'tooLong', 'es.question': 'markup', 'en.purpose': 'tooLong', 'en.help': 'control',
  })
  form.es.title = 'x'.repeat(120)
  form.en.purpose = 'x'.repeat(300)
  form.es.question = 'Texto\npermitido'
  form.en.help = 'Texto\tpermitido'
  assert.deepEqual(validateExerciseForm(form), {})
})

test('ES-194: cualquier cambio del formulario se detecta incluso si es solo espacio', () => {
  const a = emptyExerciseForm()
  const b = emptyExerciseForm()
  assert.equal(exerciseFormChanged(a, b), false)
  b.en.help = ' '
  assert.equal(exerciseFormChanged(a, b), true)
  b.en.help = ''
  b.minutesMax = '2'
  assert.equal(exerciseFormChanged(a, b), true)
})
