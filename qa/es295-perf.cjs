// QA-Claude-2 — ES-301 (PR #295) R1: CLS y contenido útil a 390 px con CPU ×4, 10 corridas por página, PR y main INTERCALADOS por página.
// Env: PLAYWRIGHT_MODULE, DISTS ("main=ruta,pr=ruta"), OUT. Páginas: registro (PR y main), /privacidad y /terminos (solo PR).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }; let DIR = ''
const sleep = ms => new Promise(r => setTimeout(r, ms)); const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
const D = Object.fromEntries(process.env.DISTS.split(',').map(s => s.split('=')))
const PAGES = [['registro', '/login?mode=register', ['main', 'pr']], ['privacidad', '/privacidad', ['pr']], ['terminos', '/terminos', ['pr']]]
http.createServer((q, r) => { let p; try { p = path.join(DIR, decodeURIComponent(q.url.split('?')[0])) } catch { p = DIR } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(5173, async () => {
  const b = await chromium.launch(); const out = {}
  for (const lang of ['es', 'en']) for (const [name, url, labs] of PAGES) for (const lab of labs) { DIR = D[lab]; const cls = [], t = []
    for (let i = 0; i < 10; i++) { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); await c.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__cls = 0; try { new PerformanceObserver(x => { for (const e of x.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch {} }, lang)
      const p = await c.newPage(); const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); const t0 = Date.now(); await p.goto('http://localhost:5173' + url, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1, form', { timeout: 60000 }).catch(() => {}); t.push(Date.now() - t0); await sleep(2600); cls.push(+(await p.evaluate(() => window.__cls)).toFixed(3)); await c.close() }
    out[`${lang} ${name} ${lab}`] = { cls, t }; console.log('PERF', lang, name, lab, 'contenido útil mediana', med(t), 'ms | CLS mediana', med(cls).toFixed(3), 'máx', Math.max(...cls).toFixed(3)) }
  fs.writeFileSync(process.env.OUT, JSON.stringify(out)); await b.close(); process.exit(0) })
