// ES-398 (F45-1): un 409 con availability_unknown / timezone_unknown / context_incomplete NO es un conflicto de versión: la persona debe completar «Mi contexto».
// Antes la pantalla decía «La versión o el fundamento cambió…», quedaba bloqueada y sin salida. El comportamiento contra el servidor real lo mide scripts/es237-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { toScreenError } from '../src/career/serverClient.ts'
import { CareerApiError } from '../src/career/api.ts'
import { tr } from '../src/career/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const code = (error, kind) => toScreenError(error, kind).code

test('ES-398: los tres códigos de contexto incompleto se traducen a needsContext, en cualquier tipo de gesto', () => {
  for (const key of ['availability_unknown', 'timezone_unknown', 'context_incomplete']) for (const kind of ['write', 'plan', 'choose', 'read']) {
    assert.equal(code(new CareerApiError('conflict', 409, key), kind), 'needsContext', `${key} / ${kind}`)
  }
})

test('ES-398: los demás 409 y errores conservan su código (conflict, routesChanged, validate, invalidPlan, lostAck, expired)', () => {
  assert.equal(code(new CareerApiError('conflict', 409, 'version_conflict'), 'write'), 'conflict')
  assert.equal(code(new CareerApiError('conflict', 409, ''), 'write'), 'conflict')
  assert.equal(code(new CareerApiError('conflict', 409, 'transition_not_allowed'), 'plan'), 'conflict')
  assert.equal(code(new CareerApiError('conflict', 409, 'stale_basis'), 'choose'), 'routesChanged')
  assert.equal(code(new CareerApiError('invalid', 400, 'invalid_input'), 'write'), 'validate')
  assert.equal(code(new CareerApiError('rejected', 422, 'needs_availability'), 'plan'), 'invalidPlan', 'el 422 del plan queda fuera de este ticket')
  assert.equal(code(new CareerApiError('unavailable', 502, ''), 'write'), 'lostAck')
  assert.equal(code(new CareerApiError('expired', 401, ''), 'write'), 'expired')
  // un 4xx distinto de 409 con ese código NO es contexto incompleto
  assert.notEqual(code(new CareerApiError('invalid', 400, 'availability_unknown'), 'write'), 'needsContext')
})

test('ES-398: el texto nuevo existe en ES y EN, no habla de versión ni de fundamento y el enlace dice «Mi contexto» / «My context»', () => {
  for (const [lang, link] of [['es', 'Mi contexto'], ['en', 'My context']]) {
    const text = tr(lang, 'needsContext', true)
    assert.ok(text.includes(link), text); assert.ok(!/versi|fundament|version|basis/i.test(text), text); assert.equal(tr(lang, 'contextLink', true), link)
  }
  assert.equal(tr('es', 'needsContext', true), 'Falta información de tu contexto, por ejemplo tu disponibilidad semanal o tu zona horaria. Complétala en Mi contexto y vuelve a intentarlo.')
  assert.equal(tr('en', 'needsContext', true), 'Some of your context is missing, such as your weekly availability or time zone. Complete it in My context and try again.')
})

test('ES-398 (estructura): needsContext no bloquea (no es incierto), ofrece el enlace a /app/onboarding y no el botón «Recuperar»', () => {
  const shell = read('../src/career/CareerShell.tsx')
  assert.match(shell, /if \(code === 'lostAck' \|\| code === 'conflict' \|\| code === 'routesChanged'\) \{ setUncertain\(true\)/, 'solo estos tres códigos bloquean')
  assert.ok(!/code === 'needsContext'/.test(shell), 'needsContext no entra en la lista de los que bloquean')
  assert.match(shell, /error === 'needsContext' && <p><Link className="pc-link" to="\/app\/onboarding">\{t\('contextLink'\)\}<\/Link><\/p>/)
  assert.match(shell, /error !== 'validate' && error !== 'needsContext' && <button/)
})
