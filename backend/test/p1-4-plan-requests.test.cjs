const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');

test('P1-4: plan request review requires admin even through the user mount', async t => {
  let calls = 0;
  let reviewed;
  const account = record({ id: 202, planId: null });
  models.PlanRequest.findAll = async () => { calls++; return []; };
  models.PlanRequest.findByPk = async () => {
    calls++;
    reviewed = record({ id: 7, userId: 202, planId: 9, status: 'pending' });
    return reviewed;
  };
  models.User.findByPk = async () => { calls++; return account; };
  models.PricingPlan.findOne = async () => ({ id: 9, name_es: 'Prueba' });
  models.PlanRequest.findOne = async () => null;
  models.PlanRequest.create = async values => record({ id: 8, ...values });
  const request = await startApp(t);

  for (const [method, suffix, body] of [
    ['GET', '/admin', undefined],
    ['PUT', '/admin/7/approve', {}],
    ['PUT', '/admin/7/reject', { adminNote: 'Synthetic review' }],
  ]) await t.test(method + ' ' + suffix, async () => {
    for (const prefix of ['/api/plan-requests', '/api/admin/plan-requests']) {
      for (const role of [undefined, 'user', 'therapist', 'board']) {
        const before = calls;
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 403);
        assert.equal(calls, before);
      }
      assert.equal((await request(method, prefix + suffix, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      for (const role of ['admin', 'superadmin']) {
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 200);
        if (suffix.endsWith('/approve')) {
          assert.equal(account.planId, 9);
          assert.equal(reviewed.status, 'approved');
          assert.equal(reviewed.resolvedBy, 101);
        }
        if (suffix.endsWith('/reject')) assert.equal(reviewed.status, 'rejected');
      }
    }
  });
  const submitted = await request('POST', '/api/plan-requests', { role: 'user', body: { planId: 9 } });
  assert.equal(submitted.status, 201);
  assert.equal((await request('GET', '/api/plan-requests/me', { role: 'user' })).status, 200);
});
