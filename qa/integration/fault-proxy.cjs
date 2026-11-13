// [QA-Claude] Proxy de fallos para pruebas de interfaz: reenvía todo al servidor y, según el modo, corta la respuesta DESPUÉS de que el servidor persistió
// o responde 503. Uso: node qa/integration/fault-proxy.cjs <puerto> <puerto-destino>   Control: GET /__mode?m=pass|lostack|trunc|503   GET /__log
const http = require('node:http');
const [port, target] = [Number(process.argv[2]), Number(process.argv[3])];
let mode = 'pass'; const log = [];
http.createServer((req, res) => {
  if (req.url.startsWith('/__mode')) { mode = new URL(req.url, 'http://x').searchParams.get('m') || 'pass'; return res.end('mode=' + mode); }
  if (req.url === '/__log') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(log)); }
  const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
    const body = Buffer.concat(chunks);
    const watched = req.method !== 'GET' && /^\/api\//.test(req.url);
    if (watched) log.push({ m: req.method, u: req.url, rid: (() => { try { return JSON.parse(body.toString()).requestId; } catch { return null; } })(), mode });
    if (watched && mode === '503') { mode = 'pass'; res.statusCode = 503; res.setHeader('content-type', 'application/json'); return res.end('{"code":"qa_503"}'); }
    const up = http.request({ host: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers }, r => {
      if (watched && mode === 'trunc') { mode = 'pass'; r.resume(); r.on('end', () => { req.socket.write('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{'); setTimeout(() => req.socket.destroy(), 20); }); return; }
      if (watched && mode === 'lostack') { mode = 'pass'; r.resume(); r.on('end', () => req.socket.destroy()); return; }
      res.writeHead(r.statusCode, r.headers); r.pipe(res);
    });
    up.on('error', () => { res.statusCode = 502; res.end(); });
    up.end(body);
  });
}).listen(port, '127.0.0.1');
