import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
function moduleUrl(file) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const { buildSelfBody, saveSelfAssessment, newRequestId, SelfAssessError, MAX_REFS, MAX_NOTE } = await import(moduleUrl('../src/skill-map/selfAssessApi.ts'))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
const refs = (n) => Array.from({ length: n }, (_, i) => ({ evidenceId: i + 1, version: 1 }))
const base = { requestId: 'req-12345678', skillKey: 'comunicacion' }

test('ES-119 cuerpo: un nivel exige de 1 a 8 evidencias distintas; sin evidencia no hay nivel (ES-114 B)', () => {
  assert.throws(() => buildSelfBody({ ...base, level: 2, refs: [], note: '' }), e => e instanceof SelfAssessError && e.reason === 'invalid')
  assert.throws(() => buildSelfBody({ ...base, level: 2, refs: refs(MAX_REFS + 1), note: '' }), SelfAssessError)
  assert.throws(() => buildSelfBody({ ...base, level: 2, refs: [{ evidenceId: 1, version: 1 }, { evidenceId: 1, version: 2 }], note: '' }), SelfAssessError)
  for (const level of [0, 5, 2.5, '3', NaN]) assert.throws(() => buildSelfBody({ ...base, level, refs: refs(1), note: '' }), SelfAssessError, String(level))
  assert.deepEqual(buildSelfBody({ ...base, level: 3, refs: refs(2), note: '  Coordiné al equipo  ' }), { ...base, level: 3, evidenceRefs: refs(2), rationale: 'Coordiné al equipo' })
  assert.equal('rationale' in buildSelfBody({ ...base, level: 1, refs: refs(1), note: '   ' }), false) // nota vacía: se omite (el servidor exige 1–500)
  assert.equal(buildSelfBody({ ...base, level: 1, refs: refs(MAX_REFS), note: '' }).evidenceRefs.length, MAX_REFS)
  assert.throws(() => buildSelfBody({ ...base, level: 1, refs: refs(1), note: 'x'.repeat(MAX_NOTE + 1) }), SelfAssessError)
})
test('ES-119 retirar: nivel nulo, sin evidencias ni nota; el servidor lo interpreta como «retirar la vigente»', () => {
  assert.deepEqual(buildSelfBody({ ...base, level: null, refs: refs(3), note: 'ignorada' }), { ...base, level: null })
})
test('ES-119 cliente: POST solo a /api/skill-map/self con el token propio, sin id de persona ni texto del servidor', async () => {
  const calls = []
  const ok = (status) => async (url, options) => { calls.push([url, options]); return new Response('{"created":true,"detail":"texto crudo del servidor"}', { status }) }
  await saveSelfAssessment({ baseUrl: 'https://api.example.invalid/', token: 'sintetico', body: buildSelfBody({ ...base, level: 2, refs: refs(1), note: '' }), fetcher: ok(201) })
  await saveSelfAssessment({ baseUrl: 'https://api.example.invalid', token: 'sintetico', body: buildSelfBody({ ...base, level: null, refs: [], note: '' }), fetcher: ok(200) })
  const [url, options] = calls[0]
  assert.equal(url, 'https://api.example.invalid/api/skill-map/self'); assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store')
  assert.equal(options.headers.Authorization, 'Bearer sintetico'); assert.deepEqual(JSON.parse(options.body).evidenceRefs, refs(1))
  assert.equal(JSON.stringify(calls).includes('userId'), false)
  assert.equal(JSON.parse(calls[1][1].body).level, null)
})
test('ES-119 cliente: errores como causa (sesión, datos, conflicto, incierto), y sin respuesta se puede reintentar con el MISMO requestId', async () => {
  const body = buildSelfBody({ ...base, level: 2, refs: refs(1), note: '' })
  for (const [status, reason] of [[401, 'expired'], [400, 'invalid'], [409, 'conflict'], [500, 'uncertain'], [503, 'uncertain'], [404, 'error'], [403, 'error']]) {
    await assert.rejects(saveSelfAssessment({ baseUrl: 'x', token: 't', body, fetcher: async () => new Response('{}', { status }) }), e => e.reason === reason, String(status))
  }
  const seen = []
  await assert.rejects(saveSelfAssessment({ baseUrl: 'x', token: 't', body, fetcher: async (_u, o) => { seen.push(JSON.parse(o.body).requestId); throw new TypeError('red caída') } }), e => e.reason === 'uncertain')
  await saveSelfAssessment({ baseUrl: 'x', token: 't', body, fetcher: async (_u, o) => { seen.push(JSON.parse(o.body).requestId); return new Response('{}', { status: 200 }) } })
  assert.deepEqual(seen, [body.requestId, body.requestId]) // idempotencia: el reintento no duplica
  await assert.rejects(saveSelfAssessment({ baseUrl: 'x', token: '', body, fetcher: async () => { throw new Error('no debe llamar') } }), e => e.reason === 'expired')
  assert.match(newRequestId(), /^[A-Za-z0-9_-]{8,64}$/); assert.notEqual(newRequestId(), newRequestId())
})
test('ES-119 pantalla: el botón de guardar exige evidencia y nivel; el requestId se renueva al cambiar algo; nunca se imprime texto del servidor', () => {
  const panel = read('../src/skill-map/SelfAssessPanel.tsx')
  assert.match(panel, /const ready = refs\.length >= 1 && refs\.length <= MAX_REFS && level !== null/)
  assert.match(panel, /disabled=\{!ready \|\| busy\}/)
  assert.match(panel, /const changed = \(\) => \{ requestId\.current = null/)
  assert.match(panel, /row\.status === 'confirmed'/) // solo evidencias confirmadas
  assert.equal(/\.message\b|responseText|\.detail\b/.test(panel), false)
  assert.match(panel, /useEffect\(\(\) => \{ setMode\('idle'\)[\s\S]*\[skill\.skillKey\]\)/) // nada se arrastra a otra capacidad
  assert.equal(/localStorage|sessionStorage/.test(panel), false)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(read('../src/skill-map/skillMap.css')), false)
})
test('ES-119 detalle: Estado «Sin evaluar»/«Validado» y fuente «Evidencia aportada» solo con nivel vigente (ES-114 B); el panel se monta solo si se le da `self`', () => {
  const views = read('../src/skill-map/SkillViews.tsx')
  assert.match(views, /skill_map\.state_validated/); assert.match(views, /skill_map\.state_unassessed/); assert.match(views, /hasLevel\(status\) &&[\s\S]*skill_map\.source_evidence/)
  assert.match(views, /\{self && <SelfAssessPanel/)
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.match(page, /self=\{\{ backend, token: state\.status === 'ready' \? state\.token : ''/)
})
test('ES-119 textos: ES y EN completos y sin promesas; los archivos no chocan por mayúsculas (Windows/Linux)', () => {
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
  for (const k of ['reg_btn', 'change_btn', 'retire_btn', 'reg_title', 'reg_save', 'reg_e_invalid', 'reg_e_conflict', 'reg_e_uncertain', 'state_validated', 'state_unassessed', 'source_evidence', 'retire_body']) {
    assert.ok(skillMapEs[`skill_map.${k}`]?.trim() && skillMapEn[`skill_map.${k}`]?.trim(), k)
  }
  assert.match(skillMapEs['skill_map.reg_intro'], /no certifica/); assert.match(skillMapEn['skill_map.reg_intro'], /does not certify/)
  const names = ['selfAssessApi.ts', 'SelfAssessPanel.tsx'].map(n => n.toLowerCase())
  assert.equal(new Set(names).size, names.length)
})
