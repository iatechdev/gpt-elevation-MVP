// [QA-Claude] ES-141 / ES-140 (servidor) / ES-139: cabeceras de caché, 404 de assets inexistentes y compresión, contra un servidor real con el build de frontend/dist.
// Uso: BASE=http://127.0.0.1:PUERTO DIST=<ruta a frontend/dist> LEVEL=141|140|139|main OUT=<archivo.json> node qa/integration/es141-140-139.cjs
// Datos sintéticos, 0 tokens de IA. LEVEL indica qué comportamiento se espera (acumulativo: 140 incluye 141; 139 incluye 140 y 141; main = línea base).
const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const http = require('http');
const { BASE, DIST, LEVEL, OUT } = process.env; const L = LEVEL === 'main' ? 0 : Number(LEVEL); const res = [];
const rec = (id, ok, detail) => { res.push({ id, ok, detail }); console.log(JSON.stringify({ id, ok, detail })); };
// http.get a mano para controlar Accept-Encoding y no descomprimir solo
const get = (p, { method = 'GET', headers = {}, raw = true } = {}) => new Promise((resolve, reject) => { const u = new URL(BASE + p); const r = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, s => { const bufs = []; s.on('data', d => bufs.push(d)); s.on('end', () => resolve({ status: s.statusCode, h: s.headers, body: Buffer.concat(bufs) })); }); r.on('error', reject); r.end(); });
(async () => {
  const assets = fs.readdirSync(path.join(DIST, 'assets')).filter(f => fs.statSync(path.join(DIST, 'assets', f)).isFile());
  const big = assets.filter(f => fs.statSync(path.join(DIST, 'assets', f)).size > 1024 && /\.(js|css)$/.test(f));
  // ES-141 C1: assets con hash -> immutable
  let bad = [];
  for (const f of assets) { const r = await get('/assets/' + f, { headers: { 'accept-encoding': 'identity' } }); const cc = r.h['cache-control'] || ''; if (r.status !== 200 || (L >= 1 ? !/max-age=31536000/.test(cc) || !/immutable/.test(cc) : false)) bad.push([f, r.status, cc]); }
  rec('C1-ES141-assets-immutable', bad.length === 0, L >= 1 ? { archivos: assets.length, fallos: bad } : { nota: 'main (línea base)', archivos: assets.length, fallos_esperados_en_main: bad.length });
  // C2: index.html sin caché larga
  const spa = ['/', '/index.html', '/login', '/app/chat', '/admin/dashboard', '/ruta-que-no-existe', '/profesionales'];
  bad = []; for (const p of spa) { const r = await get(p, { headers: { 'accept-encoding': 'identity' } }); const cc = r.h['cache-control'] || ''; if (r.status !== 200 || !/html/.test(r.h['content-type'] || '') || /immutable|max-age=[1-9]\d{4,}/.test(cc) || (L >= 1 && !/no-cache/.test(cc))) bad.push([p, r.status, cc, r.h['content-type']]); }
  rec('C2-ES141-spa-sin-cache-larga', bad.length === 0, { rutas: spa.length, fallos: bad });
  // C3: archivos públicos sin hash
  bad = []; for (const p of ['/favicon.svg', '/icons.svg']) { const r = await get(p, { headers: { 'accept-encoding': 'identity' } }); const cc = r.h['cache-control'] || ''; if (r.status !== 200 || /immutable/.test(cc) || (L >= 1 && !/no-cache/.test(cc))) bad.push([p, r.status, cc]); }
  rec('C3-ES141-sin-hash', bad.length === 0, { fallos: bad });
  // C4: la API conserva sus cabeceras y no se comprime
  const api = await get('/api/inexistente-qa', { headers: { 'accept-encoding': 'gzip' } }); const api2 = await get('/api/health', { headers: { 'accept-encoding': 'gzip' } });
  rec('C4-API-sin-cambios', !/immutable/.test(api.h['cache-control'] || '') && api.status !== 500 && !api.h['content-encoding'] && !api2.h['content-encoding'], { inexistente: [api.status, api.h['cache-control'], api.h['content-encoding'] || null], health: [api2.status, api2.h['cache-control'], api2.h['content-encoding'] || null] });
  // C5: borde (hash inválido, ruta con .., HEAD, If-None-Match)
  const f0 = big[0] || assets[0]; const r1 = await get('/assets/' + f0, { headers: { 'accept-encoding': 'identity' } }); const etag = r1.h.etag;
  const r304 = etag ? await get('/assets/' + f0, { headers: { 'if-none-match': etag, 'accept-encoding': 'identity' } }) : null;
  const rh = await get('/assets/' + f0, { method: 'HEAD', headers: { 'accept-encoding': 'identity' } });
  const rdots = await get('/assets/..%2f..%2fpackage.json'); const rdots2 = await get('/assets/%2e%2e/index.html'); const rraw = await get('/assets/../index.html');
  rec('C5-borde', (!etag || r304.status === 304) && rh.status === 200 && rdots.status !== 500 && !/"name"/.test(rdots.body.toString()) && rdots2.status !== 500 && rraw.status !== 500, { etag: !!etag, if_none_match: r304 && r304.status, head: rh.status, dotdot: [rdots.status, rdots2.status, rraw.status], cc_head: rh.h['cache-control'] });
  // ES-140: asset inexistente -> 404
  const miss = ['/assets/inexistente-AbCdEf12.js', '/assets/inexistente-AbCdEf12.css', '/assets/sub/dir/otro-Zz9Zz9Zz.js', '/assets/INDEX-DYO6YGEO.CSS', '/assets/index-Dcgu7QFl.js.map', '/assets/', '/assets'];
  bad = []; const seen = []; for (const p of miss) { const r = await get(p, { headers: { 'accept-encoding': 'identity' } }); const isHtml = /<!doctype html|<html/i.test(r.body.toString().slice(0, 200)); seen.push([p, r.status, r.h['content-type'], r.h['cache-control'], isHtml]); if (L >= 2 ? (r.status !== 404 || isHtml || !/no-store/.test(r.h['cache-control'] || '') || !/text\/plain/.test(r.h['content-type'] || '')) : false) bad.push(p); }
  rec('C1-ES140-asset-inexistente-404', bad.length === 0, L >= 2 ? { casos: miss.length, fallos: bad, muestra: seen.slice(0, 3) } : { nota: 'antes de ES-140 (se espera 200 + HTML)', muestra: seen.slice(0, 3) });
  // ES-140 C5: métodos / sin sesión
  const post = await get('/assets/x-12345678.js', { method: 'POST' }); const head = await get('/assets/x-12345678.js', { method: 'HEAD' });
  rec('C5-ES140-metodos', post.status < 500 && head.status < 500 && (L < 2 || head.status === 404), { post: post.status, head: head.status });
  // ES-139: compresión
  const first = big[0]; let ok = true; const det = [];
  for (const f of big) { const plain = await get('/assets/' + f, { headers: { 'accept-encoding': 'identity' } }); const gz = await get('/assets/' + f, { headers: { 'accept-encoding': 'gzip' } }); const enc = gz.h['content-encoding'] || null; let same = null; if (enc === 'gzip') { try { same = zlib.gunzipSync(gz.body).equals(plain.body); } catch { same = false; } } const vary = /accept-encoding/i.test(gz.h.vary || ''); const exp = L >= 3; if (exp ? !(enc === 'gzip' && same && vary && gz.body.length < plain.body.length) : false) ok = false; det.push({ f, plain: plain.body.length, gzip: gz.body.length, enc, same, vary, plain_enc: plain.h['content-encoding'] || null }); if (plain.h['content-encoding']) ok = false; }
  rec('C1C2-ES139-gzip', ok, { archivos: big.length, muestra: det.slice(0, 4), total_plano: det.reduce((a, d) => a + d.plain, 0), total_gzip: det.reduce((a, d) => a + d.gzip, 0), nota: L >= 3 ? undefined : 'sin ES-139 no se espera gzip' });
  // C3 BREACH: la API no comprime, ni errores ni listados
  const apis = []; for (const p of ['/api/health', '/api/landing-content', '/api/plans', '/api/pricing']) { const r = await get(p, { headers: { 'accept-encoding': 'gzip, br' } }); apis.push([p, r.status, r.h['content-encoding'] || null]); }
  rec('C3-ES139-API-no-comprime', apis.every(a => !a[2]), { apis });
  // C7 borde: archivo < 1 kB, Range, HEAD con gzip
  const small = ['/favicon.svg', '/icons.svg'].map(p => p); const sm = []; for (const p of small) { const r = await get(p, { headers: { 'accept-encoding': 'gzip' } }); sm.push([p, r.status, r.body.length, r.h['content-encoding'] || null]); }
  const rng = await get('/assets/' + first, { headers: { range: 'bytes=0-99', 'accept-encoding': 'gzip' } }); const hgz = await get('/assets/' + first, { method: 'HEAD', headers: { 'accept-encoding': 'gzip' } });
  rec('C7-ES139-borde', rng.status < 500 && hgz.status === 200 && sm.every(s => s[1] === 200), { pequenos: sm, range: [rng.status, rng.h['content-encoding'] || null, rng.body.length], head_gzip: [hgz.status, hgz.h['content-encoding'] || null] });
  // regresión final: los assets reales siguen con 200 y se sirven completos
  const html = await get('/index.html', { headers: { 'accept-encoding': 'gzip' } }); const ref = (html.h['content-encoding'] === 'gzip' ? zlib.gunzipSync(html.body) : html.body).toString(); const refs = [...ref.matchAll(/\/assets\/[^"']+/g)].map(m => m[0]); let all = true; const miss2 = []; for (const a of refs) { const r = await get(a); if (r.status !== 200) { all = false; miss2.push([a, r.status]); } }
  rec('C-regresion-index-referencia-assets-existentes', all && refs.length > 0, { referencias: refs.length, fallos: miss2 });
  fs.writeFileSync(OUT, JSON.stringify({ level: LEVEL, base: BASE, resultados: res }, null, 1));
  console.log('RESUMEN', res.filter(r => r.ok).length + '/' + res.length);
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR', detail: String(e.stack).slice(0, 400) })); process.exit(1); });
