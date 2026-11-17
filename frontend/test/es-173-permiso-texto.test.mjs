// ES-173: texto del permiso de «Tu opinión» (aprobado por Mauricio el 17-nov-2026, borrador 12288 de UX/UI-Claude, «sin revisión legal»), ES/EN, visible en la pantalla, sin diálogo.
// Reglas: los textos salen del catálogo pilot/copy.ts; el responsable y el contacto de datos NO se publican con el marcador «[POR COMPLETAR]» (siguen siendo bloqueo de LANZAMIENTO, junto al aviso de ES-301);
// ningún marcador de borrador llega a la pantalla; las afirmaciones coinciden con lo probado (retirar NO borra; borrar = «Retirar mi respuesta»; agregados solo con 5 o más personas).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { copy } from '../src/pilot/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const keys = ['grantTitle', 'grantText', 'grantIfTitle', 'grantIf1', 'grantIf2', 'grantIf3', 'grantIf4', 'grantIf5', 'grantAfterTitle', 'grantAfter1', 'grantAfter2', 'grantAfter3', 'grantNote', 'grantDraft', 'grant']

test('ES-173 permiso: todas las claves existen en ES y EN, sin marcadores de borrador ni responsable/contacto publicados', () => {
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.ok(typeof copy[lang][key] === 'string' && copy[lang][key].length > 3, `${lang}.${key}`)
    const all = keys.map(key => copy[lang][key]).join(' ')
    assert.doesNotMatch(all, /POR COMPLETAR|TO BE COMPLETED|VERIFICAR|VERIFY|POR REVISAR|FOR LEGAL REVIEW|razón social|legal name|Responsable de los datos|Data controller/i, lang)
  }
})

test('ES-173 permiso: conserva los textos vigentes y afirma lo probado (5 o más personas, retirar no borra, borrar = «Retirar mi respuesta», sin promesas)', () => {
  assert.equal(copy.es.grantTitle, 'Permiso para guardar tu opinión'); assert.equal(copy.es.grant, 'Dar permiso')
  assert.equal(copy.en.grantTitle, 'Permission to save your feedback'); assert.equal(copy.en.grant, 'Give permission')
  assert.match(copy.es.grantText, /independiente del permiso de investigación/); assert.match(copy.en.grantText, /separate from the research permission/)
  assert.match(copy.es.grantIf3, /5 o más personas/); assert.match(copy.en.grantIf3, /5 or more people/)
  assert.match(copy.es.grantIf4, /mejorar el piloto/); assert.match(copy.en.grantIf4, /improve the pilot/)
  assert.match(copy.es.grantAfter2, /no borra/); assert.match(copy.en.grantAfter2, /does not delete/)
  assert.match(copy.es.grantAfter3, /«Retirar mi respuesta»/); assert.match(copy.en.grantAfter3, /“Withdraw my response”/)
  assert.match(copy.es.grantIf1, new RegExp(`«${copy.es.skipQuestion}»`)); assert.match(copy.en.grantIf1, new RegExp(`“${copy.en.skipQuestion}”`)) // el nombre del botón existente
  assert.doesNotMatch(copy.es.grantAfter2 + copy.es.grantNote, /se borra|garantiz|diagnóstic|empleo|curaci/i)
  assert.match(copy.es.grantNote, /no es una evaluación/); assert.match(copy.en.grantNote, /not an assessment/)
  assert.match(copy.es.grantDraft, /sin revisión legal/i); assert.match(copy.en.grantDraft, /without legal review/i)
})

test('ES-173 permiso: la pantalla lo muestra VISIBLE (sin diálogo) con las dos listas y solo cuando el permiso falta; el diálogo existente es el de retirar', () => {
  const page = read('../src/pilot/FeedbackPage.tsx')
  for (const key of keys.filter(key => key !== 'grant')) assert.ok(page.includes(`c.${key}`), key)
  assert.match(page, /saved\.permission === 'missing'\s*\?\s*<Card as="div" className="prg-question">/)
  assert.equal((page.match(/<Dialog\b/g) ?? []).length, 2); assert.ok(!page.includes('grantDialog'))
  const css = read('../src/progress/progress.css'); assert.match(css, /\.prg-grant-list/); assert.doesNotMatch(css.slice(css.indexOf('.prg-grant-list')), /#[0-9a-fA-F]{3,6}\b/)
})
