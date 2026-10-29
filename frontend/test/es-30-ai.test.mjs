import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
const moduleUrl = (file, replace = []) => {
  let source = readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const [a, b] of replace) source = source.replace(a, b)
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const selfUrl = moduleUrl('../src/skill-map/selfAssessApi.ts')
const api = await import(moduleUrl('../src/skill-map/aiProposalApi.ts', [["from './selfAssessApi'", `from '${selfUrl}'`]]))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))
const read = f => readFileSync(new URL(f, import.meta.url), 'utf8')

const ref = (id, quote) => ({ evidenceId: id, version: 1, ...(quote ? { quote } : {}) })
const prop = (skillKey, level, extra = {}) => ({ skillKey, level, evidenceRefs: level === null ? [] : [ref(1, 'texto literal')], rationale: 'Razón', confidence: level === null ? null : 'medium', confidenceReason: level === null ? null : { es: 'a', en: 'b' }, ...extra })
const payload = (proposals, warnings = []) => ({ proposals, warnings, discarded: 0, token: 'tok.firmado', expiresAt: '2026-10-29T12:10:00.000Z' })
const reply = (status, body = {}) => async () => new Response(JSON.stringify(body), { status })

test('ES-30 IA: una respuesta con otra forma nunca se pinta como propuesta', () => {
  assert.equal(api.parseProposed(payload([prop('a', 3), prop('b', null)], [{ skillKey: 'a', code: 'level_capped' }])).proposals.length, 2)
  for (const bad of [null, {}, payload([prop('a', 5)]), payload([prop('a', 3, { confidence: 'enorme' })]), { ...payload([]), token: 7 }, { ...payload([]), expiresAt: 'ayer' },
    payload([prop('a', 3, { evidenceRefs: [{ evidenceId: 'x', version: 1 }] })])]) assert.throws(() => api.parseProposed(bad), e => e instanceof api.AiProposalError, JSON.stringify(bad).slice(0, 60))
  assert.deepEqual(api.parseProposed({ ...payload([]), warnings: [{ skillKey: 'a', code: 'rara' }, { skillKey: 'b', code: 'no_declared_autonomy' }] }).warnings, [{ skillKey: 'b', code: 'no_declared_autonomy' }])
})
test('ES-30 IA: solo se puede aceptar, bajar, dejar sin evaluar o no guardar; nunca subir', () => {
  assert.deepEqual(api.choicesFor(prop('a', 3), false), ['accept', '2', '1', 'null', 'skip'])
  assert.deepEqual(api.choicesFor(prop('a', 1), false), ['accept', 'null', 'skip'])
  assert.deepEqual(api.choicesFor(prop('a', null), false), ['skip'])
  assert.deepEqual(api.choicesFor(prop('a', null), true), ['skip', 'null'])
  assert.equal(api.defaultChoice(prop('a', 3)), 'accept'); assert.equal(api.defaultChoice(prop('a', null)), 'skip')
  assert.equal(api.finalLevel(prop('a', 3), 'accept'), 3); assert.equal(api.finalLevel(prop('a', 3), '2'), 2); assert.equal(api.finalLevel(prop('a', 3), 'null'), null)
  assert.equal(api.finalLevel(prop('a', 3), 'skip'), undefined)
  assert.equal(api.finalLevel(prop('a', 2), '3'), undefined, 'subir no existe'); assert.equal(api.finalLevel(prop('a', null), '1'), undefined)
})
test('ES-30 IA: el cuerpo de confirmar lleva las propuestas EXACTAS (sin citas ni confianza), solo lo aceptado y los cambios a la baja', () => {
  const proposals = [prop('a', 3), prop('b', 2), prop('c', null), prop('d', 4)]
  const body = api.buildConfirmBody({ requestId: 'req-12345678', token: 'tok.firmado', proposals, choices: { a: 'accept', b: '1', c: 'skip', d: 'null' } })
  assert.deepEqual(body.accept, ['a', 'b', 'd']); assert.deepEqual(body.overrides, { b: 1, d: null })
  assert.equal(body.proposals.length, 4); assert.deepEqual(body.proposals[0], { skillKey: 'a', level: 3, evidenceRefs: [{ evidenceId: 1, version: 1 }], rationale: 'Razón' })
  assert.equal(JSON.stringify(body).includes('texto literal'), false); assert.equal('confidence' in body.proposals[0], false)
  const plain = api.buildConfirmBody({ requestId: 'req-12345678', token: 't', proposals: [prop('a', 3)], choices: {} })
  assert.equal('overrides' in plain, false, 'aceptar sin cambios no manda overrides'); assert.deepEqual(plain.accept, ['a'])
  assert.throws(() => api.buildConfirmBody({ requestId: 'req-12345678', token: 't', proposals: [prop('a', 3)], choices: { a: 'skip' } }), e => e.reason === 'invalid', 'nada aceptado')
  assert.throws(() => api.buildConfirmBody({ requestId: 'req-12345678', token: 't', proposals: [prop('a', 2)], choices: { a: '3' } }), e => e.reason === 'invalid', 'subir')
})
test('ES-30 IA: el cliente llama solo a /api/skill-map/proposals con el token propio, sin id de persona; hasta 8 capacidades', async () => {
  const calls = []
  const fetcher = async (url, options) => { calls.push([url, options]); return new Response(JSON.stringify(payload([prop('a', 3)])), { status: 200 }) }
  const got = await api.requestProposals({ baseUrl: 'https://api.example.invalid/', token: 'sintetico', skillKeys: ['a', 'a', 'b'], locale: 'es', fetcher })
  assert.equal(got.proposals[0].skillKey, 'a')
  const [url, options] = calls[0]
  assert.equal(url, 'https://api.example.invalid/api/skill-map/proposals'); assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store')
  assert.equal(options.headers.Authorization, 'Bearer sintetico'); assert.deepEqual(JSON.parse(options.body), { skillKeys: ['a', 'b'], locale: 'es' })
  assert.equal(JSON.stringify(calls).includes('userId'), false)
  await assert.rejects(api.requestProposals({ baseUrl: 'x', token: 't', skillKeys: [], locale: 'es', fetcher }), e => e.reason === 'invalid')
  await assert.rejects(api.requestProposals({ baseUrl: 'x', token: 't', skillKeys: Array.from({ length: 9 }, (_, i) => 'k' + i), locale: 'es', fetcher }), e => e.reason === 'invalid')
  await assert.rejects(api.requestProposals({ baseUrl: 'x', token: '', skillKeys: ['a'], locale: 'es', fetcher: async () => { throw new Error('no debe llamar') } }), e => e.reason === 'expired')
  assert.equal(calls.length, 1)
})
test('ES-30 IA: cada error del servidor se traduce a una causa propia (cupo, no disponible, proveedor, salida inválida, vencida, cambió…)', async () => {
  const cases = [[401, {}, 'expired'], [429, { code: 'ai_budget_exhausted' }, 'budget'], [503, { code: 'ai_budget_not_configured' }, 'unavailable'], [503, { code: 'catalog_unavailable' }, 'unavailable'],
    [502, { code: 'provider_unavailable' }, 'provider'], [502, { code: 'invalid_model_output' }, 'invalid_output'], [422, { code: 'no_evidence' }, 'no_evidence'], [400, { code: 'invalid_input' }, 'invalid'],
    [500, {}, 'uncertain'], [404, {}, 'error']]
  for (const [status, body, reason] of cases) {
    await assert.rejects(api.requestProposals({ baseUrl: 'x', token: 't', skillKeys: ['a'], locale: 'en', fetcher: reply(status, { ...body, error: 'texto interno del servidor' }) }), e => e.reason === reason, `${status} ${body.code ?? ''}`)
  }
  const confirm = api.buildConfirmBody({ requestId: 'req-12345678', token: 't', proposals: [prop('a', 3)], choices: {} })
  for (const [status, body, reason] of [[410, { code: 'proposal_expired' }, 'proposal_expired'], [409, { code: 'proposal_mismatch' }, 'changed'], [422, { code: 'evidence_not_valid' }, 'changed'], [422, { code: 'cannot_raise_level' }, 'invalid']]) {
    await assert.rejects(api.confirmProposals({ baseUrl: 'x', token: 't', body: confirm, fetcher: reply(status, body) }), e => e.reason === reason, `${status} ${body.code}`)
  }
  await assert.rejects(api.requestProposals({ baseUrl: 'x', token: 't', skillKeys: ['a'], locale: 'es', fetcher: async () => { throw new TypeError('red caída') } }), e => e.reason === 'uncertain')
  await assert.rejects(api.requestProposals({ baseUrl: 'x', token: 't', skillKeys: ['a'], locale: 'es', fetcher: reply(200, { proposals: 'no' }) }), e => e.reason === 'error')
})
test('ES-30 IA: confirmar reintenta con el MISMO requestId (idempotente) y cuenta lo guardado', async () => {
  const body = api.buildConfirmBody({ requestId: 'req-12345678', token: 't', proposals: [prop('a', 3), prop('b', 2)], choices: { b: 'null' } })
  const seen = []
  const ok = async (_u, o) => { seen.push(JSON.parse(o.body).requestId); return new Response(JSON.stringify({ saved: [{ skillKey: 'a' }], cleared: 1, created: true }), { status: 201 }) }
  await assert.rejects(api.confirmProposals({ baseUrl: 'x', token: 't', body, fetcher: async (_u, o) => { seen.push(JSON.parse(o.body).requestId); throw new TypeError('corte') } }), e => e.reason === 'uncertain')
  assert.deepEqual(await api.confirmProposals({ baseUrl: 'x', token: 't', body, fetcher: ok }), { saved: 1, cleared: 1 })
  assert.deepEqual(seen, ['req-12345678', 'req-12345678'])
})
test('ES-30 pantalla: caduca a los 10 min, exige evidencia confirmada, nunca imprime texto del servidor y no guarda nada en el navegador', () => {
  const panel = read('../src/skill-map/AiAnalysisPanel.tsx')
  assert.match(panel, /Date\.parse\(proposed\.expiresAt\) <= Date\.now\(\)/); assert.match(panel, /row\.status === 'confirmed'/)
  assert.match(panel, /disabled=\{busy \|\| accepted\.length < 1\}/); assert.match(panel, /requestId\.current \?\?= newRequestId\(\)/)
  assert.match(panel, /const choose = \(key: string, choice: Choice\) => \{ requestId\.current = null/)
  assert.equal(/\.message\b|responseText|\.detail\b|innerHTML/.test(panel), false)
  assert.equal(/localStorage|sessionStorage/.test(panel), false)
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.match(page, /<AiAnalysisPanel/); assert.match(page, /onAnalyze=\{key => openAi\(\[key\]\)\}/); assert.match(page, /const reloadMap = async/)
  assert.match(read('../src/skill-map/RadarView.tsx'), /skill_map\.ai_open/)
})
test('ES-30 textos de la IA: ES y EN completos, sin porcentajes ni promesas, y explican «Conviene revisar»', () => {
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
  const keys = Object.keys(skillMapEs).filter(k => k.startsWith('skill_map.ai_'))
  assert.ok(keys.length >= 45, String(keys.length))
  for (const k of keys) { assert.ok(skillMapEs[k].trim() && skillMapEn[k].trim(), k); assert.equal(/%/.test(skillMapEs[k] + skillMapEn[k]), false, k) }
  assert.match(skillMapEs['skill_map.ai_review_help'], /es una regla/); assert.match(skillMapEn['skill_map.ai_review_help'], /it is a rule/)
  assert.match(skillMapEs['skill_map.ai_privacy'], /No ve tu diario/); assert.match(skillMapEn['skill_map.ai_privacy'], /does not see your journal/)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(read('../src/skill-map/radar.css')), false, 'solo tokens')
})
