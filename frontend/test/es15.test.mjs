import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validDate, validDraft, entry, makeIntent, request, SpaceError } from '../src/space/api.ts'
import { copy } from '../src/space/copy.ts'
test('ES-15: real calendar, server date margin, Unicode and full content limits', () => {
  assert.equal(validDate('2026-02-29'), false)
  assert.equal(validDate('2024-02-29'), true)
  assert.equal(validDate('2026-11-01', Date.parse('2026-10-27')), false)
  assert.equal(validDraft('2026-10-01', '  á\nEnglish 🧭  '), true)
  assert.equal(validDraft('2026-10-01', ' '.repeat(2)), false)
  assert.equal(validDraft('2026-10-01', 'a'.repeat(10000)), true)
  assert.equal(validDraft('2026-10-01', 'a'.repeat(10001)), false)
})
test('ES-15: each intent owns an immutable body, with no implicit context', () => {
  const ids = [1, 2, 3]; const first = makeIntent(' message ', 'en', ids)
  ids.pop(); assert.deepEqual(first.contextEntryIds, [1, 2, 3]); assert.equal(first.message, 'message')
  assert.throws(() => first.contextEntryIds.push(4), TypeError)
  assert.throws(() => { first.lang = 'es' }, TypeError)
  assert.notEqual(makeIntent('message', 'en', []).requestId, first.requestId)
  assert.equal(Object.hasOwn(makeIntent('message', 'en', []), 'contextEntryIds'), false)
  for (const invalid of [[1, 2, 3, 4], [1, 1], [0], ['1']]) assert.throws(() => makeIntent('message', 'en', invalid), SpaceError)
  assert.throws(() => makeIntent('a'.repeat(4001), 'en', []), SpaceError)
})
test('ES-15: boundary parsing drops unexpected owner fields and rejects invalid responses', () => {
  const data = { id: 1, date: '2026-10-01', content: 'private', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', UserId: 202 }
  assert.equal(Object.hasOwn(entry(data), 'UserId'), false)
  for (const invalid of [null, {}, { ...data, id: -1 }, { ...data, updatedAt: 'invalid' }, { ...data, content: null }]) assert.throws(() => entry(invalid), SpaceError)
})
test('ES-15: no request after session change; rejects late private response and non-2xx reply', async () => {
  const oldFetch = globalThis.fetch; const oldStorage = globalThis.localStorage
  let token = 'synthetic-A'; let calls = 0
  globalThis.localStorage = { getItem: () => token }
  try {
    globalThis.fetch = async () => { calls++; return Response.json({ reply: 'must not be confirmed', code: 'ai_budget_exhausted', retryable: false }, { status: 429 }) }
    await assert.rejects(request(token, '/api/chat'), error => error.status === 429 && error.code === 'ai_budget_exhausted' && !error.retryable)
    globalThis.fetch = async () => { calls++; token = 'synthetic-B'; return Response.json({ content: 'late A response' }) }
    await assert.rejects(request('synthetic-A', '/api/diary'), error => error.status === 401)
    await assert.rejects(request('synthetic-A', '/api/diary'), error => error.status === 401)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = oldFetch; if (oldStorage) globalThis.localStorage = oldStorage; else delete globalThis.localStorage }
})
test('ES-15: complete bilingual copy with visible privacy and recovery limits', () => {
  assert.deepEqual(Object.keys(copy.es).sort(), Object.keys(copy.en).sort())
  for (const lang of ['es', 'en']) for (const value of Object.values(copy[lang])) assert.ok(value.trim())
  assert.match(copy.es.limit, /100/); assert.match(copy.en.contextLimit, /2,000/)
  assert.match(copy.es.deleteLimit, /no borra mensajes/); assert.match(copy.en.duplicate, /duplicate/)
})
