// ES-201: brotli precomprimido. Con `Accept-Encoding: br` y un `.br` junto al archivo se sirve ese archivo (Content-Encoding: br, Vary: Accept-Encoding, mismo tipo y caché que el original);
// sin br, o con q=0, o sin `.br`, sigue el gzip/identidad de siempre; las rutas de la SPA usan index.html.br; nada fuera de dist se sirve.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const { once } = require('node:events');
const express = require('express');
const { mountFrontend, IMMUTABLE, acceptsBrotli } = require('../utils/frontendStatic');

const JS = 'console.log("elevation");\n'.repeat(400);
const CSS = '.a{color:red}\n'.repeat(400);
const HTML = '<!doctype html><title>elevation</title>' + '<p>hola</p>'.repeat(200);
const br = text => zlib.brotliCompressSync(Buffer.from(text));

let root;
async function start(t, { withBr = true } = {}) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'es201-'));
  const dist = path.join(root, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), HTML);
  fs.writeFileSync(path.join(dist, 'assets', 'index-Ab12Cd34.js'), JS);
  fs.writeFileSync(path.join(dist, 'assets', 'style-Zy98_xW7.css'), CSS);
  fs.writeFileSync(path.join(root, 'secreto.js'), 'SECRETO');
  fs.writeFileSync(path.join(root, 'secreto.js.br'), br('SECRETO'));
  if (withBr) for (const rel of ['index.html', 'assets/index-Ab12Cd34.js', 'assets/style-Zy98_xW7.css']) fs.writeFileSync(path.join(dist, `${rel}.br`), br(fs.readFileSync(path.join(dist, rel), 'utf8')));
  const app = express();
  mountFrontend(app, dist);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const port = server.address().port;
  return (url, { encoding, method = 'GET' } = {}) => new Promise((resolve, reject) => {
    const headers = encoding === undefined ? {} : { 'Accept-Encoding': encoding };
    http.request({ host: '127.0.0.1', port, path: url, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject).end();
  });
}

test('ES-201: con Accept-Encoding: br se sirve el .br con su tipo, su caché y Vary: Accept-Encoding', async t => {
  const get = await start(t);
  const cases = [
    ['/assets/index-Ab12Cd34.js', /javascript/, IMMUTABLE, JS], ['/assets/style-Zy98_xW7.css', /css/, IMMUTABLE, CSS], ['/index.html', /html/, 'no-cache', HTML], ['/', /html/, 'no-cache', HTML],
  ];
  for (const [url, type, cache, original] of cases) {
    const res = await get(url, { encoding: 'gzip, deflate, br' });
    assert.equal(res.status, 200, url);
    assert.equal(res.headers['content-encoding'], 'br', url);
    assert.match(res.headers.vary || '', /Accept-Encoding/i, url);
    assert.match(res.headers['content-type'] || '', type, url);
    assert.equal(res.headers['cache-control'], cache, url);
    assert.equal(zlib.brotliDecompressSync(res.body).toString(), original, url); // el contenido es el mismo
    const file = path.join(root, 'dist', url === '/' ? 'index.html' : url.slice(1));
    assert.ok(res.body.equals(fs.readFileSync(`${file}.br`)), `${url}: se sirve el archivo precomprimido, no una compresión al vuelo`);
    assert.ok(res.body.length < Buffer.byteLength(original), url);
  }
});

test('ES-201: las rutas de la SPA con br reciben index.html.br; sin br, el index.html de siempre', async t => {
  const get = await start(t);
  const withBr = await get('/login', { encoding: 'br' });
  assert.equal(withBr.headers['content-encoding'], 'br'); assert.equal(withBr.headers['cache-control'], 'no-cache')
  assert.equal(zlib.brotliDecompressSync(withBr.body).toString(), HTML);
  const plain = await get('/login', { encoding: 'identity' });
  assert.equal(plain.status, 200); assert.equal(plain.headers['content-encoding'], undefined); assert.equal(plain.body.toString(), HTML);
});

test('ES-201: sin br (solo gzip, q=0, o sin cabecera) no se sirve brotli y el gzip de ES-139 sigue igual', async t => {
  const get = await start(t);
  const gz = await get('/assets/index-Ab12Cd34.js', { encoding: 'gzip' });
  assert.equal(gz.headers['content-encoding'], 'gzip'); assert.equal(zlib.gunzipSync(gz.body).toString(), JS);
  for (const encoding of ['br;q=0', 'identity']) {
    const res = await get('/assets/index-Ab12Cd34.js', { encoding });
    assert.notEqual(res.headers['content-encoding'], 'br', encoding);
  }
  const none = await get('/assets/index-Ab12Cd34.js');
  assert.notEqual(none.headers['content-encoding'], 'br');
});

test('ES-201: sin archivo .br (build sin precomprimir) se cae a la compresión dinámica de siempre (compression), sin error', async t => {
  const get = await start(t, { withBr: false });
  const res = await get('/assets/index-Ab12Cd34.js', { encoding: 'gzip' });
  assert.equal(res.status, 200); assert.equal(res.headers['content-encoding'], 'gzip'); assert.equal(zlib.gunzipSync(res.body).toString(), JS);
  const dynamic = await get('/assets/index-Ab12Cd34.js', { encoding: 'br' }); // `compression` 1.8 ya sabe brotli, pero a calidad 4 (más rápida y más grande)
  assert.equal(dynamic.status, 200); assert.equal(zlib.brotliDecompressSync(dynamic.body).toString(), JS);
  assert.equal(res.headers['cache-control'], IMMUTABLE);
  const spa = await get('/login', { encoding: 'br' });
  assert.equal(spa.status, 200); assert.match(spa.headers['content-type'] || '', /html/);
});

test('ES-201: seguridad — un .br fuera de dist no se sirve; un asset inexistente sigue en 404 no-store; HEAD funciona', async t => {
  const get = await start(t);
  for (const url of ['/%2e%2e/secreto.js', '/..%2fsecreto.js', '/assets/..%2f..%2fsecreto.js', '/%00.js']) {
    const res = await get(url, { encoding: 'br' });
    assert.ok(!res.body.includes('SECRETO') && (res.headers['content-encoding'] !== 'br' || !zlib.brotliDecompressSync(res.body).toString().includes('SECRETO')), url);
  }
  const missing = await get('/assets/no-existe-Ab12Cd34.js', { encoding: 'br' });
  assert.equal(missing.status, 404); assert.equal(missing.headers['cache-control'], 'no-store');
  const head = await get('/assets/index-Ab12Cd34.js', { encoding: 'br', method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.headers['content-encoding'], 'br'); assert.equal(head.body.length, 0);
});

test('ES-201: acceptsBrotli entiende q, mayúsculas y comodines', () => {
  assert.equal(acceptsBrotli('gzip, deflate, br'), true);
  assert.equal(acceptsBrotli('BR;q=0.8'), true);
  assert.equal(acceptsBrotli('br;q=0'), false);
  assert.equal(acceptsBrotli('*'), false);
  assert.equal(acceptsBrotli('gzip'), false);
  assert.equal(acceptsBrotli(''), false);
  assert.equal(acceptsBrotli(undefined), false);
});
