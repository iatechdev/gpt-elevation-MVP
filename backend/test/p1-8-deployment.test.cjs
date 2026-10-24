const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { startApp } = require('./support.cjs');

test('P1-8: server dependencies resolve from the backend installation without root node_modules', () => {
  const serverRequire = createRequire(path.resolve(__dirname, '../server.js'));
  const backendModules = path.resolve(__dirname, '../node_modules') + path.sep;
  const { dependencies } = require('../package.json');
  for (const name of Object.keys(dependencies)) {
    const resolved = serverRequire.resolve(name);
    assert.ok(resolved.startsWith(backendModules), name + ' must resolve from backend/node_modules');
    assert.ok(serverRequire(name), name + ' must be loadable');
  }
});

test('P1-8: Vercel entry is retained, exports the real app and protects administrative mutations', async t => {
  const request = await startApp(t);
  const app = require('../server');
  assert.equal(require('../../api/index'), app);
  assert.equal(typeof app.listen, 'function');
  const config = require('../../vercel.json');
  assert.ok(config.rewrites.some(rule => rule.source === '/api/(.*)' && rule.destination === '/api/index.js'));
  assert.equal((await request('POST', '/api/pricing', { body: {} })).status, 403);
});
