// ES-248: el permiso de lectura de hojas de vida (resume_ai_reading) con resultado incierto. Retirarlo BORRA las hojas (ES-109): si la respuesta se pierde, se relee antes de decir nada.
// Estructura, textos y el cliente (con fetch simulado); el comportamiento real (respuesta perdida contra servidor y base reales) lo mide scripts/es248-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { checkResumeConsent, setResumeConsent } from '../src/context/resume/resumeApi.ts'
import { resumeEs, resumeEn } from '../src/context/resume/resumeCopy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('../src/context/resume/ResumesPage.tsx')
const starter = read('../src/context/resume/ResumeStarter.tsx')

function stubFetch(handler) { globalThis.fetch = async (...args) => handler(...args); globalThis.localStorage = { getItem: () => 'token', setItem() {}, removeItem() {} } }
const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('ES-248 cliente: setResumeConsent distingue ok / rechazo definitivo / incierto, y checkResumeConsent distingue «no autorizado» de «no se pudo leer»', async () => {
  stubFetch(() => reply(200, { status: 'revoked' })); assert.equal(await setResumeConsent(false), 'ok')
  stubFetch(() => reply(409, { code: 'x' })); assert.equal(await setResumeConsent(false), 'rejected')
  stubFetch(() => reply(403, {})); assert.equal(await setResumeConsent(true), 'rejected')
  stubFetch(() => reply(500, {})); assert.equal(await setResumeConsent(false), 'uncertain')
  stubFetch(() => reply(503, {})); assert.equal(await setResumeConsent(true), 'uncertain')
  stubFetch(() => { throw new TypeError('Failed to fetch') }); assert.equal(await setResumeConsent(false), 'uncertain')
  stubFetch(() => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }); assert.equal(await setResumeConsent(false), 'uncertain')
  stubFetch(() => reply(200, { consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] })); assert.equal(await checkResumeConsent(), 'granted')
  stubFetch(() => reply(200, { consents: [{ purpose: 'resume_ai_reading', status: 'revoked' }] })); assert.equal(await checkResumeConsent(), 'not_granted')
  stubFetch(() => reply(200, { consents: [] })); assert.equal(await checkResumeConsent(), 'not_granted')
  stubFetch(() => reply(500, {})); assert.equal(await checkResumeConsent(), 'unknown')
  stubFetch(() => { throw new TypeError('Failed to fetch') }); assert.equal(await checkResumeConsent(), 'unknown')
})

test('ES-248 «Retirar mi autorización»: solo un rechazo definitivo dice «error»; lo incierto se relee y «Comprobar» sigue disponible', () => {
  const withdraw = page.slice(page.indexOf('async function verifyWithdraw'), page.indexOf('function fields') > 0 ? page.indexOf('return (') : undefined)
  assert.match(withdraw, /if \(result === 'rejected'\) \{ setAlert\(t\('resume_withdraw_error'\)\); return \}/)
  assert.match(withdraw, /if \(result === 'uncertain'\) \{ setConfirm\(null\); await verifyWithdraw\(\); return \}/)
  assert.match(withdraw, /if \(real === 'unknown'\) \{ setUnsure\(true\); setAlert\(t\('resume_withdraw_unsure'\)\); return \}/)
  assert.match(withdraw, /if \(real === 'not_granted'\) \{[^}]*setMessage\(t\('resume_withdrawn_live'\)\); await load\(\)/)
  assert.match(withdraw, /setAlert\(t\('resume_withdraw_not_seen'\)\); await load\(\)/)
  assert.match(page, /\{unsure && <button type="button" className="elv-btn" disabled=\{busy\} onClick=\{\(\) => void verifyWithdraw\(\)\}>\{t\('resume_check'\)\}<\/button>\}/)
})

test('ES-248 «autorizar al analizar»: si se pierde la respuesta se relee el permiso antes de decir «falta autorización», y la autorización sigue siendo explícita en cada análisis', () => {
  assert.match(starter, /let allowed = await setResumeConsent\(true\)/)
  assert.match(starter, /if \(allowed === 'uncertain'\) \{ const real = await checkResumeConsent\(\)/)
  assert.match(starter, /setError\(allowed === 'uncertain' \? 'network' : 'consent_required'\)/)
  // no se lee el permiso anterior para saltarse la casilla: la casilla siempre parte desmarcada (ES-109)
  assert.match(starter, /useState\(false\) \/\/ siempre parte desmarcada/)
  assert.doesNotMatch(starter, /readResumeConsent/)
})

test('ES-248 textos ES/EN: el aviso incierto dice que las hojas pueden estar ya borradas; sin promesas', () => {
  assert.match(resumeEs.resume_withdraw_unsure, /Puede que tus hojas de vida ya se hayan borrado/)
  assert.match(resumeEn.resume_withdraw_unsure, /Your résumés may already have been deleted/)
  assert.match(resumeEs.resume_withdraw_not_seen, /tus hojas de vida siguen guardadas/)
  assert.match(resumeEn.resume_withdraw_not_seen, /still saved/)
  assert.equal(resumeEs.resume_check, 'Comprobar'); assert.equal(resumeEn.resume_check, 'Check')
  assert.deepEqual(Object.keys(resumeEs).sort(), Object.keys(resumeEn).sort())
})
