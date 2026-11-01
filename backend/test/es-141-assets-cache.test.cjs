// ES-141: los archivos con hash de /assets se cachean como immutable; index.html y lo demás se revalidan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const { mountFrontend, IMMUTABLE } = require('../utils/frontendStatic');

async function start(t) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'es141-'));
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>x</title>');
  fs.writeFileSync(path.join(dist, 'assets', 'index-Ab12Cd34.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dist, 'assets', 'style-Zy98_xW7.css'), 'a{}');
  fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *');
  const app = express();
  mountFrontend(app, dist);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); fs.rmSync(dist, { recursive: true, force: true }); });
  return (url) => fetch(`http://127.0.0.1:${server.address().port}${url}`);
}

test('ES-141: los assets con hash llevan Cache-Control public, max-age=31536000, immutable', async t => {
  const get = await start(t);
  for (const url of ['/assets/index-Ab12Cd34.js', '/assets/style-Zy98_xW7.css']) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    assert.equal(res.headers.get('cache-control'), IMMUTABLE, url);
  }
  assert.equal(IMMUTABLE, 'public, max-age=31536000, immutable');
});

test('ES-141: index.html (en / y por el comodín de la SPA) y los archivos sin hash no reciben caché larga', async t => {
  const get = await start(t);
  for (const url of ['/', '/index.html', '/login', '/robots.txt']) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    const cc = res.headers.get('cache-control');
    assert.equal(cc, 'no-cache', url + ' -> ' + cc);
  }
});
