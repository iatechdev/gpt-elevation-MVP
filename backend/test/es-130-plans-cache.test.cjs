const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');
const cache = require('../utils/plansCache');

const withTtl = async (ttl, fn) => {
  const before = process.env.PLANS_CACHE_TTL_MS;
  process.env.PLANS_CACHE_TTL_MS = ttl;
  cache.invalidate();
  try { await fn(); } finally {
    if (before === undefined) delete process.env.PLANS_CACHE_TTL_MS; else process.env.PLANS_CACHE_TTL_MS = before;
    cache.invalidate();
  }
};

test('ES-130: sin PLANS_CACHE_TTL_MS el caché está apagado en test', async () => {
  delete process.env.PLANS_CACHE_TTL_MS;
  const env = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  let loads = 0;
  await cache.getCachedPlans(async () => ++loads);
  await cache.getCachedPlans(async () => ++loads);
  assert.equal(loads, 2);
  if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
});

test('ES-130: las lecturas dentro del TTL comparten el valor y las simultáneas comparten una sola consulta', async () => {
  await withTtl('5000', async () => {
    let loads = 0;
    const load = async () => { loads++; await new Promise(r => setTimeout(r, 20)); return [loads]; };
    const [a, b, c] = await Promise.all([cache.getCachedPlans(load), cache.getCachedPlans(load), cache.getCachedPlans(load)]);
    assert.equal(loads, 1);
    assert.deepEqual([a, b, c], [[1], [1], [1]]);
    assert.deepEqual(await cache.getCachedPlans(load), [1]);
    assert.equal(loads, 1);
  });
});

test('ES-130: invalidate fuerza una lectura nueva y una lectura en curso no repuebla datos previos', async () => {
  await withTtl('5000', async () => {
    let release; const gate = new Promise(r => { release = r; });
    let loads = 0;
    const slow = cache.getCachedPlans(async () => { loads++; await gate; return 'viejo'; });
    cache.invalidate();
    release();
    assert.equal(await slow, 'viejo');
    assert.equal(await cache.getCachedPlans(async () => { loads++; return 'nuevo'; }), 'nuevo');
    assert.equal(loads, 2);
    cache.invalidate();
    assert.equal(await cache.getCachedPlans(async () => 'otro'), 'otro');
  });
});

test('ES-130: el valor expira tras el TTL y un error de lectura no se guarda', async () => {
  await withTtl('30', async () => {
    let loads = 0;
    await cache.getCachedPlans(async () => ++loads);
    await new Promise(r => setTimeout(r, 60));
    await cache.getCachedPlans(async () => ++loads);
    assert.equal(loads, 2);
    cache.invalidate();
    await assert.rejects(cache.getCachedPlans(async () => { throw new Error('fallo'); }), /fallo/);
    assert.equal(await cache.getCachedPlans(async () => 'ok'), 'ok');
  });
});

test('ES-130: GET /api/plans sigue siendo no-store, lee una vez dentro del TTL y escribir un plan invalida', async t => {
  await withTtl('5000', async () => {
    const request = await startApp(t);
    let reads = 0;
    models.PricingPlan.findAll = async () => { reads++; return [{ id: 9, name_es: 'Sintético', name_en: 'Synthetic', price: '0.00' }]; };
    const first = await request('GET', '/api/plans');
    const second = await request('GET', '/api/plans');
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.equal(second.headers.get('cache-control'), 'no-store');
    assert.equal(reads, 1);
    const source = require('node:fs').readFileSync(require.resolve('../PricingPlan'), 'utf8');
    for (const name of ['afterSave', 'afterDestroy', 'afterBulkCreate', 'afterBulkUpdate', 'afterBulkDestroy', 'afterUpsert']) {
      assert.match(source, new RegExp(name + ': invalidatePlansCache'), name + ' debe invalidar el caché');
    }
    cache.invalidate();
    await request('GET', '/api/plans');
    assert.equal(reads, 2);
  });
});
