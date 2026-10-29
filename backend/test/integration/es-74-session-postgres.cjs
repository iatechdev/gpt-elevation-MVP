// Explicit local-only integration test. Uses its own random database and never loads .env.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { Sequelize } = require('sequelize');

test('ES-74 Postgres: real owner reader, role/onboarding, revocation, deletion and foreign-ID isolation', { timeout: 60000 }, async t => {
  assert.ok(process.env.ES74_TEST_DATABASE_URL, 'Explicit disposable loopback PostgreSQL URL required');
  const source = new URL(process.env.ES74_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname), 'Only loopback PostgreSQL allowed');
  const dbName = 'es74_test_' + randomBytes(8).toString('hex');
  assert.match(dbName, /^es74_test_[a-f0-9]{16}$/);
  const admin = new Sequelize(source.toString(), { logging: false, dialectOptions: { ssl: false } });
  let sequelize, server, created = false;
  t.after(async () => {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (sequelize) await sequelize.close();
    if (created) await admin.query(`DROP DATABASE "${dbName}"`); // only the random DB created by this run
    await admin.close();
  });
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  source.pathname = '/' + dbName;
  sequelize = new Sequelize(source.toString(), { logging: false, dialectOptions: { ssl: false } });
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const dbModule = require.resolve('../../database');
  require.cache[dbModule] = { id: dbModule, filename: dbModule, loaded: true, exports: { sequelize } };
  require('../../PricingPlan');
  const User = require('../../User');
  const DeletionRequest = require('../../DeletionRequest');
  const { issueToken } = require('../../utils/sessions');
  const { verificarToken } = require('../../middlewares/auth');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/landing-content', require('../../routes/landingContent'));
  app.use('/api', verificarToken, require('../../routes/session'));
  app.use((req, res) => res.status(404).json({ code: 'not_found' }));
  await sequelize.sync(); // existing models only, no schema change introduced by ES-74
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const actor = (suffix, completed) => User.create({ name: 'Synthetic', email: `${suffix}@example.invalid`, password: 'not-a-real-credential', role: 'user', active: true, onboardingCompleted: completed });
  const a = await actor('owner-a', false), b = await actor('owner-b', true);
  const aToken = issueToken(a), bToken = issueToken(b);
  async function call(path, token, method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const first = await call('/session', aToken);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, { role: 'user', onboardingCompleted: false });
  assert.equal(first.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await call('/session', bToken)).body, { role: 'user', onboardingCompleted: true });
  assert.equal((await call('/session?id=' + b.id, aToken)).status, 400);
  assert.equal((await call('/session/' + b.id, aToken)).status, 404);
  assert.equal((await call('/session', aToken)).body.onboardingCompleted, false);
  await a.update({ onboardingCompleted: true });
  assert.equal((await call('/session', aToken)).body.onboardingCompleted, true);
  await a.update({ role: 'invented' });
  assert.equal((await call('/session', aToken)).status, 503);
  await a.update({ role: 'user', active: false });
  assert.equal((await call('/session', aToken)).status, 401);
  await a.update({ active: true });
  assert.equal((await call('/logout', aToken, 'POST')).status, 200);
  assert.equal((await call('/session', aToken)).status, 401);
  assert.equal((await call('/session', bToken)).status, 200);
  const renewed = issueToken(a);
  assert.equal((await call('/session', renewed)).status, 200);
  assert.equal((await call('/logout-all', renewed, 'POST')).status, 200);
  assert.equal((await call('/session', renewed)).status, 401);
  assert.equal((await call('/session', bToken)).status, 200);
  await new Promise(resolve => setTimeout(resolve, 5));
  const afterCutoff = issueToken(a);
  assert.equal((await call('/session', afterCutoff)).status, 200);
  await DeletionRequest.create({ id: randomUUID(), UserId: a.id });
  assert.equal((await call('/session', afterCutoff)).status, 401);
  assert.equal((await call('/session', bToken)).status, 200);
  const editor = await User.create({ name: 'Synthetic editor', email: 'editor@example.invalid', password: 'not-a-real-credential', role: 'superadmin', active: true, onboardingCompleted: true });
  const edit = { key: 'landing.join.title', lang: 'en', value: 'Synthetic persisted title' };
  assert.equal((await call('/landing-content', bToken, 'PUT', edit)).status, 403);
  assert.equal((await call('/landing-content', issueToken(editor), 'PUT', edit)).status, 200);
  assert.equal((await call('/landing-content?lang=en')).body[edit.key], edit.value);
  assert.notEqual((await call('/landing-content?lang=es')).body[edit.key], edit.value);
});
