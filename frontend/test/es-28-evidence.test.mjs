import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
function moduleUrl(file, replacements = []) {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = moduleUrl('../src/evidence/model.ts')
const { blankDraft, draftPayload, parseList, parseDetail } = await import(modelUrl)
const { evidenceApi } = await import(moduleUrl('../src/evidence/api.ts', [["'./model'", JSON.stringify(modelUrl)]]))
const { evidenceEs, evidenceEn } = await import(moduleUrl('../src/evidence/copy.ts'))
const complete = () => ({ ...blankDraft(), title: 'Caso sintético', situation: 'Situación sintética', responsibility: 'Mi contribución sintética',
  actions: ['Acción sintética'], goal: 'La meta era 10.000', delivered: 'Una entrega sintética, sin resultado medido', effect: 'unknown' })
const row = (version = 1) => ({ id: 11, version, status: 'confirmed', authoring: 'person', createdAt: '2026-10-27T12:00:00Z', payload: draftPayload(complete(), 'confirmed').payload })
test('ES-28: title-only draft rejected, optional blanks omitted, confirmed requires explicit effect choice', () => {
  assert.ok(draftPayload({ ...blankDraft(), title: 'Synthetic' }, 'draft').errors.includes('draft_minimum'))
  const result = draftPayload({ ...blankDraft(), title: 'Synthetic', situation: 'Some actual synthetic context' }, 'draft')
  assert.deepEqual(result.errors, [])
  assert.deepEqual(Object.keys(result.payload), ['title', 'situation'])
  assert.ok(draftPayload({ ...complete(), effect: 'unset' }, 'confirmed').errors.includes('observedEffect'))
  assert.ok(draftPayload({ ...complete(), effect: 'known', effectText: '' }, 'confirmed').errors.includes('observedEffect'))
})
test('ES-28: goal is never promoted to delivery/effect, unknown preserved and claim provenance fixed', () => {
  const { payload, errors } = draftPayload(complete(), 'confirmed')
  assert.deepEqual(errors, [])
  assert.equal(payload.goal, 'La meta era 10.000')
  assert.doesNotMatch(payload.delivered.text, /10[.,]?000/)
  assert.deepEqual(payload.observedEffect, { known: false })
  assert.equal(payload.responsibility.source, 'self_report')
  assert.equal(payload.actions[0].source, 'self_report')
  assert.equal(payload.autonomy, undefined)
  assert.equal(payload.origins, undefined)
})
test('ES-28: bounds, references, https credentials and no invented sources', () => {
  for (const over of [{ title: 'x'.repeat(121) }, { situation: 'x'.repeat(1001) }, { goal: 'x'.repeat(501) },
    { actions: Array(9).fill('Synthetic') }, { alternatives: Array(6).fill('Synthetic') },
    { artifacts: [{ kind: 'url', value: 'http://example.invalid', note: '' }] },
    { artifacts: [{ kind: 'url', value: 'https://user:pass@example.invalid', note: '' }] },
    { artifacts: [{ kind: 'text', value: 'x'.repeat(1001), note: '' }] }]) assert.ok(draftPayload({ ...complete(), ...over }, 'confirmed').errors.length)
  const result = draftPayload({ ...complete(), artifacts: [{ kind: 'url', value: 'https://example.invalid/sample', note: 'Synthetic' }, { kind: 'text', value: 'Synthetic excerpt', note: '' }] }, 'confirmed')
  assert.deepEqual(result.errors, []); assert.equal(result.payload.artifactRefs.length, 2)
})
test('ES-28: detail validates ID/version and preserves read-only revoked/historical data', () => {
  const data = parseDetail({ id: 11, currentVersion: 2, versions: [row(1), { ...row(2), status: 'revoked' }] })
  assert.equal(data.versions[0].version, 2); assert.equal(data.versions[0].status, 'revoked')
  assert.throws(() => parseDetail({ id: 99, currentVersion: 1, versions: [row()] }))
  assert.throws(() => parseDetail({ id: 11, currentVersion: 2, versions: [row()] }))
  assert.throws(() => parseList({ evidence: [row(), row()] }))
  assert.throws(() => parseList({ evidence: [{ ...row(), payload: {} }] }))
})
test('ES-28: only GET and manual POST, exact request reused without origins/owner/authoring fields', async () => {
  const calls = []
  const api = evidenceApi('https://api.example.invalid/', 'synthetic-token', async (url, options) => {
    calls.push({ url, options })
    assert.equal(options.cache, 'no-store'); assert.equal(options.headers.Authorization, 'Bearer synthetic-token')
    return Response.json(options.method === 'POST' ? { id: 11, version: 1, status: 'confirmed', created: calls.length === 1 } : { id: 11, currentVersion: 1, versions: [row()] })
  })
  const body = { payload: draftPayload(complete(), 'confirmed').payload, status: 'confirmed', requestId: 'synthetic-request-01' }
  await api.create(body); await api.create(body); await api.detail(11)
  assert.equal(calls[0].options.body, calls[1].options.body)
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(), ['payload', 'requestId', 'status'])
  assert.deepEqual(calls.map(call => call.options.method), ['POST', 'POST', 'GET'])
  assert.equal(calls[2].url, 'https://api.example.invalid/api/evidence/11')
  assert.equal(api.update, undefined); assert.equal(api.remove, undefined)
})
test('ES-28: protocol failures and foreign resource never become empty/saved success', async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 500]) {
    const api = evidenceApi('', 'synthetic', async () => Response.json({ error: 'PRIVATE ERROR', missing: ['actions', 'UNKNOWN PRIVATE FIELD'] }, { status }))
    await assert.rejects(api.list(), error => error.status === status && error.message === 'Evidence request failed' && error.fields.every(field => field === 'actions'))
  }
  await assert.rejects(evidenceApi('', '', async () => assert.fail('No token')).list(), { status: 401 })
  await assert.rejects(evidenceApi('', 'synthetic', async () => Response.json({})).create({ payload: { title: 'Synthetic' }, status: 'draft', requestId: 'synthetic-01' }))
  await assert.rejects(evidenceApi('', 'synthetic', async () => Response.json({ id: 11, currentVersion: 1, versions: [row()] })).detail(22))
})
test('ES-28: ES/EN copy complete and internal text/action/error meet AA contrast', () => {
  assert.deepEqual(Object.keys(evidenceEs), Object.keys(evidenceEn))
  assert.ok(Object.values(evidenceEs).every(Boolean)); assert.ok(Object.values(evidenceEn).every(Boolean))
  const luminance = hex => { const [r, g, b] = hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b }
  for (const color of ['#1c1917', '#4a6741', '#dc2626', '#92400e']) for (const bg of ['#ffffff', '#f9f9f7']) {
    const [light, dark] = [luminance(color), luminance(bg)].sort((a, b) => b - a)
    assert.ok((light + .05) / (dark + .05) >= 4.5)
  }
})
