const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-73 PostgreSQL: public edits, protected aliases, A/B, concurrent submissions, rollback and reviewed copy', { timeout: 90000 }, async t => {
  const url = new URL(process.env.ES73_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Explicit loopback database required');
  const dbName = 'es73_test_' + randomBytes(8).toString('hex');
  assert.match(dbName, /^es73_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(url.toString(), { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`);
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`); created = true; url.pathname = '/' + dbName;
  sequelize = new Sequelize(url.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 8 } });
  const moduleId = require.resolve('../../database');
  require.cache[moduleId] = { id: moduleId, filename: moduleId, loaded: true, exports: { sequelize } };
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const PricingPlan = require('../../PricingPlan'), User = require('../../User'), PlanRequest = require('../../PlanRequest');
  User.belongsTo(PricingPlan, { as: 'plan', foreignKey: 'planId' });
  PlanRequest.belongsTo(PricingPlan, { as: 'plan', foreignKey: 'planId' });
  const { issueToken, revokeToken } = require('../../utils/sessions');
  const jwt = require('jsonwebtoken');
  const { verificarToken } = require('../../middlewares/auth');
  const app = require('express')();
  app.use(require('express').json());
  app.use('/api/plans', require('../../routes/plans'));
  app.use('/api/user/plan', verificarToken, require('../../routes/plans'));
  app.use('/api/plan-requests', verificarToken, require('../../routes/planRequests'));
  app.use('/api/admin/pricing', require('../../routes/pricing'));
  app.use((req, res) => res.status(404).json({ code: 'not_found' }));
  await sequelize.sync(); // only this test's random empty DB; no migration introduced by ES-73
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  async function call(path, token, method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }); return { status: response.status, body: await response.json() };
  }
  const plan = await PricingPlan.create({ slug: 'basic', name_es: 'Plan sintético', name_en: 'Synthetic plan', price: '17.25', currency: 'USD', period: 'month', isActive: true });
  const hidden = await PricingPlan.create({ slug: 'synthetic-hidden', name_es: 'Oculto', name_en: 'Hidden', price: 0, isActive: false });
  const actor = (key, role = 'user') => User.create({ name: 'Synthetic', email: `${key}@example.invalid`, password: 'not-real', role, active: true });
  const a = await actor('owner-a'), b = await actor('owner-b'), editor = await actor('editor', 'admin');
  const at = issueToken(a), bt = issueToken(b), et = issueToken(editor);
  assert.equal((await call('/plans')).body.length, 1);
  assert.equal((await call('/plans')).body[0].price, '17.25');
  assert.equal((await call('/plans')).body[0].createdAt, undefined);
  for (const prefix of ['/plans', '/user/plan']) {
    assert.equal((await call(prefix + '/me')).status, 403);
    assert.equal((await call(prefix + '/me?id=' + b.id, at)).status, 400);
    assert.equal((await call(prefix + '/me', at)).body.plan, null);
  }
  assert.equal((await call('/admin/pricing/' + plan.id, at, 'PUT', { description_en: 'not allowed' })).status, 403);
  assert.equal((await call('/admin/pricing/' + plan.id, et, 'PUT', { description_en: 'Synthetic edited description', price: '18.75', isHighlighted: true })).status, 200);
  const updated = (await call('/plans')).body[0];
  assert.equal(updated.description_en, 'Synthetic edited description'); assert.equal(updated.price, '18.75'); assert.equal(updated.isHighlighted, true);
  assert.equal((await call('/plan-requests', at, 'POST', { planId: plan.id, userId: b.id })).status, 400);
  assert.equal((await call('/plan-requests', at, 'POST', { planId: hidden.id })).status, 404);
  const concurrent = await Promise.all(Array.from({ length: 12 }, () => call('/plan-requests', at, 'POST', { planId: plan.id })));
  assert.equal(concurrent.filter(r => r.status === 201).length, 1);
  assert.equal(concurrent.filter(r => r.status === 409).length, 11);
  assert.equal(await PlanRequest.count({ where: { userId: a.id, status: 'pending' } }), 1);
  assert.equal((await call('/plan-requests/me', bt)).body.request, null);
  assert.equal((await call('/plan-requests/me?userId=' + a.id, bt)).status, 400);
  assert.equal((await call('/plan-requests/' + a.id, bt)).status, 404);
  const own = (await call('/plan-requests/me', at)).body.request;
  assert.equal((await call('/plan-requests/admin/' + own.id + '/approve', bt, 'PUT', {})).status, 403);
  assert.equal((await call('/plan-requests/admin/' + own.id + '/approve', et, 'PUT', {})).status, 200);
  assert.equal((await call('/user/plan/me', at)).body.plan.id, plan.id);
  assert.equal((await call('/user/plan/me', bt)).body.plan, null);
  await sequelize.query(`CREATE FUNCTION es73_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic insert failure'; END $$`);
  await sequelize.query(`CREATE TRIGGER es73_fail BEFORE INSERT ON "PlanRequests" FOR EACH ROW EXECUTE FUNCTION es73_fail()`);
  assert.equal((await call('/plan-requests', at, 'POST', { planId: plan.id })).status, 500);
  assert.equal(await PlanRequest.count({ where: { userId: a.id, status: 'pending' } }), 0);
  await sequelize.query('DROP TRIGGER es73_fail ON "PlanRequests"');
  assert.equal((await call('/plan-requests', at, 'POST', { planId: plan.id })).status, 201);
  const beforeCopy = (await PricingPlan.findByPk(plan.id)).toJSON();
  const { reviewedPricingCopy } = require('../../scripts/reviewedPricingCopy.cjs');
  assert.equal((await reviewedPricingCopy({ sequelize, PricingPlan })).length, 1);
  assert.equal((await PricingPlan.findByPk(plan.id)).description_en, beforeCopy.description_en);
  await reviewedPricingCopy({ sequelize, PricingPlan, apply: true });
  const afterCopy = (await PricingPlan.findByPk(plan.id)).toJSON();
  for (const field of ['price', 'currency', 'period', 'slug', 'name_es', 'name_en', 'isActive', 'isHighlighted']) assert.deepEqual(afterCopy[field], beforeCopy[field]);
  assert.equal((await reviewedPricingCopy({ sequelize, PricingPlan, apply: true })).length, 0);
  assert.equal((await call('/plans')).body[0].description_en, require('../../content/reviewedPricingCopy').basic.description_en);
  await revokeToken(jwt.decode(at));
  assert.equal((await call('/plan-requests/me', at)).status, 401);
  assert.equal((await call('/user/plan/me', at)).status, 401);
  assert.equal((await call('/plan-requests/me', bt)).status, 200);
});
