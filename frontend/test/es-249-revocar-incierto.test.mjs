// ES-249: «Revocar todos» del mapa con resultado incierto. Cliente (fetch simulado), estructura y textos; el comportamiento real lo mide scripts/es249-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { revokeBridge, ConsentError } from '../src/skill-map/consent.ts'
import { skillMapEs, skillMapEn } from '../src/skill-map/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('../src/pages/SkillMapPage.tsx')

test('ES-249 cliente: corte, tiempo agotado y 5xx son «unsure»; 4xx sigue siendo error definitivo; 401 expira', async () => {
  const reason = fetcher => revokeBridge({ baseUrl: 'x', token: 't', fetcher }).then(() => 'ok', error => (error instanceof ConsentError ? error.reason : 'other'))
  assert.equal(await reason(async () => new Response('{}', { status: 200 })), 'ok')
  assert.equal(await reason(async () => { throw new TypeError('Failed to fetch') }), 'unsure')
  assert.equal(await reason(async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }), 'unsure')
  assert.equal(await reason(async () => new Response('{}', { status: 500 })), 'unsure')
  assert.equal(await reason(async () => new Response('{}', { status: 503 })), 'unsure')
  assert.equal(await reason(async () => new Response('{}', { status: 409 })), 'error')
  assert.equal(await reason(async () => new Response('{}', { status: 401 })), 'expired')
})

test('ES-249 pantalla: lo incierto se relee; solo «revoked» completa el flujo y «Comprobar» sigue disponible', () => {
  assert.match(page, /if \(error instanceof ConsentError && error\.reason === 'unsure'\) \{ await verify\(\); return \}/)
  assert.match(page, /if \(real === 'revoked'\) finish\(\)/)
  assert.match(page, /else if \(real === 'granted' \|\| real === 'outdated'\) \{ setBridge\(real\); setRevoke\('not_seen'\) \}/)
  assert.match(page, /else setRevoke\('unsure'\)/)
  assert.match(page, /\{revoke === 'unsure' && <button type="button" className="elv-btn" ref=\{checkButton\} onClick=\{\(\) => void verify\(\)\}>\{t\('skill_map\.revoke_check'\)\}<\/button>\}/)
  assert.match(page, /const finish = \(\) => \{ setBridge\('revoked'\); setRevoke\('done'\); void reloadMap\(\) \}/)
})

// E249-1: el foco se coloca tras renderizar (efecto sobre `revoke`), no con un setTimeout que corría con el botón aún deshabilitado
test('ES-249 foco: se coloca en un efecto tras renderizar; «Comprobar» si queda sin confirmar; sin setTimeout para el resultado', () => {
  assert.match(page, /if \(revoke === 'unsure'\) \{ checkButton\.current\?\.focus\(\); return \}/)
  assert.match(page, /if \(button && !button\.disabled\) button\.focus\(\); else document\.getElementById\('skill-map-main'\)\?\.focus\(\)/)
  const verifyAndConfirm = page.slice(page.indexOf('const verify = async'), page.indexOf('// Never paint a response'))
  assert.doesNotMatch(verifyAndConfirm, /setTimeout/)
})

test('ES-249 textos ES/EN: el aviso incierto no afirma nada y las claves coinciden', () => {
  assert.match(skillMapEs['skill_map.revoke_unsure'], /No pudimos confirmar la retirada/)
  assert.match(skillMapEn['skill_map.revoke_unsure'], /We could not confirm the withdrawal/)
  assert.match(skillMapEs['skill_map.revoke_not_seen'], /sigue cruzando/)
  assert.equal(skillMapEs['skill_map.revoke_check'], 'Comprobar'); assert.equal(skillMapEn['skill_map.revoke_check'], 'Check')
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
})
