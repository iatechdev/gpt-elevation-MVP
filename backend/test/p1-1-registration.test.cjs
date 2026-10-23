const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models, record, startApp } = require('./support.cjs');

test('P1-1: public registration cannot reactivate or replace an inactive account', async t => {
  const password = randomBytes(24).toString('hex');
  const originalHash = await bcrypt.hash(randomBytes(24).toString('hex'), 4);
  const account = record({ id: 202, role: 'superadmin', active: false, password: originalHash });
  account.update = mock.fn(account.update);
  models.User.findOne = mock.fn(async () => account);
  models.User.create = mock.fn(async () => { throw new Error('Must not create'); });
  const request = await startApp(t);

  const denied = await request('POST', '/api/register', {
    body: { name: 'Synthetic', email: 'inactive@example.invalid', password },
  });
  assert.equal(denied.status, 403);
  assert.equal(account.update.mock.callCount(), 0);
  assert.equal(models.User.create.mock.callCount(), 0);
  assert.equal(account.password, originalHash);
  assert.equal(account.active, false);
  assert.equal(account.role, 'superadmin');
  assert.equal((await request('POST', '/api/login', {
    body: { email: 'inactive@example.invalid', password },
  })).status, 403);

  models.User.findOne = async () => null;
  let created;
  models.User.create = async values => { created = values; return record(values); };
  const registered = await request('POST', '/api/register', {
    body: { name: 'Synthetic', email: 'new@example.invalid', password },
  });
  assert.equal(registered.status, 201);
  assert.equal(created.role, 'user');
  assert.notEqual(created.password, password);
  assert.equal(await bcrypt.compare(password, created.password), true);

  const active = record({ ...created, id: 303, active: true, loginAttempts: 0 });
  models.User.findOne = async () => active;
  assert.equal((await request('POST', '/api/register', {
    body: { name: 'Synthetic', email: 'new@example.invalid', password },
  })).status, 400);
  const loggedIn = await request('POST', '/api/login', {
    body: { email: 'new@example.invalid', password },
  });
  assert.equal(loggedIn.status, 200);
  assert.equal(jwt.verify(loggedIn.body.token, process.env.JWT_SECRET).id, active.id);
});
