import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accessParams, displayPrice, parsePlans, planDestination, planIntent, planLogin, priceCents, readPending, readPlans, requestPlan } from '../src/pricing/plans.ts'

const row = overrides => ({ id: 7, slug: 'synthetic', name_es: 'Sintético', name_en: 'Synthetic', description_es: 'Ejemplo', description_en: 'Example', price: '0.00', currency: 'USD', period: 'month', features_es: ['Ejemplo'], features_en: ['Example'], isHighlighted: false, order: 1, ...overrides })

test('ES-73: DECIMAL zero is free, invalid/missing amounts never become zero; catalogue is bilingual and strict', () => {
  assert.equal(priceCents('0.00'), 0); assert.equal(priceCents(0), 0); assert.equal(priceCents('12.34'), 1234)
  for (const value of ['', ' ', null, undefined, '-1', -1, NaN, Infinity, '1e2', '1.234', '100000000']) assert.throws(() => priceCents(value))
  const plan = parsePlans([row()])[0]
  assert.equal(displayPrice(plan, 'es', 'Gratis'), 'Gratis')
  assert.equal(displayPrice({ ...plan, priceCents: 1234 }, 'en', 'Free'), '12.34 USD')
  assert.deepEqual(parsePlans([]), [])
  for (const values of [[row(), row()], [row({ name_en: '' })], [row({ currency: 'XYZ' })], [row({ period: 'forever' })], [row({ features_es: 'invented' })], [row({ price: null })], {}, null]) assert.throws(() => parsePlans(values))
  assert.deepEqual(parsePlans([row({ id: 2, order: 2 }), row({ id: 1 })]).map(p => p.id), [1, 2])
})

test('ES-73: exact public plan intent survives registration/login; arbitrary URLs, duplicates and owners do not', () => {
  assert.equal(planLogin(7), '/login?mode=register&plan=7')
  assert.deepEqual(accessParams(false, 7), { plan: '7' })
  assert.deepEqual(accessParams(true, 7), { mode: 'register', plan: '7' })
  assert.equal(planDestination('?mode=register&plan=7&returnTo=https://example.invalid'), '/pricing?plan=7')
  for (const search of ['', '?plan=0', '?plan=-1', '?plan=1.2', '?plan=01', '?plan=1e2', '?plan=https://example.invalid', '?plan=1&plan=2', '?plan=9007199254740992', '?userId=7']) assert.equal(planIntent(search), null)
})

test('ES-73: public GET is fresh and contains no auth, IDs or body; malformed is error, never empty success', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/plans'); assert.equal(options.cache, 'no-store'); assert.equal(options.headers, undefined); assert.equal(options.body, undefined)
    return { ok: true, status: 200, json: async () => [row()] }
  })
  assert.equal((await readPlans(''))[0].priceCents, 0)
  for (const response of [{ ok: false, status: 500 }, { ok: true, status: 200, json: async () => ({}) }]) {
    t.mock.restoreAll(); t.mock.method(globalThis, 'fetch', async () => response)
    await assert.rejects(readPlans(''))
  }
})

test('ES-73: own requests send planId only, require exact 201/pending, and never automatically retry a write', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++; assert.equal(options.cache, 'no-store'); assert.equal(options.headers.Authorization, 'Bearer synthetic')
    if (url.endsWith('/me')) { assert.equal(options.body, undefined); return { ok: true, status: 200, json: async () => ({ request: null }) } }
    assert.equal(url, '/api/plan-requests'); assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), { planId: 7 })
    return { ok: true, status: 201, json: async () => ({ request: { id: 4, planId: 7, status: 'pending' } }) }
  })
  assert.equal(await readPending('', 'synthetic'), null)
  assert.deepEqual(await requestPlan('', 'synthetic', 7), { id: 4, planId: 7, status: 'pending' })
  assert.equal(calls, 2)
  for (const response of [
    { ok: true, status: 200, json: async () => ({ request: { id: 4, planId: 7, status: 'pending' } }) },
    { ok: true, status: 201, json: async () => ({ request: { id: 4, planId: 8, status: 'pending' } }) },
    { ok: false, status: 409 },
  ]) { t.mock.restoreAll(); t.mock.method(globalThis, 'fetch', async () => response); await assert.rejects(requestPlan('', 'synthetic', 7)) }
  t.mock.restoreAll(); let attempts = 0
  t.mock.method(globalThis, 'fetch', async () => { attempts++; throw new Error('Lost acknowledgement') })
  await assert.rejects(requestPlan('', 'synthetic', 7)); assert.equal(attempts, 1)
})
