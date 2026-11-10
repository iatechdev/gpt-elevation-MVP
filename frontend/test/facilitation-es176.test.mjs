// ES-176: progreso por pasos en palabras (Hecho/Pendiente), formulario de revisión con contador vivo, un mensaje por campo y «Ver la versión actual»;
// y el contrato del fixture: la vista no puede recibir chats, diario, ánimo, puntuaciones privadas ni indicadores de crisis (con mutación).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFixture } from '../src/facilitation/fixture.ts'
import { copy } from '../src/facilitation/copy.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')

const forbidden = /^(mood|diary|chat|crisis|score|rating|email|phone|password|journal|emotion)/i
function forbiddenKeys(value, trail = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeys(v, `${trail}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => (forbidden.test(k) ? [`${trail}.${k}`] : []).concat(forbiddenKeys(v, `${trail}.${k}`)))
  return []
}

test('ES-176 contrato: el fixture no tiene claves de chats, diario, ánimo, puntuaciones ni crisis (y el detector las encuentra)', () => {
  const data = createFixture('normal').read()
  assert.deepEqual(forbiddenKeys(data), [])
  // mutación: si alguien agrega un campo privado, el detector lo ve
  const mutated = structuredClone(data); mutated.participants[0].mood = 4; mutated.reviews.push({ id: 'x', crisisFlag: true })
  assert.deepEqual(forbiddenKeys(mutated).sort(), ['.participants[0].mood', '.reviews[0].crisisFlag'].sort())
  // los tipos del modelo tampoco las declaran
  const types = read('../src/facilitation/fixture.ts').split('\n').filter((line) => /^export type (Participant|Material|Review|ReviewEvent|Snapshot|Command)\b/.test(line)).join('\n')
  assert.doesNotMatch(types, /\b(mood|diary|chat|crisis|score|rating|email|phone)\b/i)
})

test('ES-176 progreso: cada paso se dice con palabra (Hecho / Pendiente) en ES y EN, sin depender del color', () => {
  for (const lang of ['es', 'en']) for (const key of ['done', 'pending', 'steps', 'context', 'choice', 'submitted', 'plan', 'unknown']) assert.ok(copy[lang][`facilitation.${key}`], `${lang}.${key}`)
  assert.equal(copy.es['facilitation.done'], 'Hecho'); assert.equal(copy.en['facilitation.done'], 'Done')
  const source = read('../src/facilitation/Pages.tsx')
  assert.match(source, /const STEPS = \['context', 'choice', 'submitted', 'plan'\] as const/)
  assert.match(source, /index <= reached \? t\('done'\) : t\('pending'\)/)
  assert.match(source, /<ol className="fac-steps" aria-label=\{t\('steps'\)\}>/)
})

test('ES-176 formulario: contador vivo, aviso accesible al llegar al 90 %, error propio por campo con foco al primero y sin emojis', () => {
  const source = read('../src/facilitation/Pages.tsx')
  assert.match(source, /\{value\.length\} \/ \{max\} \{t\('characters'\)\}/)
  assert.match(source, /aria-live="polite">\{near \?/); assert.match(source, /value\.length >= max \* 0\.9/)
  assert.match(source, /role="alert" className="fac-error">\{t\(problem\)\}/)
  assert.match(source, /const first = FIELD_ORDER\.find/); assert.match(source, /setFocusField\(first\)/)
  assert.match(source, /<label htmlFor=\{base\}>/)
  assert.doesNotMatch(source, /\p{Extended_Pictographic}/u)
  for (const lang of ['es', 'en']) for (const key of ['characters', 'required', 'tooLong', 'controlChars', 'selectEvidence']) assert.ok(copy[lang][`facilitation.${key}`], `${lang}.${key}`)
})

test('ES-176 conflicto: «Ver la versión actual» muestra la vigente, conserva el texto y no pasa por «Cargando…» (el formulario no se desmonta)', () => {
  const source = read('../src/facilitation/Pages.tsx'); const preview = read('../src/facilitation/FacilitationPreview.tsx')
  assert.match(source, /function viewCurrent\(\)/); assert.match(source, /function adoptCurrentVersion\(\)/)
  assert.match(source, /setDraft\(\{ \.\.\.draft, materialVersion: currentVersion, evidenceRefs: \[\] \}\)/) // el texto (observación y límites) se conserva
  assert.match(source, /<RecordForm key=\{m\.id\} material=\{m\}/) // la clave ya no incluye la versión: cambiar de versión no reinicia el borrador
  const sync = preview.match(/const sync = [^\n]*/)[0]
  assert.match(sync, /setSnapshot\(service\.read\(\)\)/); assert.doesNotMatch(sync, /setLoading/)
  for (const lang of ['es', 'en']) for (const key of ['viewCurrent', 'useCurrent', 'currentIs', 'draftUses']) assert.ok(copy[lang][`facilitation.${key}`], `${lang}.${key}`)
})

test('ES-176: la vista previa sigue marcada como sintética y sin API (franja visible)', () => {
  assert.match(copy.es['facilitation.preview'], /datos sintéticos/); assert.match(copy.en['facilitation.preview'], /synthetic data/)
  const preview = read('../src/facilitation/FacilitationPreview.tsx')
  assert.match(preview, /className="fac-banner"/); assert.match(preview, /VITE_ENABLE_FACILITATION_PREVIEW/)
  assert.doesNotMatch(read('../src/facilitation/Pages.tsx'), /fetch\(/)
})
