const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const { models, startApp } = require('./support.cjs');

test('ES-74: minimal session reads canonical owner role/onboarding, never client claims or PII (mock DB)', async t => {
  const request = await startApp(t);
  for (const role of ['user', 'admin', 'superadmin', 'therapist', 'board']) for (const onboardingCompleted of [false, true]) {
    models.User.findByPk = async (id, options) => {
      assert.equal(id, 101);
      assert.deepEqual(options.attributes, ['role', 'active', 'onboardingCompleted']);
      return { role, active: true, onboardingCompleted, name: 'Synthetic private name', email: 'owner@example.invalid', password: 'never-return' };
    };
    // Deliberately stale signed role: response must come from the current database row.
    const response = await request('GET', '/api/session', { role: 'user' });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { role, onboardingCompleted });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('vary'), /Authorization/i);
  }
});

test('ES-74: foreign IDs/query parameters/path never select another person', async t => {
  const request = await startApp(t);
  const reads = [];
  models.User.findByPk = async id => { reads.push(id); return { role: 'user', active: true, onboardingCompleted: id === 202 }; };
  for (const query of ['?id=202', '?UserId=202', '?role=admin', '?returnTo=https%3A%2F%2Fexample.invalid']) {
    assert.equal((await request('GET', '/api/session' + query, { role: 'user', id: 101 })).status, 400);
  }
  assert.equal((await request('GET', '/api/session/202', { role: 'user', id: 101 })).status, 404);
  assert.deepEqual(reads, []);
  assert.deepEqual((await request('GET', '/api/session', { role: 'user', id: 101 })).body, { role: 'user', onboardingCompleted: false });
  assert.deepEqual((await request('GET', '/api/session', { role: 'user', id: 202 })).body, { role: 'user', onboardingCompleted: true });
  assert.deepEqual(reads, [101, 202]);
});

test('ES-74: absent/inactive/unknown role/malformed row/database failure close in failure', async t => {
  const request = await startApp(t);
  for (const [row, status] of [
    [null, 401], [{ role: 'user', active: false, onboardingCompleted: true }, 401],
    [{ role: 'invented', active: true, onboardingCompleted: true }, 503],
    [{ role: 'user', active: true, onboardingCompleted: 'true' }, 503],
  ]) {
    models.User.findByPk = async () => row;
    const response = await request('GET', '/api/session', { role: 'user' });
    assert.equal(response.status, status);
    assert.equal(response.body.role, undefined);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  models.User.findByPk = async () => { throw new Error('Synthetic private database failure'); };
  const failed = await request('GET', '/api/session', { role: 'user' });
  assert.equal(failed.status, 503);
  assert.doesNotMatch(JSON.stringify(failed.body), /private database failure/);
});

test('ES-74: real JWT middleware rejects absent/invalid/expired/legacy/revoked/cutoff/deletion sessions', async t => {
  const request = await startApp(t);
  let reads = 0;
  models.User.findByPk = async () => { reads++; return { role: 'user', active: true, onboardingCompleted: true }; };
  const token = options => jwt.sign({ id: 101, role: 'user', jti: randomBytes(8).toString('hex'), ...options }, process.env.JWT_SECRET);
  assert.equal((await request('GET', '/api/session')).status, 403);
  for (const bearer of ['invalid', token({ exp: Math.floor(Date.now() / 1000) - 2 }), token({ jti: undefined })]) {
    assert.equal((await request('GET', '/api/session', { headers: { Authorization: 'Bearer ' + bearer } })).status, 401);
  }
  t.mock.method(models.RevokedToken, 'findByPk', async () => ({}));
  assert.equal((await request('GET', '/api/session', { role: 'user' })).status, 401);
  t.mock.restoreAll();
  t.mock.method(models.AuthRevocation, 'findByPk', async () => ({ revokedBefore: new Date(Date.now() + 10000) }));
  assert.equal((await request('GET', '/api/session', { role: 'user' })).status, 401);
  t.mock.restoreAll();
  t.mock.method(models.DeletionRequest, 'findOne', async () => ({}));
  assert.equal((await request('GET', '/api/session', { role: 'user' })).status, 401);
  t.mock.restoreAll();
  t.mock.method(models.RevokedToken, 'findByPk', async () => { throw new Error('Synthetic unavailable ledger'); });
  t.mock.method(console, 'error', () => {});
  assert.equal((await request('GET', '/api/session', { role: 'user' })).status, 503);
  assert.equal(reads, 0);
});
