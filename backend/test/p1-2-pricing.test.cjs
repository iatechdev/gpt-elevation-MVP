const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');

test('P1-2: pricing has only one public read; mutations and inactive plans require admin', async t => {
  const calls = [];
  const plan = record({ id: 7, slug: 'synthetic', isActive: true });
  for (const [method, result] of Object.entries({
    findAll: [plan], create: plan, findByPk: plan,
    findOrCreate: [plan, true],
  })) models.PricingPlan[method] = async options => { calls.push({ method, options }); return result; };
  const request = await startApp(t);
  assert.equal((await request('GET', '/api/pricing')).status, 200);
  assert.deepEqual(calls[0].options.where, { isActive: true });

  for (const [method, suffix, body, success] of [
    ['GET', '/all', undefined, 200],
    ['POST', '', { slug: 'synthetic', name_es: 'Prueba', name_en: 'Test' }, 201],
    ['POST', '/seed', {}, 200],
    ['PUT', '/7', { price: 0 }, 200],
    ['DELETE', '/7', undefined, 200],
  ]) await t.test(method + ' ' + suffix, async () => {
    for (const prefix of ['/api/pricing', '/api/admin/pricing']) {
      for (const role of [undefined, 'user', 'therapist', 'board']) {
        const before = calls.length;
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 403);
        assert.equal(calls.length, before, 'No model call on forbidden requests');
      }
      assert.equal((await request(method, prefix + suffix, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      for (const role of ['admin', 'superadmin']) {
        assert.equal((await request(method, prefix + suffix, { role, body })).status, success);
      }
    }
  });
});
