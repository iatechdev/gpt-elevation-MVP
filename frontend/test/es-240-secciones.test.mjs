// ES-240: «Mi profesional» pide perfil y sesiones por separado, en paralelo, cancela al salir y tiene un error con «Reintentar» por sección (textos ES/EN).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { myProfessionalEs, myProfessionalEn } from '../src/pages/myProfessionalCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/pages/MyTherapist.tsx')

test('ES-240: dos peticiones independientes (perfil y sesiones), cada una con AbortController y sin la lectura combinada', () => {
  assert.ok(page.includes('/api/sessions/user/my-therapist/profile'))
  assert.ok(page.includes('/api/sessions/user/my-therapist/sessions'))
  assert.ok(!/\/api\/sessions\/user\/my-therapist`/.test(page), 'ya no usa la lectura combinada')
  assert.equal((page.match(/new AbortController\(\)/g) ?? []).length, 2)
  assert.equal((page.match(/return \(\) => controller\.abort\(\)/g) ?? []).length, 2)
  assert.equal((page.match(/signal: controller\.signal/g) ?? []).length, 2)
  assert.equal((page.match(/if \(!controller\.signal\.aborted\) set(Profile|Sessions)\(/g) ?? []).length, 4) // listo y error, de cada una
})

test('ES-240: cada sección tiene su estado propio y el error de una no oculta la otra', () => {
  assert.match(page, /type Status = 'loading' \| 'ok' \| 'error'/)
  assert.match(page, /\{profile\.status === 'error' && \(\s*<div role="alert"/)
  assert.match(page, /\{sessions\.status === 'error' && \(\s*<div role="alert">/)
  assert.ok(page.includes("{sessions.status === 'ok' && sessions.past.length > 0 && ("))
  assert.ok(page.includes('{noProfessional ? ('), 'sin profesional (perfil leído y vacío) solo se muestra el aviso de siempre')
  assert.ok(page.includes('onUnlinked={reloadAll}'), 'al desvincularse se vuelven a pedir las dos secciones')
})

test('ES-240: textos de error por sección en ES y EN, sin vocabulario anterior', () => {
  assert.equal(myProfessionalEs.mp_load_error, 'No pudimos cargar la información de tu profesional.')
  assert.equal(myProfessionalEs.mp_sessions_error, 'No pudimos cargar tus sesiones.')
  assert.equal(myProfessionalEn.mp_sessions_error, 'We could not load your sessions.')
  assert.deepEqual(Object.keys(myProfessionalEs).sort(), Object.keys(myProfessionalEn).sort())
})
