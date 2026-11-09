// ES-135: «Mis datos» — exportar los datos personales y pedir la eliminación de la cuenta desde la interfaz.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SpaceError } from '../src/space/api.ts'
import { dataCopy, sectionLabels } from '../src/space/dataCopy.ts'
import { dataErrorKey, downloadExport, prepareExport, requestDeletion, summarize } from '../src/space/dataRights.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const TOKEN = 'token-sintetico'
const ID = '3f2b8c1e-4d5a-4b6c-9d7e-0123456789ab'
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
store.set('elevation_token', TOKEN)

function mockFetch(handler) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body, auth: options.headers.Authorization })
    const { status = 200, body = {} } = handler(url, options)
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }
  return calls
}

test('ES-135: la vista previa pide solo la exportación personal en el idioma activo y resume las secciones del archivo', async () => {
  const calls = mockFetch(() => ({ status: 201, body: { id: ID, expiresAt: '2026-11-01T15:00:00.000Z', data: { profile: { name: 'x' }, diary: [1, 2, 3], consents: [] } } }))
  const preview = await prepareExport(TOKEN, 'en')
  assert.equal(calls[0].url, '/api/exports/preview'); assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].auth, `Bearer ${TOKEN}`)
  assert.deepEqual(JSON.parse(calls[0].body), { type: 'personal', locale: 'en' })
  assert.deepEqual(preview.sections, [{ name: 'profile', count: null }, { name: 'diary', count: 3 }, { name: 'consents', count: 0 }])
  assert.equal(preview.id, ID)
})

test('ES-135: una respuesta mal formada no se acepta y las secciones no inventan datos', async () => {
  mockFetch(() => ({ status: 201, body: { id: 'no-es-uuid', expiresAt: '2026-11-01T15:00:00.000Z', data: {} } }))
  await assert.rejects(prepareExport(TOKEN, 'es'), (e) => e instanceof SpaceError && e.status === 502)
  mockFetch(() => ({ status: 201, body: { id: ID, expiresAt: 'nunca', data: {} } }))
  await assert.rejects(prepareExport(TOKEN, 'es'), (e) => e instanceof SpaceError && e.status === 502)
  assert.deepEqual(summarize(null), []); assert.deepEqual(summarize([1]), []); assert.deepEqual(summarize({}), [])
})

test('ES-135: la descarga usa el id de la vista previa y entrega el JSON solo en memoria', async () => {
  const calls = mockFetch(() => ({ body: { profile: { name: 'x' } } }))
  const blob = await downloadExport(TOKEN, ID)
  assert.equal(calls[0].url, `/api/exports/${ID}/download`); assert.equal(calls[0].method, 'POST')
  assert.equal(blob.type, 'application/json'); assert.deepEqual(JSON.parse(await blob.text()), { profile: { name: 'x' } })
  await assert.rejects(downloadExport(TOKEN, '../otro'), (e) => e instanceof SpaceError && e.status === 404)
  assert.equal(calls.length, 1)
  const page = read('../src/space/DataPage.tsx')
  assert.doesNotMatch(page, /localStorage\.setItem|sessionStorage|console\./)
})

test('ES-135: eliminar la cuenta envía confirm:true exacto y exige el recibo del servidor', async () => {
  const calls = mockFetch(() => ({ status: 202, body: { id: 'abc', status: 'accepted', repeated: false } }))
  await requestDeletion(TOKEN)
  assert.equal(calls[0].url, '/api/account/deletion-requests'); assert.deepEqual(JSON.parse(calls[0].body), { confirm: true })
  mockFetch(() => ({ status: 200, body: {} }))
  await assert.rejects(requestDeletion(TOKEN), (e) => e instanceof SpaceError && e.status === 502)
})

test('ES-135: cada código del servidor produce un aviso en ES y en EN, sin texto en el idioma equivocado', () => {
  const cases = [
    [new SpaceError(401), 'session'], [new SpaceError(503, 'data_rights_unavailable'), 'unavailable'], [new SpaceError(429, 'rate_limited'), 'rate'],
    [new SpaceError(404, 'export_not_found'), 'expired'], [new SpaceError(409, 'concurrent_change'), 'concurrent'], [new SpaceError(409, 'data_review_required'), 'review'],
    [new SpaceError(403, 'deletion_pending'), 'pending'], [new SpaceError(503, 'data_rights_failed'), 'error'], [new TypeError('Failed to fetch'), 'error'], [new SpaceError(400, 'invalid_input'), 'error'],
  ]
  for (const [error, key] of cases) {
    assert.equal(dataErrorKey(error), key)
    assert.ok(dataCopy.es[key] && dataCopy.en[key] && dataCopy.es[key] !== dataCopy.en[key], key)
    assert.doesNotMatch(dataCopy.en[key], /sesión|Inténtalo|solicitud|función|cuenta/i)
    assert.doesNotMatch(dataCopy.es[key], /Try again|session|request|feature|account/i)
  }
})

test('ES-135: los textos existen en ES y EN con las mismas claves, sin plazos prometidos', () => {
  assert.deepEqual(Object.keys(dataCopy.es).sort(), Object.keys(dataCopy.en).sort())
  for (const lang of ['es', 'en']) for (const [key, text] of Object.entries(dataCopy[lang])) assert.ok([text].flat().every((line) => line.trim()), `${lang}.${key}`)
  assert.match(dataCopy.es.deleteDone, /Todavía no podemos indicarte una fecha/); assert.match(dataCopy.en.deleteDone, /cannot give you a date/)
  assert.doesNotMatch(dataCopy.es.deleteDone + dataCopy.en.deleteDone, /\b\d+\s*(días|dias|days|horas|hours)\b/i)
})

test('ES-135: la pantalla confirma en dos pasos, cierra la sesión y está accesible desde la ruta y el menú', () => {
  const page = read('../src/space/DataPage.tsx')
  assert.match(page, /disabled=\{!matches \|\| busy === 'delete'\}/); assert.doesNotMatch(page, /window\.confirm/) // ES-174: la casilla pasó a palabra de confirmación
  assert.match(page, /invalidateStoredSession\(deletedToken\.current\)/); assert.match(read('../src/space/SpaceDialog.tsx'), /onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\) \}\}/) // Escape llega como «cancel» del <dialog>
  assert.match(read('../src/App.tsx'), /path="\/app\/data" element=\{<DataPage \/>\}/)
  assert.match(read('../src/space/SpaceNav.tsx'), /to="\/app\/data"/)
})

// QA-135-01: al cerrar el paso 2 el botón de inicio se vuelve a montar; el foco se devuelve DESPUÉS del render (verificado también en navegador real, 390 y 1440 px, ES y EN).
test('ES-135: el foco vuelve al botón de inicio después del render, no antes', () => {
  const page = read('../src/space/DataPage.tsx')
  // ES-174: el botón de inicio ya no se desmonta al abrir el diálogo; <dialog>.showModal() devuelve el foco al disparador al cerrar (verificado en navegador real).
  assert.match(page, /<button className="elv-btn space-danger" disabled=\{!!busy \|\| !token \|\| off\} onClick=\{\(\) => setOpen\(true\)\}>/)
  assert.doesNotMatch(page, /startRef|refocus/)
})

test('ES-135: la lista «Qué incluye» usa etiquetas ES/EN, oculta metadatos y deja la clave desconocida tal cual', () => {
  const sections = summarize({ schemaVersion: 1, type: 'personal', locale: 'es', profile: {}, chatTurns: [], diary: [1], nueva: [1, 2] })
  assert.deepEqual(sections.map((s) => s.name), ['profile', 'chatTurns', 'diary', 'nueva'])
  for (const lang of ['es', 'en']) for (const key of ['profile', 'chatTurns', 'diary', 'consents', 'evidence', 'moods']) assert.ok(sectionLabels[lang][key], `${lang}.${key}`)
  assert.notEqual(sectionLabels.es.chatTurns, sectionLabels.en.chatTurns)
  assert.deepEqual(Object.keys(sectionLabels.es).sort(), Object.keys(sectionLabels.en).sort())
})

test('ES-135: si el servidor responde que la función no está disponible, no se ofrece ninguna acción', () => {
  const page = read('../src/space/DataPage.tsx')
  assert.match(page, /if \(k === 'unavailable'\) \{ setOff\(true\)/)
  assert.match(page, /disabled=\{!!busy \|\| !token \|\| off\} onClick=\{\(\) => void prepare\(\)\}/)
  assert.match(page, /disabled=\{!!busy \|\| !token \|\| off\} onClick=\{\(\) => setOpen\(true\)\}/)
})
