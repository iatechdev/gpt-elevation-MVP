import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readVerifiedSession, sessionDestination, registrationRequested, authFailureKey, invalidateStoredSession, participantEntry } from '../src/access/session.ts'

test('ES-74/ES-14: persisted context is canonical over the legacy onboarding flag and restores language', () => {
  const legacy = { role: 'user', onboardingCompleted: true }
  assert.equal(participantEntry(legacy, { completedAt: null, context: null }).session.onboardingCompleted, false)
  const draft = { completedAt: null, context: { preferredLanguage: 'en' } }
  assert.equal(participantEntry(legacy, draft).session.onboardingCompleted, false)
  const completed = { ...draft, completedAt: '2026-10-28T12:00:00.000Z' }
  const result = participantEntry({ ...legacy, onboardingCompleted: false }, completed)
  assert.equal(result.session.onboardingCompleted, true)
  assert.equal(result.preferredLanguage, 'en')
  assert.equal(sessionDestination(result.session), '/app/dashboard')
  for (const context of [{ ...draft, completedAt: undefined }, { ...draft, completedAt: 'invalid' }, { completedAt: completed.completedAt, context: null }, { ...completed, context: { preferredLanguage: 'unknown' } }]) assert.throws(() => participantEntry(legacy, context))
})

test('ES-74: destination allowlist follows canonical role and onboarding, never arbitrary URLs', () => {
  for (const [role, destination] of [['admin', '/admin/dashboard'], ['superadmin', '/admin/dashboard'], ['therapist', '/therapist/dashboard'], ['board', '/board/manifest']]) {
    assert.equal(sessionDestination({ role, onboardingCompleted: false }), destination)
  }
  assert.equal(sessionDestination({ role: 'user', onboardingCompleted: false }), '/app/onboarding')
  assert.equal(sessionDestination({ role: 'user', onboardingCompleted: true }), '/app/dashboard')
  assert.throws(() => sessionDestination({ role: 'https://example.invalid', onboardingCompleted: true }))
  for (const value of ['', '?mode=login', '?mode=REGISTER', '?door=2', '?returnTo=https://example.invalid']) assert.equal(registrationRequested(value), false)
  assert.equal(registrationRequested('?mode=register'), true)
})

test('ES-74: session reader sends only bearer GET/no-store, validates minimal payload, never decodes local role', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.example.invalid/api/session')
    assert.deepEqual(options.headers, { Authorization: 'Bearer synthetic-session' })
    assert.equal(options.cache, 'no-store')
    assert.equal(options.body, undefined)
    return { status: 200, json: async () => ({ role: 'user', onboardingCompleted: false }) }
  })
  assert.deepEqual(await readVerifiedSession({ baseUrl: 'https://api.example.invalid', token: 'synthetic-session' }), {
    status: 'verified', session: { role: 'user', onboardingCompleted: false },
  })
})

test('ES-74: invalid session differs from unavailable/malformed/network/timeout and cannot redirect', async t => {
  for (const status of [401, 403, 404, 429, 500, 503]) {
    t.mock.method(globalThis, 'fetch', async () => ({ status }))
    assert.equal((await readVerifiedSession({ token: 'synthetic' })).status, [401, 403].includes(status) ? 'invalid' : 'unavailable')
    t.mock.restoreAll()
  }
  for (const body of [null, [], {}, { role: 'admin' }, { role: 'user', onboardingCompleted: 'true' },
    { role: 'invented', onboardingCompleted: false }, { role: 'user', onboardingCompleted: false, name: 'unexpected' }]) {
    t.mock.method(globalThis, 'fetch', async () => ({ status: 200, json: async () => body }))
    assert.equal((await readVerifiedSession({ token: 'synthetic' })).status, 'unavailable')
    t.mock.restoreAll()
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic offline') })
  assert.equal((await readVerifiedSession({ token: 'synthetic' })).status, 'unavailable')
  t.mock.restoreAll()
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Synthetic abort')), { once: true })
  }))
  assert.equal((await readVerifiedSession({ token: 'synthetic', timeoutMs: 5 })).status, 'unavailable')
})

test('ES-74: delayed invalidation cannot clear a newer login or write door data', () => {
  const rows = new Map([['elevation_token', 'new-session'], ['elevation_role', 'user'], ['elevation_name', 'Synthetic']])
  const removed = []
  const originals = ['localStorage', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => rows.get(key), removeItem: key => { removed.push(key); rows.delete(key) } } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => {} } })
    invalidateStoredSession('old-session')
    assert.deepEqual(removed, [])
    invalidateStoredSession('new-session')
    assert.deepEqual(removed, ['elevation_token', 'elevation_role', 'elevation_name'])
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})

test('ES-74: known login/register errors retain their meaning as ES/EN content keys', () => {
  for (const [status, data, registering, key] of [
    [423, { locked: true }, false, 'locked'], [429, {}, false, 'rate_limit'],
    [403, { deactivated: true }, false, 'inactive'], [403, { code: 'deletion_pending' }, false, 'deletion_pending'],
    [400, { error: 'El correo ya está registrado.' }, true, 'duplicate'], [401, {}, false, 'credentials'],
    [400, {}, true, 'invalid'], [500, { error: 'untrusted message' }, false, 'failed'],
  ]) assert.equal(authFailureKey(status, data, registering), 'landing.access.' + key)
})
