const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');

test('QA-57-01: connection identity and login limit remain enforced', async t => {
  let reads = 0;
  models.User.findOne = async () => { reads++; return null; };
  // express-rate-limit warns about forwarded headers when proxy trust is disabled.
  // Do not print request details; the behavior is checked through HTTP below.
  t.mock.method(console, 'error', () => {});
  const request = await startApp(t);
  assert.equal(require('../server').get('trust proxy'), false);
  for (let i = 1; i <= 11; i++) {
    const response = await request('POST', '/api/login', {
      headers: { 'X-Forwarded-For': '198.51.100.' + i },
      body: { email: 'synthetic@example.invalid', password: 'not-an-account-password' },
    });
    assert.equal(response.status, i <= 10 ? 401 : 429);
  }
  assert.equal(reads, 10);
});
