import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const url = (file, replacements = []) => {
  let code = ts.transpileModule(fs.readFileSync(new URL('../src/routeCatalog/' + file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const schemaUrl = url('schema.ts'); const { kinds, schemas, payload, safeUrl, validKey, fieldLabel } = await import(schemaUrl)
const { detail, published, catalogApi } = await import(url('api.ts', [["'./schema'", JSON.stringify(schemaUrl)]]))
const { catalogEs, catalogEn } = await import(url('copy.ts'))
for (const kind of kinds) test('ES-31: ' + kind + ' serializer excludes server metadata and preserves synthetic provenance', () => {
  const spec = schemas[kind][0]; const value = spec.type === 'group' ? { es: 'Sintético', en: 'Synthetic' } : 'official'
  assert.deepEqual(payload(kind, { [spec.key]: value, itemKey: 'test_key', missing: ['private'], synthetic: false, OwnerId: 8 }, true), { [spec.key]: value, synthetic: true })
})
test('ES-31: price zero, unknown salary and explicit false are preserved without fabricated numbers', () => {
  assert.deepEqual(payload('resources', { price: { published: true, amount: 0, currency: 'COP' } }, false).price, { published: true, amount: 0, currency: 'COP' })
  assert.deepEqual(payload('resources', { price: { published: false, amount: 88, currency: 'COP' } }, false).price, { published: false })
  assert.deepEqual(payload('offers', { salary: { published: false, text: 'OLD' } }, false).salary, { published: false })
})
test('ES-31: nested tasks, barriers and capability references survive full PUT replacement', () => {
  const body = { tasks: [{ text: { es: 'Tarea', en: 'Task' }, aiExposure: { status: 'hypothesis', note: { es: 'Por validar', en: 'To validate' } } }], barriers: [{ es: 'Barrera', en: 'Barrier' }], capabilities: [{ skillKey: 'valid_key', importance: 'optional' }] }
  assert.deepEqual(payload('roles', body, false), body)
})
test('ES-31: blank optional groups omitted; no false review or accessibility defaults', () => {
  assert.deepEqual(payload('sources', { consultedAt: '', consultedBy: '', country: null }, false), { country: null })
  assert.deepEqual(payload('roles', { review: { by: '', at: '' } }, false), {})
})
test('ES-31: safe links do not execute unsafe protocols, credentials, IPs or local hosts', () => {
  for (const value of ['javascript:alert(1)', 'http://example.org', 'https://u:p@example.org', 'https://127.0.0.1', 'https://10.0.0.1', 'https://localhost', 'https://service.local', 'https://[::1]']) assert.equal(safeUrl(value), null)
  assert.equal(safeUrl('https://example.org/path'), 'https://example.org/path')
})
test('ES-31: stable keys are bounded and missing field labels are ES/EN', () => {
  for (const value of ['../x', 'AB', 'a', 'a'.repeat(49)]) assert.equal(validKey(value), false)
  assert.ok(validKey('valid_key')); assert.equal(fieldLabel('roles', 'tasks.0.text', 'es'), 'Tareas · Tarea')
  assert.equal(fieldLabel('roles', 'review', 'en'), 'Domain review')
})
test('ES-31: malformed descriptor and missing freshness flags fail closed', () => {
  assert.throws(() => detail({ id: 1, version: 1, status: 'published', publishedAt: null, itemCount: 0 }))
  assert.throws(() => published({ version: 1, publishedAt: '2026-10-27', contexts: [], sources: [{ sourceKey: 'valid_key' }], roles: [], offers: [], resources: [] }))
})
test('ES-31: existing session, no-store and exact HTTP/body; no injected owner', async () => {
  const original = globalThis.fetch; const calls = []
  globalThis.fetch = async (url, init) => { calls.push([url, init]); return new Response(JSON.stringify({ itemKey: 'valid_key', labels: { es: 'ES', en: 'EN' } })) }
  try { await catalogApi('', 'synthetic-token').save(2, 'contexts', 'valid_key', { labels: { es: 'ES', en: 'EN' } }) } finally { globalThis.fetch = original }
  assert.equal(calls[0][0], '/api/admin/route-catalog/2/contexts/valid_key'); assert.equal(calls[0][1].method, 'PUT'); assert.equal(calls[0][1].cache, 'no-store'); assert.equal(calls[0][1].headers.Authorization, 'Bearer synthetic-token'); assert.deepEqual(JSON.parse(calls[0][1].body), { labels: { es: 'ES', en: 'EN' } })
})
test('ES-31: i18n key sets match and all labels are bilingual', () => {
  assert.deepEqual(Object.keys(catalogEs), Object.keys(catalogEn)); assert.ok(Object.values(catalogEs).every(Boolean)); assert.ok(Object.values(catalogEn).every(Boolean))
  function check(specs) { for (const field of specs) { assert.ok(field.es && field.en); if (field.children) check(field.children) } }
  for (const kind of kinds) check(schemas[kind])
})
