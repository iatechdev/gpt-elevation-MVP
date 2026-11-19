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
  // E366-1: la validación sigue siendo estricta por FILA, pero una fila inválida ya no lanza: se omite (ver abajo). Lo que NO es una lista sigue lanzando.
  for (const values of [{}, null]) assert.throws(() => parsePlans(values))
  for (const values of [[row(), row()], [row({ name_en: '' })], [row({ currency: 'XYZ' })], [row({ period: 'forever' })], [row({ features_es: 'invented' })], [row({ price: null })]]) assert.ok(parsePlans(values, () => {}).length < values.length, 'la fila inválida (o repetida) se omite')
  assert.deepEqual(parsePlans([row({ id: 2, order: 2 }), row({ id: 1 })]).map(p => p.id), [1, 2])
})

// E366-1 (ALTO, QA-Claude-2 sobre #366): un plan inválido o con un período que la pantalla no sabe dibujar (legado, p. ej. `forever`) ya no tumba /pricing para todas las personas: se OMITE
// (y se registra el id y el motivo, nunca el contenido) y los demás se muestran. Solo sigue siendo error de toda la respuesta lo que no es una lista o trae más de 1000 filas.
test('E366-1: un plan con período desconocido o legado se omite y los demás se muestran (antes: «No se pudieron cargar los planes» para todo el mundo)', () => {
  const skipped = []
  const plans = parsePlans([row({ id: 1, order: 2 }), row({ id: 2, period: 'forever' }), row({ id: 3, order: 1, period: 'year' }), row({ id: 4, period: 'week' }), row({ id: 5, period: 'decada' })], skip => skipped.push(skip))
  assert.deepEqual(plans.map(p => p.id), [3, 1], 'los válidos, ordenados')
  assert.deepEqual(skipped.map(s => s.id), [2, 4, 5])
  assert.ok(skipped.every(s => s.reason === 'período no admitido'), JSON.stringify(skipped))
})

test('E366-1: cualquier fila inválida se omite por separado (nombre, moneda, precio, forma, id repetido, no objeto) y las buenas siguen', () => {
  const skipped = []
  const bad = [row({ id: 10, name_en: '' }), row({ id: 11, currency: 'XYZ' }), row({ id: 12, features_es: 'inventado' }), row({ id: 13, price: null }), row({ id: 14, isHighlighted: 'sí' }), row({ id: 15, order: 1.5 }),
    row({ id: 7 }), null, 'texto', 42, [], { id: -1 }, { id: 'x' }, row({ id: 17, slug: '' })]
  const plans = parsePlans([row({ id: 7 }), ...bad], skip => skipped.push(skip))
  assert.deepEqual(plans.map(p => p.id), [7], 'solo la primera fila con id 7; la repetida y todas las inválidas se omiten')
  assert.equal(skipped.length, bad.length)
  assert.ok(skipped.some(s => s.reason === 'id repetido') && skipped.some(s => s.reason === 'moneda no admitida') && skipped.some(s => s.reason === 'precio inválido') && skipped.some(s => s.reason === 'nombre inválido') && skipped.some(s => s.reason === 'no es un objeto'))
  assert.deepEqual(parsePlans([row({ period: 'forever' })], () => {}), [], 'si TODAS son inválidas queda una lista vacía (la pantalla muestra «sin planes», no el error)')
})

test('E366-1: lo que sigue siendo error de toda la respuesta: no es una lista o trae más de 1000 filas; y el registro por defecto dice el id y el motivo, nunca el contenido', () => {
  for (const value of [{}, null, undefined, 'x', 5, { plans: [] }, Array.from({ length: 1001 }, (_, i) => row({ id: i + 1 }))]) assert.throws(() => parsePlans(value), `no es una lista válida: ${typeof value}`)
  const logged = []; const original = console.warn; console.warn = (...args) => logged.push(args.join(' '))
  try { parsePlans([row({ id: 99, period: 'forever', name_es: 'NOMBRE-SECRETO-DEL-PLAN' })]) } finally { console.warn = original }
  assert.equal(logged.length, 1); assert.match(logged[0], /id 99/); assert.match(logged[0], /período no admitido/)
  assert.ok(!logged[0].includes('NOMBRE-SECRETO-DEL-PLAN'), 'el registro no repite el contenido del plan')
})

test('E366-1: readPlans con la respuesta REAL del servidor (un plan con «forever» entre planes buenos) devuelve los buenos sin lanzar', async () => {
  const realFetch = globalThis.fetch; const original = console.warn; console.warn = () => {}
  globalThis.fetch = async () => new Response(JSON.stringify([row({ id: 1 }), row({ id: 2, period: 'forever' }), row({ id: 3, order: 3, period: 'year' })]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try { assert.deepEqual((await readPlans('')).map(p => p.id), [1, 3]) } finally { globalThis.fetch = realFetch; console.warn = original }
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
