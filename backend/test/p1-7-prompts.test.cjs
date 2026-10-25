const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promptVault, startApp } = require('./support.cjs');

test('P1-7: admin cannot approve, reject or roll back prompts through either alias', async t => {
  const calls = [];
  for (const action of ['approve', 'reject', 'rollback', 'propose']) {
    promptVault[action + 'Prompt'] = async (...args) => { calls.push({ action, args }); };
  }
  promptVault.PromptVault.findAll = async () => [];
  const request = await startApp(t);
  for (const action of ['approve', 'reject', 'rollback']) await t.test(action, async () => {
    for (const prefix of ['/api/admin', '/api/superadmin']) {
      const body = { note: 'Synthetic review' };
      for (const role of [undefined, 'user', 'therapist', 'board', 'admin']) {
        const before = calls.length;
        assert.equal((await request('POST', `${prefix}/prompt/7/${action}`, { role, body })).status, 403);
        assert.equal(calls.length, before);
      }
      assert.equal((await request('POST', `${prefix}/prompt/7/${action}`, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      assert.equal((await request('POST', `${prefix}/prompt/7/${action}`, { role: 'superadmin', body })).status, 200);
      assert.equal(calls.at(-1).action, action);
      assert.equal(calls.at(-1).args[0], '7');
    }
  });
  assert.equal((await request('POST', '/api/admin/prompt/propose', {
    role: 'admin', body: { key: 'synthetic', content: 'Synthetic proposed prompt' },
  })).status, 200);
  assert.equal(calls.at(-1).action, 'propose');
  assert.equal((await request('GET', '/api/admin/prompts', { role: 'admin' })).status, 200);
});
