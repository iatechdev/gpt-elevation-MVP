// ES-327 (E304-1): borrar una versión de hoja de vida con la respuesta perdida RELEE antes de declarar (patrón de ES-248 al retirar la autorización).
// Estructura y contrato de deleteResume; el comportamiento con respuesta perdida real lo mide scripts/es327-borrado-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const api = read('../src/context/resume/resumeApi.ts'); const page = read('../src/context/resume/ResumesPage.tsx')

test('ES-327: deleteResume distingue borrado, rechazo definitivo e incierto (corte, tiempo agotado, 5xx, 404)', () => {
  assert.match(api, /export type DeleteResult = 'deleted' \| 'rejected' \| 'uncertain'/)
  assert.match(api, /response\.ok \? 'deleted' : response\.status >= 500 \|\| response\.status === 404 \? 'uncertain' : 'rejected'/)
  assert.match(api, /catch \{ return 'uncertain' \}/); assert.match(api, /AbortSignal\.timeout\(15000\)/)
})

test('ES-327: si el borrado es incierto la pantalla relee la lista y dice lo que hay; si se rechaza no relee', () => {
  const body = page.slice(page.indexOf('async function confirmDelete'), page.indexOf('// ES-248: retirar'))
  assert.match(body, /result === 'rejected'\) \{ setBusy\(false\); setAlert\(t\('resume_delete_error'\)\); return \}/)
  assert.match(body, /const fresh = await listResumes\(\)/)
  assert.match(body, /if \(!fresh\) \{ apply\(null, consent\); return \}/) // sin poder releer no se afirma nada: pantalla de error con «Reintentar»
  assert.match(body, /fresh\.resumes\.some\(row => row\.id === item\.id\)\) setAlert\(t\('resume_delete_error'\)\); else setMessage\(t\('resume_deleted_live'\)\)/)
  assert.ok(!/const ok = await deleteResume/.test(page), 'ya no se trata el resultado como un booleano')
})
