const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
require('./support.cjs');

test('QA-9-01', async t => {
  const app = require('../server');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  for (const [method, path, status] of [
    ['GET', '/api/health', 200],
    ['POST', '/api/pricing', 403],
  ]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, ...(method === 'POST' ? {
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      } : {}),
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('strict-transport-security'), /max-age=/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-powered-by'), null);
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /connect-src 'self'(;|$)/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /https:\/\/fonts.googleapis.com/);
    assert.match(csp, /https:\/\/fonts.gstatic.com/);
    assert.match(csp, /https:\/\/images.unsplash.com/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  }
});
