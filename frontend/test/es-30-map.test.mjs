import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Execute production TS, not a reimplementation; type checking is also run by tsc.
function moduleUrl(file, replacements = []) {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = moduleUrl('../src/skill-map/model.ts')
const { parseSkillMap, trackView } = await import(modelUrl)
const { readSkillMap } = await import(moduleUrl('../src/skill-map/api.ts', [["'./model'", JSON.stringify(modelUrl)]]))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))
const track = (over = {}) => ({ level: 2, state: 'initial', stale: false, catalogOutdated: false,
  confidence: 'low', confidenceReason: { es: 'Respaldo sintético', en: 'Synthetic support' }, evidenceCount: 1,
  authoring: 'person', rationale: 'Justificación sintética', needsReview: false, ...over })
const skill = (over = {}) => ({ skillKey: 'synthetic_skill', type: 'transversal', labels: { es: 'Capacidad sintética', en: 'Synthetic skill' },
  rubric: { levels: Object.fromEntries([1, 2, 3, 4].map(level => [level, { es: `Criterio sintético ${level}`, en: `Synthetic criterion ${level}` }])), source: 'Fuente sintética de prueba', verifiedAt: '2026-10-01' },
  self: track(), review: null, state: 'initial', ...over })
const payload = (skills = [skill()]) => ({ catalogVersion: 1, skills })

test('ES-30: accepts actual GET contract, empty catalog and nullable/separate tracks', () => {
  assert.deepEqual(parseSkillMap(payload()), payload())
  assert.deepEqual(parseSkillMap(payload([])), payload([]))
  const data = payload([skill({ self: null, state: 'no_evidence' }), skill({ skillKey: 'another', review: track({ level: 4, state: 'reviewed' }) })])
  assert.deepEqual(parseSkillMap(data), data)
  assert.equal(trackView(data.skills[1].self).level, 2)
  assert.equal(trackView(data.skills[1].review).level, 4) // never averaged
})
test('ES-30: malformed response is an error, never an empty success or invented level', () => {
  const invalid = [null, {}, [], { catalogVersion: 0, skills: [] }, { catalogVersion: '1', skills: [] }, payload([skill(), skill()]),
    payload([skill({ self: track({ level: 0 }) })]), payload([skill({ self: track({ level: 5 }) })]),
    payload([skill({ self: track({ level: '3' }) })]), payload([skill({ self: track({ evidenceCount: 0 }) })]),
    payload([skill({ self: track({ confidence: '90%' }) })]), payload([skill({ self: track({ evidenceCount: -1 }) })]),
    payload([skill({ self: track({ needsReview: 'yes' }) })]), payload([skill({ self: track({ stale: undefined }) })]),
    payload([skill({ self: track({ state: ['initial'] }) })]), payload([skill({ type: ['domain'] })]),
    payload([skill({ self: track({ confidence: ['low'] }) })]), payload([skill({ state: ['initial'] })]),
    payload([skill({ rubric: {} })]), payload([skill({ labels: {} })]), payload([skill({ state: 'employable' })])]
  for (const value of invalid) assert.throws(() => parseSkillMap(value))
})
test('ES-30: stale numbers/confidence are suppressed even if server mistakenly includes the old level', () => {
  for (const value of [track({ stale: true, level: 4 }), track({ state: 'stale', level: 3 })]) {
    const view = trackView(value)
    assert.equal(view.level, null); assert.equal(view.confidence, null); assert.equal(view.state, 'stale')
  }
  assert.equal(trackView(null).level, null)
  assert.equal(trackView(track({ level: null })).level, null)
  assert.equal(trackView(track({ needsReview: true })).state, 'contradictory')
  assert.equal(trackView(track({ state: 'contradictory', needsReview: false })).needsReview, true)
  assert.equal(trackView(track({ catalogOutdated: true })).level, 2) // preserved, separately labelled as earlier rubric
})
test('ES-30: client sends only owner GET with token/no-store; no ID, locale or body', async () => {
  let called = 0
  const controller = new AbortController()
  const result = await readSkillMap({ baseUrl: 'https://api.example.invalid/', token: 'synthetic', signal: controller.signal,
    fetcher: async (url, options) => {
      called++; assert.equal(url, 'https://api.example.invalid/api/skill-map')
      assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store'); assert.equal(options.signal, controller.signal)
      assert.deepEqual(options.headers, { Authorization: 'Bearer synthetic', Accept: 'application/json' }); assert.equal(options.body, undefined)
      return Response.json(payload())
    } })
  assert.equal(called, 1); assert.deepEqual(result, payload())
})
test('ES-30: 401/403/404/catalog unavailable/network/500/malformed never masquerade as no evidence', async () => {
  for (const [response, reason] of [
    [Response.json({}, { status: 401 }), 'expired'], [Response.json({}, { status: 403 }), 'forbidden'],
    [Response.json({}, { status: 404 }), 'unavailable'], [Response.json({ code: 'catalog_unavailable' }, { status: 503 }), 'catalog_unavailable'],
    [new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } }), 'unavailable'],
    [Response.json({ error: 'PRIVATE ERROR' }, { status: 500 }), 'load_error'], [Response.json({ skills: [] }), 'load_error'],
    [new Response('invalid json', { headers: { 'Content-Type': 'application/json' } }), 'load_error'],
  ]) await assert.rejects(readSkillMap({ baseUrl: '', token: 'synthetic', fetcher: async () => response }), { reason })
  await assert.rejects(readSkillMap({ baseUrl: '', token: '', fetcher: async () => assert.fail('No session must not call the API') }), { reason: 'expired' })
  await assert.rejects(readSkillMap({ baseUrl: '', token: 'synthetic', fetcher: async () => { throw new TypeError('network'); } }), TypeError)
})
test('ES-30: ES/EN dictionaries match and missing translations do not fabricate evidence', () => {
  assert.deepEqual(Object.keys(skillMapEs), Object.keys(skillMapEn))
  for (const copy of [skillMapEs, skillMapEn]) assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.trim()))
  assert.doesNotThrow(() => parseSkillMap(payload([skill({ labels: { es: 'Solo etiqueta de prueba' } })])))
})
test('ES-30: internal text, warning/error and focus colors meet AA contrast', () => {
  const luminance = hex => {
    const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]
  }
  for (const foreground of ['#1c1917', '#4a6741', '#92400e', '#dc2626']) {
    for (const background of ['#ffffff', '#f9f9f7']) {
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
      const ratio = (light + .05) / (dark + .05)
      assert.ok(ratio >= 4.5, `${foreground} / ${background}: ${ratio.toFixed(2)}:1`)
    }
  }
})
