// [QA-Claude] Servidor FALSO de Supabase Storage (solo loopback) para probar utils/storage.js con el cliente real @supabase/supabase-js sin tocar ningún Supabase real.
// Uso: node fake-supabase-storage.cjs <puerto>   ·   control: GET /__log · POST /__mode {mode: ok|dirty500|conflict|slow} · POST /__reset · POST /__seed {names:[...]}
const http = require('node:http');
const port = Number(process.argv[2] || 9971);
let log = []; let store = new Map(); let mode = 'ok';
const dirtyMessage = () => `fallo interno en https://proyectosecreto123.supabase.co/storage/v1/object/qa-bucket/therapist-docs/7/secreto.pdf con service-role-key-SECRETA-abcdef`;
const send = (res, status, body) => { const text = typeof body === 'string' ? body : JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json' }); res.end(text); };
http.createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    const raw = Buffer.concat(chunks); const url = new URL(req.url, 'http://x'); const p = decodeURIComponent(url.pathname);
    if (p.startsWith('/__')) {
      if (p === '/__log') return send(res, 200, log);
      if (p === '/__reset') { log = []; store = new Map(); mode = 'ok'; return send(res, 200, {}); }
      if (p === '/__mode') { mode = JSON.parse(raw.toString() || '{}').mode || 'ok'; return send(res, 200, { mode }); }
      if (p === '/__seed') { for (const n of JSON.parse(raw.toString()).names) store.set(n, 1); return send(res, 200, { n: store.size }); }
      if (p === '/__store') return send(res, 200, [...store.keys()]);
      return send(res, 404, {});
    }
    let json = null; try { json = JSON.parse(raw.toString()); } catch { /* multipart o vacío */ }
    const entry = { method: req.method, path: p, auth: req.headers.authorization || null, apikey: req.headers.apikey || null, upsert: req.headers['x-upsert'] || null, ctype: (req.headers['content-type'] || '').split(';')[0], bytes: raw.length, json };
    log.push(entry);
    if (mode === 'dirty500') return send(res, 500, { statusCode: '500', error: 'Internal', message: dirtyMessage() });
    const m = p.match(/^\/storage\/v1\/object\/(sign|list)?\/?([^/]+)(?:\/(.*))?$/);
    if (!m) return send(res, 404, { message: 'no' });
    const [, kind, bucket, rest] = m;
    if (req.method === 'POST' && !kind) { const key = `${bucket}/${rest}`; if (mode === 'conflict' || (store.has(key) && req.headers['x-upsert'] !== 'true')) return send(res, 409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }); store.set(key, raw.length); return send(res, 200, { Id: 'id', Key: key }); }
    if (req.method === 'POST' && kind === 'sign') { return send(res, 200, { signedURL: `/object/sign/${bucket}/${rest}?token=qa-token` }); }
    if (req.method === 'DELETE' && !kind) { const out = []; for (const pre of (json && json.prefixes) || []) { const key = `${bucket}/${pre}`; if (store.delete(key)) out.push({ name: pre }); } return send(res, 200, out); }
    if (req.method === 'POST' && kind === 'list') { const prefix = (json && json.prefix) || ''; const names = [...store.keys()].filter((k) => k.startsWith(`${bucket}/${prefix}/`)).map((k) => k.slice(`${bucket}/${prefix}/`.length)).slice((json && json.offset) || 0, ((json && json.offset) || 0) + ((json && json.limit) || 100)); return send(res, 200, names.map((name) => ({ name }))); }
    return send(res, 404, { message: 'no' });
  });
}).listen(port, '127.0.0.1', () => console.log('fake storage listo ' + port));
