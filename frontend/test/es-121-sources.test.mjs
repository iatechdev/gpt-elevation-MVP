// ES-121 (frontend): permisos por fuente y análisis con IA en El Puente. Lógica pura, cliente con fetch simulado y estructura accesible.
// El recorrido en navegador real (con backend real y proveedor simulado) se ejecuta aparte.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { bridgeCopy } from '../src/bridge/copy.ts'
import { failureOf, parseConsents, proposalsToInsights, purposeOf, retryable, sourceIds, withSource, emptyProposals } from '../src/bridge/sources.ts'
import { analyze, listResumeVersions, readPermissions, setPermission, SourcesError } from '../src/bridge/insightsApi.ts'
import { withInsight } from '../src/bridge/logic.ts'
import { parseFields } from '../src/compass/model.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const opts = (fetcher) => ({ baseUrl: 'http://api.test/', token: 'tok-sintetico', fetcher })

test('ES-121 permisos: un propósito por fuente; solo «granted» autoriza (retirado, sin decidir o con versión anterior = apagado)', () => {
  assert.deepEqual(sourceIds, ['chat', 'diary', 'resume'])
  assert.deepEqual(purposeOf, { chat: 'insights_chat', diary: 'insights_diary', resume: 'insights_resume' })
  const rows = (a, b, c) => ({ consents: [{ purpose: 'insights_chat', status: a }, { purpose: 'insights_diary', status: b }, { purpose: 'insights_resume', status: c }, { purpose: 'resume_ai_reading', status: 'granted' }] })
  assert.deepEqual(parseConsents(rows('granted', 'revoked', 'undecided')), { chat: true, diary: false, resume: false })
  assert.deepEqual(parseConsents(rows('outdated', 'granted', 'granted')), { chat: false, diary: true, resume: true })
  assert.deepEqual(parseConsents({ consents: [{ purpose: 'resume_ai_reading', status: 'granted' }] }), { chat: false, diary: false, resume: false }) // resume_ai_reading no autoriza insights_resume
  for (const bad of [null, {}, { consents: 'x' }, []]) assert.equal(parseConsents(bad), null)
})

test('ES-121 errores: cada respuesta del contrato tiene su causa; reintentar solo cuando tiene sentido', () => {
  assert.equal(failureOf(401, ''), 'expired')
  assert.equal(failureOf(403, 'consent_required'), 'consent')
  assert.equal(failureOf(422, 'no_usable_source'), 'nothing')
  assert.equal(failureOf(404, 'origin_not_found'), 'nothing')
  assert.equal(failureOf(429, 'ai_budget_exhausted'), 'limit')
  assert.equal(failureOf(502, 'invalid_model_output'), 'invalid')
  assert.equal(failureOf(502, 'provider_unavailable'), 'unavailable')
  assert.equal(failureOf(503, 'ai_budget_not_configured'), 'unavailable')
  assert.equal(failureOf(500, 'insights_failed'), 'unavailable')
  assert.deepEqual(['unavailable', 'invalid', 'network', 'limit', 'consent', 'nothing', 'expired'].map(retryable), [true, true, true, false, false, false, false])
})

test('ES-121 propuestas: cada una es una hipótesis con la fuente y el id del origen; la cita solo se muestra; lo mal formado se descarta', () => {
  const body = { insights: [
    { key: 'energy_gives', text: 'Parece que coordinar equipos te da energía.', skillKey: 'comunicacion', origins: [{ type: 'chat_turn', id: 7, quote: 'disfruto coordinar' }, { type: 'chat_turn', id: 9, quote: 'me motiva explicar' }] },
    { key: 'values', text: 'Mal tipo de origen', origins: [{ type: 'diary_entry', id: 1, quote: 'x' }] },
    { key: 'inventada', text: 'Categoría inventada', origins: [{ type: 'chat_turn', id: 1, quote: 'x' }] },
    { key: 'values', text: 'Sin origen', origins: [] },
    { key: 'values', text: 'Id inválido', origins: [{ type: 'chat_turn', id: 0, quote: 'x' }] },
    { key: 'interests', text: 'Habilidad inválida se ignora', skillKey: 'NO VALIDA!', origins: [{ type: 'chat_turn', id: 3, quote: 'me interesa' }] },
  ] }
  const out = proposalsToInsights(body, 'chat', '2026-10-30')
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { id: 'chat:0', date: '2026-10-30', status: 'hypothesis', example: false, source: 'chat', key: 'energy_gives', text: 'Parece que coordinar equipos te da energía.',
    fragment: 'disfruto coordinar … me motiva explicar', origin: { type: 'chat_turn', id: 7 }, skillKey: 'comunicacion' })
  assert.equal('skillKey' in out[1], false)
  assert.equal(proposalsToInsights({ insights: [{ key: 'values', text: 'T', origins: [{ type: 'resume_version', id: 4, quote: 'q' }] }] }, 'resume', 'd')[0].origin.type, 'resume_version')
  assert.throws(() => proposalsToInsights({}, 'chat', 'd')); assert.throws(() => proposalsToInsights(null, 'chat', 'd'))
  assert.deepEqual(withSource(emptyProposals(), 'diary', out).chat, []); assert.equal(withSource(emptyProposals(), 'diary', out).diary.length, 2)
})

test('ES-121 autorizar: el insight cruza con su origen (solo id) y su habilidad, sin la cita; lo ya autorizado conserva el suyo', () => {
  const active = [{ key: 'values', text: 'Valor A' }, { key: 'interests', text: 'Interés B', origin: { type: 'diary_entry', id: 5 }, skillKey: 'planificacion' }]
  const insight = { key: 'energy_gives', text: 'Parece que coordinar te da energía.', fragment: 'CITA PRIVADA DEL CHAT', id: 'chat:0', date: 'd', status: 'hypothesis', example: false, source: 'chat', origin: { type: 'chat_turn', id: 7 }, skillKey: 'comunicacion' }
  const next = withInsight(active, insight)
  assert.deepEqual(next, [
    { key: 'values', text: 'Valor A', origin: { type: 'direct' } },
    { key: 'interests', text: 'Interés B', origin: { type: 'diary_entry', id: 5 }, skillKey: 'planificacion' },
    { key: 'energy_gives', text: 'Parece que coordinar te da energía.', origin: { type: 'chat_turn', id: 7 }, skillKey: 'comunicacion' },
  ])
  assert.doesNotMatch(JSON.stringify(next), /CITA PRIVADA|fragment|source|"id":"/)
})

test('ES-121 lectura del contexto: se conservan origen y habilidad válidos; lo malformado se ignora como cualquier dato extra', () => {
  const fields = parseFields([
    { key: 'values', text: 'A', origin: { type: 'resume_version', id: 3 }, skillKey: 'comunicacion' },
    { key: 'interests', text: 'B', origin: { type: 'resume_version', id: -1 }, skillKey: 'NO' },
    { key: 'motivations', text: 'C', origin: { type: 'direct' } },
    { key: 'constraints', text: 'D', origin: { type: 'direct', id: 4 } },
  ])
  assert.deepEqual(fields, [{ key: 'values', text: 'A', origin: { type: 'resume_version', id: 3 }, skillKey: 'comunicacion' }, { key: 'interests', text: 'B' }, { key: 'motivations', text: 'C', origin: { type: 'direct' } }, { key: 'constraints', text: 'D' }])
})

test('ES-121 cliente: bearer, no-store, cuerpos exactos y sin identificadores del titular; el id de la hoja de vida solo viaja con esa fuente', async () => {
  const calls = []
  const fetcher = async (url, init) => {
    calls.push({ url, ...init })
    if (url.endsWith('/api/consents')) return json(200, { consents: [{ purpose: 'insights_chat', status: 'granted' }] })
    if (url.includes('/api/consents/')) return json(200, {})
    if (url.endsWith('/api/user/resumes')) return json(200, { resumes: [{ id: 5, version: 1, size: 10, createdAt: '2026-10-01T00:00:00Z' }, { id: 6, version: 2, size: 10, createdAt: '2026-10-20T00:00:00Z' }, { id: 'x' }], maxVersions: 5 })
    return json(200, { insights: [], usedSources: {}, discarded: 0, token: 't', expiresAt: 'e' })
  }
  assert.deepEqual(await readPermissions(opts(fetcher)), { chat: true, diary: false, resume: false })
  await setPermission(opts(fetcher), 'diary', true); await setPermission(opts(fetcher), 'chat', false)
  assert.deepEqual((await listResumeVersions(opts(fetcher))).map(row => row.id), [6, 5]) // la última primero; lo mal formado se ignora
  await analyze(opts(fetcher), 'chat', { locale: 'es', today: 'd', resumeId: 99 }); await analyze(opts(fetcher), 'resume', { locale: 'en', today: 'd', resumeId: 6 }); await analyze(opts(fetcher), 'resume', { locale: 'en', today: 'd' })
  assert.ok(calls.every(call => call.cache === 'no-store' && call.headers.Authorization === 'Bearer tok-sintetico' && call.url.startsWith('http://api.test/api/')))
  assert.deepEqual(calls.filter(call => call.method === 'PUT').map(call => [call.url, JSON.parse(call.body)]), [['http://api.test/api/consents/insights_diary', { status: 'granted' }], ['http://api.test/api/consents/insights_chat', { status: 'revoked' }]])
  assert.deepEqual(calls.filter(call => call.url.endsWith('/proposals')).map(call => JSON.parse(call.body)), [{ sources: ['chat'], locale: 'es' }, { sources: ['resume'], locale: 'en', resumeId: 6 }, { sources: ['resume'], locale: 'en' }])
  assert.doesNotMatch(JSON.stringify(calls.map(call => call.body ?? '')), /UserId|userId|turnIds|entryIds/)
})

test('ES-121 cliente: sin sesión, errores del servidor y red caída se traducen a causas controladas (nunca una excepción cruda)', async () => {
  const kind = async (promise) => { try { await promise; return 'ok' } catch (error) { assert.ok(error instanceof SourcesError); return error.kind } }
  assert.equal(await kind(readPermissions({ baseUrl: '', token: '', fetcher: async () => json(200, {}) })), 'expired')
  const status = (code, body) => async () => json(code, body)
  const ask = (fetcher, source = 'chat') => analyze(opts(fetcher), source, { locale: 'es', today: 'd' })
  assert.equal(await kind(ask(status(403, { code: 'consent_required', purpose: 'insights_diary' }), 'diary')), 'consent')
  assert.equal(await kind(ask(status(422, { code: 'no_usable_source' }), 'resume')), 'nothing')
  assert.equal(await kind(ask(status(429, { code: 'ai_budget_exhausted' }))), 'limit')
  assert.equal(await kind(ask(status(502, { code: 'invalid_model_output' }))), 'invalid')
  assert.equal(await kind(ask(status(500, null))), 'unavailable')
  assert.equal(await kind(ask(status(200, { insights: 'no' }))), 'invalid')
  assert.equal(await kind(ask(async () => { throw new TypeError('fetch failed') })), 'network')
  assert.equal(await kind(setPermission(opts(status(500, {})), 'chat', true)), 'unavailable')
  assert.deepEqual(await listResumeVersions(opts(status(503, {}))), []) // sin lista de versiones el análisis usa la última
})

test('ES-121 textos: ES y EN completos para cada fuente, sin promesas ni niveles; el diálogo dice qué se lee y que se puede retirar', () => {
  for (const lang of ['es', 'en']) {
    const c = bridgeCopy[lang]
    for (const source of sourceIds) for (const prefix of ['src_name_', 'src_what_', 'src_of_', 'src_switch_', 'src_analyze_', 'src_granted_', 'src_revoked_', 'src_reading_', 'src_from_']) assert.ok(c[prefix + source], lang + prefix + source)
    assert.match(c.dlg_title, /\{source\}/); assert.match(c.dlg_1, /\{source\}/); assert.match(c.src_found, /\{n\}/)
    assert.match(c.src_note, lang === 'es' ? /no se guardan/ : /not saved/)
    assert.match(c.dlg_4, lang === 'es' ? /retirar/ : /withdraw/); assert.match(c.dlg_resume, lang === 'es' ? /sin tus datos de contacto/ : /without your contact details/)
  }
})

test('ES-121 estructura accesible: interruptor con role=switch, diálogo modal con Esc y foco atrapado, regiones vivas y el panel integrado en El Puente', () => {
  const sw = read('../src/bridge/PermissionSwitch.tsx'); const panel = read('../src/bridge/SourcesPanel.tsx'); const page = read('../src/bridge/BridgePage.tsx'); const css = read('../src/bridge/bridge.css')
  assert.match(sw, /role="switch"/); assert.match(sw, /aria-checked=\{checked\}/); assert.match(sw, /aria-label=\{label\}/); assert.match(sw, /aria-describedby=\{describedBy\}/)
  assert.match(panel, /role="dialog"/); assert.match(panel, /aria-modal="true"/); assert.match(panel, /event\.key === 'Escape'/); assert.match(panel, /event\.key !== 'Tab'/); assert.match(panel, /data-source=/)
  assert.match(panel, /aria-live="polite"/); assert.match(panel, /role=\{notice\.kind === 'error' \? 'alert' : 'status'\}/)
  assert.match(panel, /if \(!granted\) onResult\(source, \[\]\)/) // retirar un permiso quita lo propuesto con él
  assert.match(page, /<SourcesPanel /); assert.match(page, /\.\.\.Object\.values\(proposals\)\.flat\(\)/)
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /min-height: 44px/); assert.match(css, /max-width: 639px/)
  assert.doesNotMatch(panel + sw, /localStorage|sessionStorage|console\.(log|info|debug)/) // las propuestas y los permisos no se guardan en el navegador
})
