import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
function url(file, replace = []) {
  let code = ts.transpileModule(fs.readFileSync(new URL('../src/compass/' + file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  for (const [a, b] of replace) code = code.replaceAll(a, b)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = url('model.ts')
const { selectedFields, parseContext, parseVersion, parsePreview } = await import(modelUrl)
const { compassApi } = await import(url('api.ts', [["'./model'", JSON.stringify(modelUrl)]]))
const { compassEs, compassEn } = await import(url('copy.ts'))
const field = { key: 'interests', text: 'Synthetic professional context' }
const row = { id: 'one', ...field, selected: true }
const version = { version: 1, status: 'active', approvedAt: '2026-10-27T12:00:00Z', revokedAt: null, fields: [field], needsReview: false }
test('ES-26: unchecked and rejected fields never enter the serializer; direct origin is explicit', () => {
  assert.deepEqual(selectedFields([{ ...row, selected: false }]).fields, [])
  assert.deepEqual(selectedFields([row, { ...row, id: 'private', text: 'UNSELECTED', selected: false }]), { fields: [{ ...field, origin: { type: 'direct' } }], errors: [] })
})
test('ES-26: selection, category, 500 characters, 3/category and 12 total are validated', () => {
  for (const rows of [[], [{ ...row, key: '' }], [{ ...row, text: ' ' }], [{ ...row, text: 'a'.repeat(501) }], Array.from({ length: 4 }, (_, i) => ({ ...row, id: String(i) }))]) assert.ok(selectedFields(rows).errors.length)
  assert.equal(selectedFields([{ ...row, text: 'a'.repeat(500) }]).errors.length, 0)
  const dozen = Array.from({ length: 12 }, (_, i) => ({ ...row, id: String(i), key: ['values', 'interests', 'motivations', 'constraints'][Math.floor(i / 3)] }))
  assert.equal(selectedFields(dozen).errors.length, 0)
  assert.ok(selectedFields([...dozen, { ...row, id: '13', key: 'energy_gives' }]).errors.includes('selection'))
})
test('ES-26: own active state must agree with history; withdrawn records stay historical', () => {
  assert.deepEqual(parseContext({ active: version, versions: [version] }).active, version)
  assert.throws(() => parseContext({ active: null, versions: [version] }))
  assert.throws(() => parseContext({ active: version, versions: [{ ...version, fields: [{ ...field, text: 'OTHER' }] }] }))
  const revoked = { ...version, status: 'revoked', revokedAt: '2026-10-27T13:00:00Z' }; delete revoked.needsReview
  assert.equal(parseContext({ active: null, versions: [revoked] }).versions[0].status, 'revoked')
})
test('ES-26: malformed API records fail closed; no owner/origin extras in parsed representations', () => {
  assert.throws(() => parseVersion({ ...version, fields: [{ key: 'risk', text: 'no' }] }))
  assert.throws(() => parsePreview({ token: 'opaque', expiresAt: 'invalid', representation: [field] }))
  assert.deepEqual(parseVersion({ ...version, UserId: 5, fields: [{ ...field, origin: { id: 8 } }] }).fields, [field])
})
test('ES-26: real client uses existing bearer, no-store and exact direct bodies; ACK is a direct version', async () => {
  const calls = []
  const fields = [{ ...field, origin: { type: 'direct' } }]
  const api = compassApi('', 'session-test', async (path, options) => {
    calls.push({ path, ...options })
    return new Response(JSON.stringify(path.endsWith('/preview') ? { token: 'opaque', expiresAt: '2026-10-27T14:00:00Z', representation: [field] } : path.endsWith('/confirm') ? version : { revoked: true }))
  })
  await api.preview(fields, 'en'); assert.equal((await api.confirm({ fields, token: 'opaque', requestId: 'synthetic-1' })).version, 1); await api.revoke()
  assert.ok(calls.every(call => call.cache === 'no-store' && call.headers.Authorization === 'Bearer session-test'))
  assert.deepEqual(JSON.parse(calls[0].body), { fields, locale: 'en' }); assert.deepEqual(JSON.parse(calls[2].body), {})
})
test('ES-26: errors whitelist code/index without exposing server text or risk classification', async () => {
  const api = compassApi('', 'session-test', async () => new Response(JSON.stringify({ code: 'field_not_shareable', fieldIndex: 0, error: 'PRIVATE_REASON' }), { status: 422 }))
  await assert.rejects(api.preview([{ ...field, origin: { type: 'direct' } }], 'es'), error => error.code === 'field_not_shareable' && error.fieldIndex === 0 && !error.message.includes('PRIVATE_REASON'))
})
test('ES-26: a mismatched preview is rejected before any confirmation', async () => {
  const api = compassApi('', 'test', async () => new Response(JSON.stringify({ token: 'opaque', expiresAt: '2026-10-27T14:00:00Z', representation: [{ ...field, key: 'values' }] })))
  await assert.rejects(api.preview([{ ...field, origin: { type: 'direct' } }], 'es'))
})
test('ES-26: ES and EN catalogs have identical nonempty keys', () => {
  assert.deepEqual(Object.keys(compassEs), Object.keys(compassEn)); assert.ok(Object.values(compassEs).every(Boolean)); assert.ok(Object.values(compassEn).every(Boolean))
})
test('ES-26: text, controls, warning and error colors meet AA on the page and white cards', () => {
  function luminance(hex) {
    const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
  }
  for (const color of ['1c1917', '4a6741', '92400e', 'b91c1c']) for (const background of ['ffffff', 'f9f9f7']) {
    const ratio = (luminance(background) + .05) / (luminance(color) + .05)
    assert.ok(ratio >= 4.5, color + ' on ' + background + ': ' + ratio)
  }
})
