// QA-Claude-2 — ES-133: sirve el dist del PR con proxy de /api hacia staging (solo GET). Uso: node es133-serve.cjs <dist> <puerto> [catalogo.json]
// Con catalogo.json superpone a /api/landing-content los textos del catálogo del PR (simula el despliegue del backend sin valores guardados en el backoffice).
const http = require('http'), fs = require('fs'), path = require('path')
const D = path.resolve(process.argv[2]), PORT = +process.argv[3], CAT = process.argv[4] && JSON.parse(fs.readFileSync(process.argv[4], 'utf8')), T = 'https://backend-staging-e3a6.up.railway.app'
http.createServer(async (q, s) => { try {
  if (q.url.startsWith('/api/')) { if (q.method !== 'GET') { s.writeHead(405); return s.end() }
    const r = await fetch(T + q.url); let body = Buffer.from(await r.arrayBuffer())
    if (CAT && q.url.startsWith('/api/landing-content')) { const lang = /lang=en/.test(q.url) ? 'en' : 'es', j = JSON.parse(body.toString()); CAT.forEach(e => { j[e.key] = e[lang] }); body = Buffer.from(JSON.stringify(j)) }
    s.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/json' }); return s.end(body) }
  let f = path.join(D, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(D) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(D, 'index.html')
  s.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s)
} catch { s.writeHead(500); s.end() } }).listen(PORT, () => console.log('listo', PORT, CAT ? 'con catálogo del PR' : 'valores de staging tal cual'))
