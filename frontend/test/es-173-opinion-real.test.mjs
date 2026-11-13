// ES-173 (HU-P22, entrega c): «Tu opinión» conectada al servidor REAL detrás de VITE_ENABLE_PILOT_FEEDBACK_LIVE (apagada por defecto).
// Contrato del repositorio real con un fetch simulado (sin red), mapeo de errores (403/409/5xx/corte), ventana fija día 7, propietario por token,
// y textos VERDADEROS (revocar el permiso NO borra; borrar = «Retirar mi respuesta»). El comportamiento en navegador lo mide scripts/es173-opinion-real-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLiveRepository, liveEnabled } from '../src/pilot/liveRepository.ts'
import { FixtureError } from '../src/pilot/fixtures.ts'
import { copy } from '../src/pilot/copy.ts'
import { makeIntent, emptyAnswers, sameAnswers } from '../src/pilot/model.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const answers = { ...emptyAnswers(), initialValue: 'yes', valueArea: 'career', listened: 'yes', helpedBy: ['ideas'] }
const dto = (patch = {}) => ({ feedback: { window: 'day7', status: 'active', version: 1, questionnaireVersion: 1, answers, lastRequestId: 'req-12345678', permission: { purpose: 'pilot_feedback', granted: true }, ...patch } })
const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body })
const repo = handler => { const calls = []; const fetcher = async (url, init) => { calls.push({ url, init }); return handler(url, init, calls.length) }; return { calls, repository: createLiveRepository({ baseUrl: 'http://api.test/', token: 'tok-synthetic', fetcher }) } }
const failure = async (promise) => { try { await promise } catch (error) { return error } return null }

test('ES-173 (c): la bandera LIVE está apagada salvo el valor exacto «true»', () => {
  for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', true, null]) assert.equal(liveEnabled(value), false, String(value))
  assert.equal(liveEnabled('true'), true)
})

test('ES-173 (c): leer usa SOLO el token (sin id en la ruta), ventana fija día 7, sin caché, y devuelve la respuesta propia', async () => {
  const { calls, repository } = repo(() => reply(200, dto()))
  const row = await repository.read()
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'http://api.test/api/me/pilot-feedback?window=day7'); assert.equal(calls[0].init.method, 'GET'); assert.equal(calls[0].init.cache, 'no-store')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok-synthetic'); assert.equal(calls[0].init.body, undefined)
  assert.deepEqual({ v: row.version, p: row.permission, s: row.synthetic, w: row.window, a: row.answers, r: row.lastRequestId }, { v: 1, p: 'granted', s: false, w: 'day7', a: answers, r: 'req-12345678' })
  assert.equal((await repo(() => reply(200, dto({ permission: { purpose: 'pilot_feedback', granted: false } }))).repository.read()).permission, 'missing')
  assert.equal((await repo(() => reply(200, dto({ answers: null, status: 'none', version: 0, lastRequestId: null }))).repository.read()).answers, null)
})

test('ES-173 (c): una lectura fallida o una forma inesperada es «load»; nunca se inventa una respuesta', async () => {
  for (const handler of [() => reply(500, {}), () => reply(401, {}), () => { throw new TypeError('network') }, () => reply(200, null), () => reply(200, { feedback: {} }),
    () => reply(200, dto({ answers: { ...answers, extra: 1 } })), () => reply(200, dto({ version: -1 })), () => reply(200, dto({ window: 'day30' })), () => reply(200, dto({ permission: { granted: 'yes' } }))]) {
    const error = await failure(repo(handler).repository.read()); assert.ok(error instanceof FixtureError && error.code === 'load', String(error))
  }
})

test('ES-173 (c): guardar envía EXACTAMENTE requestId, baseVersion, questionnaireVersion, ventana y respuestas (sin ids de persona)', async () => {
  const intent = makeIntent(answers, 0, 'req-abcdefgh')
  const { calls, repository } = repo(() => reply(201, { ...dto(), replay: false }))
  const row = await repository.save(intent)
  assert.equal(calls[0].url, 'http://api.test/api/me/pilot-feedback'); assert.equal(calls[0].init.method, 'PUT'); assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
  const body = JSON.parse(calls[0].init.body); assert.deepEqual(Object.keys(body).sort(), ['answers', 'baseVersion', 'questionnaireVersion', 'requestId', 'window']); assert.equal(body.window, 'day7'); assert.equal(body.baseVersion, 0); assert.deepEqual(body.answers, answers)
  assert.equal(row.version, 1)
  assert.equal((await repo(() => reply(200, { ...dto(), replay: true })).repository.save(intent)).version, 1, 'una repetición idempotente (200) es éxito')
})

test('ES-173 (c): errores de guardado: 403 consent_required → unconfigured; 409 → conflict; 5xx o corte → unknown (consultar antes de reintentar); otro 4xx → save', async () => {
  const intent = makeIntent(answers, 0, 'req-abcdefgh')
  const codeOf = async handler => (await failure(repo(handler).repository.save(intent))).code
  assert.equal(await codeOf(() => reply(403, { code: 'consent_required' })), 'unconfigured')
  assert.equal(await codeOf(() => reply(403, { code: 'other' })), 'save')
  assert.equal(await codeOf(() => reply(409, { code: 'version_conflict' })), 'conflict')
  assert.equal(await codeOf(() => reply(409, { code: 'request_conflict' })), 'conflict')
  assert.equal(await codeOf(() => reply(500, {})), 'unknown'); assert.equal(await codeOf(() => reply(503, null)), 'unknown')
  assert.equal(await codeOf(() => { throw new TypeError('network') }), 'unknown')
  assert.equal(await codeOf(() => reply(400, { code: 'invalid_answers' })), 'save')
  assert.equal(await codeOf(() => reply(401, {})), 'save')
})

test('ES-173 (c): retirar la respuesta usa DELETE con la ventana y la versión; sus errores se mapean igual', async () => {
  const { calls, repository } = repo(() => reply(200, dto({ answers: null, status: 'withdrawn', version: 2, lastRequestId: null })))
  const row = await repository.withdraw(1)
  assert.equal(calls[0].url, 'http://api.test/api/me/pilot-feedback?window=day7&baseVersion=1'); assert.equal(calls[0].init.method, 'DELETE'); assert.equal(row.answers, null)
  assert.equal((await failure(repo(() => reply(409, {})).repository.withdraw(1))).code, 'conflict')
  assert.equal((await failure(repo(() => reply(500, {})).repository.withdraw(1))).code, 'unknown')
  assert.equal((await failure(repo(() => { throw new TypeError('x') }).repository.withdraw(1))).code, 'unknown')
})

test('ES-173 (c): dar o retirar el permiso pilot_feedback envía solo {status}; no toca otros propósitos', async () => {
  const { calls, repository } = repo(() => reply(200, { ok: true }))
  await repository.setPermission(true); await repository.setPermission(false)
  assert.deepEqual(calls.map(c => [c.url, c.init.method, c.init.body]), [['http://api.test/api/consents/pilot_feedback', 'PUT', '{"status":"granted"}'], ['http://api.test/api/consents/pilot_feedback', 'PUT', '{"status":"revoked"}']])
  assert.equal((await failure(repo(() => reply(500, {})).repository.setPermission(true))).code, 'unknown')
  assert.equal((await failure(repo(() => reply(400, {})).repository.setPermission(true))).code, 'save')
})

test('ES-173 (c): el repositorio real no guarda respuestas en el navegador ni usa localStorage para datos', () => {
  const src = read('../src/pilot/liveRepository.ts')
  assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|document\.cookie/)
})

test('ES-173 (c): la pantalla elige el modo por bandera; sin bandera NO hay repositorio real; con bandera NO hay franja de «ficticios»', () => {
  const page = read('../src/pilot/FeedbackPage.tsx')
  assert.match(page, /liveEnabled\(import\.meta\.env\.VITE_ENABLE_PILOT_FEEDBACK_LIVE\)/)
  assert.match(page, /live \? createLiveRepository\(\{ baseUrl: API, token \}\) : createFixtureRepository\(/)
  assert.match(page, /enabled \? \(live \? children : <><Banner title=\{c\.preview\}>/, 'la franja solo existe en el modo simulación')
  assert.doesNotMatch(page, /fetch\(|\/api\//, 'la pantalla no llama a la red: lo hace el repositorio')
  assert.match(read('../src/pilot/liveRepository.ts'), /Authorization: `Bearer \$\{token\}`/)
})

test('ES-173 (c): textos VERDADEROS en modo real (ES y EN): revocar el permiso no borra; borrar es «Retirar mi respuesta»; nada de «simulación»', () => {
  for (const lang of ['es', 'en']) {
    const c = copy[lang]; const live = ['l_permission', 'l_window', 'l_empty', 'l_saving', 'l_saved', 'l_save', 'l_loadError', 'l_saveError', 'l_conflict', 'l_review', 'l_withdraw', 'l_withdrawText', 'l_removed', 'l_exitWarning', 'l_noConsent', 'grantTitle', 'grantText', 'grant', 'granted', 'revokePermission', 'revokeText', 'revokeConfirm', 'revoked', 'permissionActive', 'permissionPending']
    for (const key of live) { assert.equal(typeof c[key], 'string', `${lang}.${key}`); assert.ok(c[key].length > 3, `${lang}.${key}`); assert.doesNotMatch(c[key], /simulaci|simulation|ficticio|fictional|fixture/i, `${lang}.${key} no habla de simulación`) }
    assert.match(c.revokeText, lang === 'es' ? /no se guardan más respuestas/ : /no more answers are saved/); assert.match(c.revokeText, lang === 'es' ? /Retirar mi respuesta/ : /Withdraw my response/)
    assert.match(c.revoked, lang === 'es' ? /no se borró/ : /not deleted/)
    assert.doesNotMatch(c.revokeText + c.grantText + c.l_permission, /se borra lo que respond|deleted when|al retirarlo se borra/i, 'revocar el permiso NO borra')
    assert.match(c.l_withdrawText, lang === 'es' ? /borra/ : /deleted/); assert.match(c.l_removed, lang === 'es' ? /se borró/ : /was deleted/)
  }
})

test('ES-173 (c): la simulación conserva sus textos (franja y «Simulación solo en memoria») y su contrato de fixtures', () => {
  assert.match(copy.es.preview, /datos ficticios/); assert.match(copy.es.local, /Nada se envía ni se guarda en un servidor/); assert.match(copy.en.local, /Nothing is sent to or saved on a server/)
})

test('ES-173 (c): comparar respuestas es por CONTENIDO, no por orden de claves (JSONB de PostgreSQL reordena las claves)', () => {
  const reordered = { helpedBy: ['ideas'], listened: 'yes', valueArea: 'career', initialValue: 'yes', respected: null, professionalClarity: null }
  assert.notEqual(JSON.stringify(reordered), JSON.stringify(answers), 'el orden difiere, como lo devuelve PostgreSQL')
  assert.equal(sameAnswers(reordered, answers), true)
  assert.equal(sameAnswers({ ...reordered, listened: 'no' }, answers), false); assert.equal(sameAnswers({ ...reordered, helpedBy: [] }, answers), false)
  assert.equal(sameAnswers(null, null), true); assert.equal(sameAnswers(null, answers), false)
})
