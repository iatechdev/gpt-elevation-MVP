const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, database, record, startApp } = require('./support.cjs');
const reviewed = require('../content/reviewedPricingCopy');
const { reviewedPricingCopy } = require('../scripts/reviewedPricingCopy.cjs');
const publicPricingCopy = require('../content/publicPricingCopy');

test('ES-73: public plans are active/ordered/whitelisted and protected /me cannot read another owner', async t => {
  const request = await startApp(t);
  models.PricingPlan.findAll = async options => {
    assert.deepEqual(options.where, { isActive: true });
    assert.deepEqual(options.order, [['order', 'ASC']]);
    assert.ok(!options.attributes.includes('createdAt'));
    return [{ id: 9, name_es: 'Sintético', name_en: 'Synthetic', price: '0.00' }];
  };
  const reads = [];
  models.User.findByPk = async id => { reads.push(id); return { plan: { id, slug: 'synthetic', name_es: 'Propio', name_en: 'Own' } }; };
  const publicRead = await request('GET', '/api/plans');
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.headers.get('cache-control'), 'no-store');
  for (const prefix of ['/api/plans', '/api/user/plan']) {
    assert.equal((await request('GET', prefix + '/me')).status, 403);
    assert.equal((await request('GET', prefix + '/me', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    assert.equal((await request('GET', prefix + '/me?id=202', { role: 'user' })).status, 400);
    for (const id of [101, 202]) assert.equal((await request('GET', prefix + '/me', { role: 'user', id })).body.plan.id, id);
  }
  assert.deepEqual(reads, [101, 202, 101, 202]);
});

test('ES-73: request commits before 201, owner comes only from JWT and malformed/alien inputs never write', async t => {
  const request = await startApp(t);
  let committed = false, writes = 0, rolledBack = 0, planActive = true, ownerActive = true, already = false;
  database.sequelize.transaction = async () => ({ LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' }, commit: async () => { committed = true; }, rollback: async () => { rolledBack++; } });
  models.User.findByPk = async (id, options) => { assert.equal(id, 101); assert.equal(options.lock, 'UPDATE'); return { id, active: ownerActive }; };
  models.PricingPlan.findOne = async ({ where, lock }) => { assert.deepEqual(where, { id: 9, isActive: true }); assert.equal(lock, 'SHARE'); return planActive ? { id: 9, name_es: 'Sintético' } : null; };
  models.PlanRequest.findOne = async ({ where }) => { assert.deepEqual(where, { userId: 101, status: 'pending' }); return already ? { id: 7 } : null; };
  models.PlanRequest.create = async (values, options) => { writes++; assert.deepEqual(values, { userId: 101, planId: 9, status: 'pending' }); assert.ok(options.transaction); return { id: 7, ...values }; };
  for (const body of [{ planId: 9, userId: 202 }, { planId: 9, ownerId: 202 }, { planId: -1 }, { planId: {} }]) assert.equal((await request('POST', '/api/plan-requests', { role: 'user', body })).status, 400);
  assert.equal(writes, 0);
  const submitted = await request('POST', '/api/plan-requests', { role: 'user', body: { planId: 9 } });
  assert.equal(submitted.status, 201); assert.ok(committed); assert.equal(submitted.body.request.status, 'pending');
  assert.equal(submitted.body.request.userId, undefined);
  already = true;
  assert.equal((await request('POST', '/api/plan-requests', { role: 'user', body: { planId: 9 } })).status, 409);
  already = false; planActive = false;
  assert.equal((await request('POST', '/api/plan-requests', { role: 'user', body: { planId: 9 } })).status, 404);
  ownerActive = false;
  assert.equal((await request('POST', '/api/plan-requests', { role: 'user', body: { planId: 9 } })).status, 401);
  assert.equal(writes, 1); assert.equal(rolledBack, 3);
});

test('ES-73: pending reads ignore no owner, reject foreign-ID query/path and database errors do not expose details', async t => {
  const request = await startApp(t);
  models.PlanRequest.findOne = async ({ where }) => record({ id: where.userId, userId: where.userId, planId: 9, status: 'pending' });
  for (const id of [101, 202]) assert.equal((await request('GET', '/api/plan-requests/me', { role: 'user', id })).body.request.userId, id);
  assert.equal((await request('GET', '/api/plan-requests/me?userId=202', { role: 'user' })).status, 400);
  assert.equal((await request('GET', '/api/plan-requests/202', { role: 'user' })).status, 404);
  models.PlanRequest.findOne = async () => { throw new Error('private database credentials'); };
  const failed = await request('GET', '/api/plan-requests/me', { role: 'user' });
  assert.equal(failed.status, 500); assert.doesNotMatch(JSON.stringify(failed.body), /credentials/);
});

test('ES-73: reviewed copy dry-run/idempotent apply changes only public wording; seed uses the same approved copy', async t => {
  const rows = Object.keys(reviewed).map(slug => record({ slug, description_es: 'Old', description_en: 'Old', features_es: [], features_en: [], price: '17.25', currency: 'USD', period: 'month', isActive: false, name_es: 'Custom name' }));
  const tx = { LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} };
  const PricingPlan = { findAll: async () => rows };
  const sequelize = { transaction: async () => tx };
  assert.equal((await reviewedPricingCopy({ PricingPlan, sequelize })).length, 4);
  assert.equal(rows[0].description_es, 'Old');
  assert.equal((await reviewedPricingCopy({ PricingPlan, sequelize, apply: true })).length, 4);
  assert.equal((await reviewedPricingCopy({ PricingPlan, sequelize, apply: true })).length, 0);
  for (const row of rows) { assert.equal(row.price, '17.25'); assert.equal(row.isActive, false); assert.equal(row.name_es, 'Custom name'); assert.doesNotMatch(JSON.stringify(reviewed[row.slug]), /ilimitad|unlimited|terap[eé]ut|therap|\d/); }
  const defaults = [];
  models.PricingPlan.findOrCreate = async options => { defaults.push(options.defaults); return [{ slug: options.where.slug }, true]; };
  const request = await startApp(t);
  assert.equal((await request('POST', '/api/pricing/seed', { role: 'admin', body: {} })).status, 200);
  assert.equal(defaults.length, 4);
  for (const row of defaults) for (const key of Object.keys(reviewed[row.slug])) assert.deepEqual(row[key], reviewed[row.slug][key]);
});

test('ES-73: exact legacy copy is safe on first public read, custom admin text and financial values remain authoritative', () => {
  const legacy = require('../content/legacyPricingCopy.json');
  for (const slug of Object.keys(legacy)) {
    const input = { slug, ...legacy[slug], price: '17.25', currency: 'USD', period: 'month', name_es: 'Own name', isHighlighted: true };
    const result = publicPricingCopy(input);
    for (const key of Object.keys(reviewed[slug])) assert.deepEqual(result[key], reviewed[slug][key]);
    assert.equal(input.description_es, legacy[slug].description_es, 'Reader must not mutate persistence');
    for (const key of ['price', 'currency', 'period', 'name_es', 'isHighlighted']) assert.equal(result[key], input[key]);
    assert.equal(publicPricingCopy({ ...input, description_en: 'Admin edited' }).description_en, 'Admin edited');
  }
});
