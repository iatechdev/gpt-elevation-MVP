// ES-316: cascada de peticiones hasta el contenido útil de una ruta /app/* (390 px, CPU ×4, 5 corridas, mediana) contra un backend REAL local.
// Requisitos: backend en :8091 con FRONTEND_URL=http://localhost:5183 (CORS: solo deja pasar ese origen), Postgres desechable, y el dist construido con VITE_BACKEND_URL=http://localhost:8091.
// Uso: DIR=<dist> ROUTE=/app/dashboard BACKEND=<carpeta backend> DB=<DATABASE_URL> PLAYWRIGHT_MODULE=<ruta> [LAT=80 (ms de latencia)] [QUIET=1] node scripts/es316-waterfall.cjs
// Ojo: si el origen no está permitido, /api/session falla y la pantalla es «No pudimos verificar tu sesión»; la medición saldría de ese error, no del contenido.
// Cascada de peticiones hasta el contenido útil de una ruta (ES-316). Uso: DIR=<dist> ROUTE=/app/exercises node wf316.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg'); const API = 'http://localhost:8091'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }; const DIR = process.env.DIR
const srv = http.createServer((q, r) => { let p = path.join(DIR, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) })
srv.listen(5183, async () => {
  const db = new Client({ connectionString: process.env.DB }); await db.connect(); const pw = crypto.randomBytes(9).toString('hex') + 'Aa1!'; const J = (p, b) => fetch(API + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
  const email = `wf316-${Date.now().toString(36)}@example.test`; await J('/api/register', { name: 'x', email, password: pw }); await db.query('UPDATE "Users" SET name=$2, "onboardingCompleted"=true WHERE email=$1', [email, 'PERSONA-WF']); const tok = (await J('/api/login', { email, password: pw })).token
  const b = await chromium.launch(); const runs = []
  for (let i = 0; i < 5; i++) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es') }, [tok])
    const p = await c.newPage(); const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); if (process.env.LAT) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: Number(process.env.LAT), downloadThroughput: -1, uploadThroughput: -1 }) } const t0 = Date.now(); const ev = []
    p.on('requestfinished', r => ev.push([Date.now() - t0, 'fin', new URL(r.url()).pathname.split('/').slice(-2).join('/')])); p.on('request', r => ev.push([Date.now() - t0, 'req', r.method() + ' ' + new URL(r.url()).pathname.split('/').slice(-2).join('/')]))
    await p.goto('http://localhost:5183' + process.env.ROUTE, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main h1, main h2, #root h1, main button, main a', { timeout: 60000 }); const useful = Date.now() - t0
    const first = await p.evaluate(() => { const e = document.querySelector('main h1, main h2, #root h1, main button, main a'); return e ? e.tagName + ':' + (e.textContent || '').trim().slice(0, 30) + ' in ' + (e.closest('.cg-screen-loading') ? 'LOADING' : 'screen') : '?' })
    runs.push({ useful, first, ev }); await c.close() }
  runs.sort((a, b) => a.useful - b.useful); const m = runs[2]; console.log('mediana', m.useful, 'ms; todas:', runs.map(r => r.useful).join(','), '; primer elemento:', m.first)
  if (!process.env.QUIET) for (const e of m.ev.filter(e => !/.(woff2|svg|png)$/.test(e[2]))) console.log(String(e[0]).padStart(5), e[1], e[2])
  await b.close(); await db.end(); process.exit(0) })
