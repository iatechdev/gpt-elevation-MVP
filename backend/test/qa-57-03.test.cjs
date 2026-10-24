const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models, record, startApp } = require('./support.cjs');

test('QA-57-03: registration preserves its authorized role contract', async t => {
  const password = randomBytes(24).toString('hex');
  process.env.ADMIN_EMAILS = 'listed@example.invalid';
  t.after(() => { delete process.env.ADMIN_EMAILS; });
  const created = [];
  models.User.findOne = async () => null;
  models.User.create = async values => { created.push(values); return record(values); };
  const request = await startApp(t);
  for (const email of ['listed@example.invalid', 'LISTED@example.invalid', ' listed@example.invalid ']) {
    const response = await request('POST', '/api/register', {
      body: { name: 'Synthetic', email, password, role: 'superadmin', active: true },
    });
    assert.equal(response.status, 201);
    assert.equal(created.at(-1).role, 'user');
    assert.equal(Object.hasOwn(created.at(-1), 'active'), false);
  }
  const existing = record({
    id: 202, name: 'Synthetic administrator', role: 'admin', active: true,
    password: await bcrypt.hash(password, 4), loginAttempts: 0,
  });
  models.User.findOne = async () => existing;
  const login = await request('POST', '/api/login', { body: { email: 'listed@example.invalid', password } });
  assert.equal(login.status, 200);
  assert.equal(jwt.verify(login.body.token, process.env.JWT_SECRET).role, 'admin');
  assert.equal(existing.role, 'admin');
});
