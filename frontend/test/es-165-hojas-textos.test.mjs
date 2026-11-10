// ES-165: los textos de «Mis hojas de vida» dicen lo que el servidor hace de verdad.
// Borrar una versión: se elimina; las evidencias creadas desde ella se conservan con su origen (ES-110) y lo derivado queda «para revisión».
// Retirar la autorización: BORRA las hojas de vida guardadas (ES-109) y lo derivado queda «para revisión»; el contexto y las evidencias ya guardados no se borran.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resumeEs, resumeEn } from '../src/context/resume/resumeCopy.ts'

const css = readFileSync(new URL('../src/context/resume/resume.css', import.meta.url), 'utf8')

test('ES-165: texto de borrar una versión (ES/EN): sin copias, irreversible, evidencias conservadas con su origen, lo derivado «para revisión»', () => {
  assert.equal(resumeEs.resume_delete_body, 'Se elimina de verdad, sin copias. No se puede deshacer. Las evidencias que ya creaste desde ella se conservan con su origen; lo derivado queda «para revisión».')
  assert.equal(resumeEn.resume_delete_body, 'It is deleted for good, with no copies. This cannot be undone. Evidence you already created from it is kept with its source; anything derived is marked “for review”.')
})

test('ES-165: coherencia del texto de retirar: menciona el BORRADO de las hojas de vida y que contexto y evidencias no se borran', () => {
  const es = resumeEs.resume_withdraw_confirm_body; const en = resumeEn.resume_withdraw_confirm_body
  assert.match(es, /^Borraremos las hojas de vida guardadas, sin copias/)
  assert.match(es, /«para revisión»/); assert.match(es, /Tu contexto y tus evidencias ya guardados no se borran\.$/)
  assert.match(en, /^We will delete the saved résumés, with no copies/)
  assert.match(en, /“for review”/); assert.match(en, /Your saved context and evidence are not deleted\.$/)
  // no vuelve la frase que contradecía el comportamiento («el archivo se conserva» / «no se borra» sobre las hojas)
  for (const text of [es, en]) assert.ok(!/se conservan? (las )?hojas|résumés? (are|is) kept/i.test(text))
})

test('ES-165: todas las claves de la pantalla existen en ES y EN', () => {
  for (const key of Object.keys(resumeEs)) assert.ok(key in resumeEn, `falta EN para ${key}`)
  for (const key of Object.keys(resumeEn)) assert.ok(key in resumeEs, `falta ES para ${key}`)
})

test('ES-165: objetivos táctiles de la pantalla (enlaces, selector de idioma y enlace de salto) de al menos 24 px', () => {
  assert.match(css, /\.rs-page main a\.elv-link \{[^}]*min-height: 24px/)
  assert.match(css, /\.rs-page \.elv-join-item \{[^}]*min-width: 32px/)
  assert.match(css, /\.rs-page \.context-skip \{[^}]*min-height: 24px/)
})
