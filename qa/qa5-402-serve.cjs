// [QA-Claude-5] Servidor estático del build + proxy /api → backend real (mismo origen), para la puerta de alcanzabilidad. Uso: DIST=<dist> API_PORT=8187 PORT=4402 node qa/qa5-402-serve.cjs
const http = require('http'), fs = require('fs'), path = require('path')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' }
http.createServer((q, r) => {
  if (q.url.startsWith('/api/')) { const p = http.request({ host: '127.0.0.1', port: +process.env.API_PORT, path: q.url, method: q.method, headers: q.headers }, (b) => { r.writeHead(b.statusCode, b.headers); b.pipe(r) }); p.on('error', () => { r.writeHead(502); r.end() }); return q.pipe(p) }
  let f; try { f = path.join(process.env.DIST, decodeURIComponent(q.url.split('?')[0])) } catch { f = process.env.DIST }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(process.env.DIST, 'index.html')
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r)
}).listen(+process.env.PORT, '127.0.0.1', () => console.log('listo ' + process.env.PORT))
