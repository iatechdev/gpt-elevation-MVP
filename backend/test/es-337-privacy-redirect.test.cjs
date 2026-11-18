// ES-337: la política estática antigua (/privacy, producto anterior) ya no se sirve: /privacy responde 308 permanente a /privacidad, también con barra final y como index.html.
// Se prueba el montaje REAL del frontend (backend/utils/frontendStatic.js) sobre un directorio temporal, sin red externa. La parte de Vercel se comprueba sobre vercel.json.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');
const { mountFrontend } = require('../utils/frontendStatic');

const root = path.resolve(__dirname, '..', '..');

test('ES-337: /privacy, /privacy/ y /privacy/index.html redirigen con 308 a /privacidad, y /privacidad sigue siendo la SPA', async (t) => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'es337-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>spa</title>');
  fs.mkdirSync(path.join(dist, 'privacy')); fs.writeFileSync(path.join(dist, 'privacy', 'index.html'), '<title>LEGACY</title>'); // aunque un build viejo lo dejara, la redirección va primero
  const app = express(); mountFrontend(app, dist);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.close(); fs.rmSync(dist, { recursive: true, force: true }); });
  const get = (route) => new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port: server.address().port, path: route }, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, body })); }).on('error', reject));
  for (const route of ['/privacy', '/privacy/', '/privacy/index.html']) {
    const res = await get(route);
    assert.equal(res.status, 308, route); assert.equal(res.location, '/privacidad', route); assert.ok(!res.body.includes('LEGACY'), route);
  }
  const page = await get('/privacidad'); assert.equal(page.status, 200); assert.match(page.body, /spa/);
});

test('ES-337: la política antigua ya no está versionada y Vercel redirige /privacy (308) en vez de reescribirla', () => {
  assert.equal(fs.existsSync(path.join(root, 'frontend', 'public', 'privacy', 'index.html')), false);
  assert.equal(fs.existsSync(path.join(root, 'index.html')), false, 'copia en la raíz del repo');
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  assert.deepEqual(vercel.redirects, [{ source: '/privacy', destination: '/privacidad', permanent: true }]);
  assert.ok(!vercel.rewrites.some((r) => String(r.source).includes('privacy') || String(r.destination).includes('privacy')), 'sin reescritura a la política antigua');
});
