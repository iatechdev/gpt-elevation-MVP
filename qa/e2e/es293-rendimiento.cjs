// [QA-Claude] ES-320 · PR #293 · rendimiento pareado main vs PR a 390 px con CPU×4 (P1–P4). Plan Jira ES-320 12202; umbrales aprobados por Infra (12204).
process.env.DB_SSL = 'false'
const E = process.env; const { chromium } = require(E.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken')
const API = `http://localhost:${E.API_PORT || 8190}`, WEB = Number(E.WEB_PORT || 5273), MODE = E.MODE || 'pr', AXE = fs.readFileSync(E.AXE, 'utf8')
const results = []; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 700) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${MODE}] ` + n, String(x).slice(0, 320)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 900) }); console.log('INFO', `[${MODE}]`, n, String(x).slice(0, 420)) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const stamp = Date.now().toString(36); let seqn = 0
const DB = new Client({ connectionString: E.DATABASE_URL, ssl: false }); const q = async (s, a = []) => (await DB.query(s, a)).rows
const sign = (u, secret = E.QA_JWT_SECRET, opts = { expiresIn: '3h' }) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, secret, { ...opts, jwtid: crypto.randomBytes(8).toString('hex') })
const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch { /* */ } return { s: r.status, j: json, text } }
const mk = async (tag, role = 'user') => { seqn++; const email = `qa184p-${tag}-${stamp}-${seqn}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA184 ' + tag, email, password: crypto.randomBytes(12).toString('base64url') + 'aA1!' }) }); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: sign(u) } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((qq, r) => { let p = path.join(E.DIST, decodeURIComponent(qq.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(E.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length)) }
let BR, SU, AD, USR, THE
const open = async (user, { lang = 'es', w = 1360, tab, routes, path: pth = '/admin/content' } = {}) => {
  const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); if (user) await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk) }, user.token)
  const p = await c.newPage(); p.errs = []; p.dialogs = []; p.reqs = []; p.popups = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text().slice(0, 160)) })
  p.on('dialog', d => { p.dialogs.push(d.type() + ':' + d.message()); d.dismiss().catch(() => {}) }); p.on('request', r => { const u = new URL(r.url()); if (u.origin === API) p.reqs.push({ m: r.method(), p: u.pathname + u.search, auth: !!r.headers()['authorization'] }) })
  c.on('page', np => { p.popupPages = (p.popupPages || []); p.popupPages.push(np) }); await c.route('https://example.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>simulado</title>' }))
  if (routes) await routes(p); await p.goto(`http://localhost:${WEB}${pth}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('h1', { timeout: 20000 }).catch(() => {})
  if (lang === 'en') await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await sleep(900)
  if (tab) { await p.getByRole('tab', { name: new RegExp('^' + tab) }).first().click().catch(() => {}); await sleep(1000) } return { c, p } }
const body = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ')
const T = { es: { v: 'Validaciones', a: 'Solicitudes', pl: 'Planes', tx: 'Textos públicos' }, en: { v: 'Validations', a: 'Applications', pl: 'Plans', tx: 'Public texts' } }
const sec = async (name, fn) => { try { await fn() } catch (e) { ck(`${name}: EXCEPCIÓN`, false, (e.stack || e.message).slice(0, 500)) } }
const zlib = require('zlib')
const J = (r, status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const msgs = n => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? 'bot' : 'user', text: i % 2 ? `Respuesta ${i} de prueba. ` + 'Texto sintético que ocupa varias líneas para medir el hilo. '.repeat(3) : `Mensaje ${i} de la persona` }))
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const DISTS = { main: E.DIST_MAIN, pr: E.DIST }; let root = E.DIST
const serve2 = () => new Promise(res => { const s = http.createServer((qq, r) => { let p = path.join(root, decodeURIComponent(qq.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
const oneRun = async (variant, n, usage, user) => {
  root = DISTS[variant]; const c = await BR.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' }); await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk) }, user.token)
  await c.addInitScript(() => { window.__cls = 0; window.__lt = 0; window.__ltn = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__lt += e.duration; window.__ltn++ } }).observe({ type: 'longtask', buffered: true }) } catch { /* */ } })
  const p = await c.newPage(); const h = msgs(n)
  await p.route('**/api/messages', r => r.request().method() === 'GET' ? J(r, 200, h) : r.continue()); await p.route('**/api/ai/usage', async r => { if (usage === 'slow') await sleep(2000); return J(r, 200, { configured: true, limit: 100, used: 40, resetsAt: new Date(Date.now() + 864e5 * 5).toISOString() }) }); await p.route('**/api/recommendations', r => J(r, 200, []))
  const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable')
  const t0 = Date.now(); await p.goto(`http://localhost:${WEB}/app/chat`, { waitUntil: 'commit' })
  await p.waitForFunction(() => { const t = document.querySelector('textarea'); return t && !t.disabled && document.querySelector('.chat-main') }, null, { timeout: 60000, polling: 50 }); const tReady = Date.now() - t0
  await sleep(3500); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]))
  const r = await p.evaluate(() => { const q = s => document.querySelector(s); const sc = q('.chat-scroll'), ib = q('.chat-input-bar'), top = q('.chat-top'); return { cls: window.__cls, lt: Math.round(window.__lt), ltn: window.__ltn, nodes: document.getElementsByTagName('*').length, scrollH: sc && sc.clientHeight, ibH: ib && Math.round(ib.getBoundingClientRect().height), topH: top && Math.round(top.getBoundingClientRect().height), ov: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
  await c.close(); return { tReady, ...r, task: m.TaskDuration, layout: m.LayoutDuration, style: m.RecalcStyleDuration, script: m.ScriptDuration, layouts: m.LayoutCount }
}
const gz = dir => { const out = {}; for (const f of fs.readdirSync(path.join(dir, 'assets'))) { const b = fs.readFileSync(path.join(dir, 'assets', f)); if (/\.(js|css)$/.test(f)) { const k = f.replace(/-[A-Za-z0-9_-]{8}(?=\.(js|css)$)/, ''); out[k] = (out[k] || 0) + zlib.gzipSync(b).length } } return out }
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve2(); USR = await mk('user'); const REPS = Number(E.REPS || 7); const all = {}
  // P4: bundle (gzip) por archivo y total, main vs PR
  const gm = gz(DISTS.main), gp = gz(DISTS.pr); const sum = o => Object.values(o).reduce((a, b) => a + b, 0); const chatKeys = Object.keys(gp).filter(k => /ChatPage|^index\.|space|\.css$/.test(k))
  const dChat = {}; for (const k of new Set([...Object.keys(gm), ...Object.keys(gp)])) { const d = (gp[k] || 0) - (gm[k] || 0); if (d) dChat[k] = d }
  info('P4 diferencias gzip por archivo (bytes)', JSON.stringify(dChat)); ck('P4 total gzip JS+CSS: PR ≤ main + 2 kB', sum(gp) - sum(gm) <= 2048, `main=${sum(gm)} pr=${sum(gp)} delta=${sum(gp) - sum(gm)}`)
  for (const [n, usage] of [[0, 'slow'], [6, 'slow'], [40, 'slow']]) { const runs = { main: [], pr: [] }; await oneRun('main', n, usage, USR) // calentamiento
    for (let i = 0; i < REPS; i++) for (const v of (i % 2 ? ['pr', 'main'] : ['main', 'pr'])) runs[v].push(await oneRun(v, n, usage, USR))
    const agg = v => ({ cls: median(runs[v].map(x => x.cls)), clsMax: Math.max(...runs[v].map(x => x.cls)), tReady: median(runs[v].map(x => x.tReady)), lt: median(runs[v].map(x => x.lt)), ltn: median(runs[v].map(x => x.ltn)), task: median(runs[v].map(x => x.task)), layout: median(runs[v].map(x => x.layout)), script: median(runs[v].map(x => x.script)), nodes: runs[v][0].nodes, scrollH: runs[v][0].scrollH, ibH: runs[v][0].ibH, topH: runs[v][0].topH, ov: Math.max(...runs[v].map(x => x.ov)) })
    const A = agg('main'), B = agg('pr'); all[n] = { main: A, pr: B, raw: runs }
    const pair = k => runs.main.map((x, i) => runs.pr[i][k] / (x[k] || 1)); const ratio = k => { const r = pair(k); return { med: +median(r).toFixed(3), min: +Math.min(...r).toFixed(3), max: +Math.max(...r).toFixed(3) } }
    info(`P n=${n} main`, JSON.stringify(A)); info(`P n=${n} pr`, JSON.stringify(B)); info(`P n=${n} razones PR/main (pareadas)`, JSON.stringify({ tReady: ratio('tReady'), task: ratio('task'), layout: ratio('layout'), script: ratio('script'), lt: ratio('lt') }))
    ck(`P2 n=${n}: CLS ≤ 0,1`, B.clsMax <= 0.1, `mediana main=${A.cls.toFixed(4)} pr=${B.cls.toFixed(4)} máx pr=${B.clsMax.toFixed(4)}`); ck(`P2 n=${n}: CLS PR ≤ main + 0,005 (medianas)`, B.cls <= A.cls + 0.005, `main=${A.cls.toFixed(4)} pr=${B.cls.toFixed(4)}`)
    ck(`P3 n=${n}: tiempo hasta compositor listo PR ≤ main + 10 % (razón mediana pareada)`, ratio('tReady').med <= 1.10, JSON.stringify(ratio('tReady'))); ck(`P3 n=${n}: long tasks (ms) PR ≤ main + 10 % o diferencia < 50 ms`, B.lt <= A.lt * 1.10 || B.lt - A.lt < 50, `main=${A.lt} pr=${B.lt}`)
    ck(`P1 n=${n}: trabajo de render (TaskDuration) PR ≤ main ±2 % (razón mediana pareada; ver rango)`, Math.abs(ratio('task').med - 1) <= 0.02, JSON.stringify(ratio('task'))); ck(`P1 n=${n}: nodos del DOM PR ≤ main + 2 %`, B.nodes <= A.nodes * 1.02, `main=${A.nodes} pr=${B.nodes}`); ck(`P1 n=${n}: sin desborde horizontal`, B.ov <= 0, B.ov) }
  fs.writeFileSync(path.join(E.OUT || '.', 'ES-320-perf.json'), JSON.stringify(all, null, 1)); console.log('RESUMEN ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallas: f })); await BR.close(); srv.close(); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 600)); process.exit(3) })
