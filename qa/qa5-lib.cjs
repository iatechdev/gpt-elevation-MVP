// [QA-Claude-5] Utilidades comunes de las pruebas E2E (backend real + Postgres desechable + Chromium). Datos sintéticos, 0 IA.
// Entorno: API (def. http://localhost:8198), WEB_PORT (def. 5278), DIST (carpeta del build), DATABASE_URL, PLAYWRIGHT_MODULE, BACKEND (carpeta backend para resolver 'pg'), AXE (ruta axe.min.js), LABEL.
const { createRequire } = require('module'); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = process.env.API || 'http://localhost:8198', PORT = +(process.env.WEB_PORT || 5278), WEB = 'http://localhost:' + PORT, LABEL = process.env.LABEL || 'pr'
const sleep = ms => new Promise(r => setTimeout(r, ms)); const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
let total = 0, fails = 0
const ck = (n, ok, x = '') => { total++; if (!ok) fails++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x === '' ? '' : String(x).slice(0, 300)) }
const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a)
const call = async (m, p, t, b, hdr) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(hdr || {}) }, body: b === undefined ? undefined : (typeof b === 'string' ? b : JSON.stringify(b)) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx, h: r.headers } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = (dir = process.env.DIST) => new Promise(res => { const s = http.createServer((q, r) => { let p; try { p = path.join(dir, decodeURIComponent(q.url.split('?')[0])) } catch { p = dir } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dir, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(PORT, () => res(s)) })
const tag = Date.now().toString(36); let nUser = 0; const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!'
// Crea una cuenta sintética por la API real y le asigna el rol por la base (como hace la administración en el piloto).
const mk = async (role, name, extra = {}) => { nUser++; const email = `qa5-${tag}-${nUser}@example.test`; let r = await call('POST', '/api/register', null, { name: 'x', email, password: PASS, acceptedTerms: true, termsVersion: process.env.TERMS_VERSION || '2026-11-v2' }); if (r.s >= 300) r = await call('POST', '/api/register', null, { name: 'x', email, password: PASS, acceptedTerms: true, termsVersion: '2026-11-v1' }); if (r.s >= 300) r = await call('POST', '/api/register', null, { name: 'x', email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s + ' ' + r.tx.slice(0, 120)); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$3, "onboardingCompleted"=true, role=$2, active=true WHERE id=$1', [id, role, name]); const login = (await call('POST', '/api/login', null, { email, password: PASS })).j; return { id, name, email, role, token: login?.token, ...extra } }
let BR
const launch = async () => { BR = await chromium.launch(); return BR }
const open = async (U, { lang = 'es', w = 1360, h = 900, scheme = 'light', url = '/app/dashboard', theme, init, routes, ctxOpts = {}, wait = 2200 } = {}) => { const c = await BR.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, ...ctxOpts }); await c.addInitScript(([tk, l, nm, rl, th]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', nm) } localStorage.setItem('elv_lang', l); if (th !== undefined && th !== null) localStorage.setItem('elv_theme', th) }, [U?.token, lang, U?.name || 'x', U?.role || 'user', theme ?? null]); if (init) await c.addInitScript(init); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.reqs = []; p.on('request', rq => { if (rq.url().startsWith(API)) p.reqs.push({ m: rq.method(), u: rq.url().slice(API.length), b: rq.postData() }) }); if (routes) await routes(p); await p.goto(WEB + url, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main h1, #root h1', { timeout: 30000 }).catch(() => {}); await sleep(wait); p.c = c; return p }
const axeRun = async p => { await p.addScriptTag({ path: process.env.AXE }); return p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }); return r.violations.map(v => v.id + ':' + v.nodes.length + ':' + (v.nodes[0]?.target || []).join('>').slice(0, 70)) }) }
// CLS a 390 px con CPU×4 (n corridas, cada una con un usuario nuevo creado por mkU); devuelve {cls[], util[], src{}} (util = caracteres de <main>; src = fuentes del desplazamiento)
const clsRuns = async (mkU, url, n = 10, extraInit) => {
  const cls = [], util = [], src = []
  for (let i = 0; i < n; i++) {
    const U = await mkU(i); const c = await BR.newContext({ viewport: { width: 390, height: 900 } })
    await c.addInitScript(([tk, rl]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; window.__src = []; try { new PerformanceObserver(x => { for (const e of x.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; for (const s of (e.sources || [])) window.__src.push(((s.node && s.node.nodeName) || '?') + '.' + String((s.node && s.node.className) || '').slice(0, 30)) } }).observe({ type: 'layout-shift', buffered: true }) } catch {} }, [U.token, U.role || 'user'])
    if (extraInit) await c.addInitScript(extraInit)
    const pg = await c.newPage(); const cdp = await c.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await pg.goto(WEB + url, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('main h1, #root h1', { timeout: 40000 }).catch(() => {}); await sleep(3000)
    cls.push(+(await pg.evaluate(() => window.__cls)).toFixed(4)); src.push(...(await pg.evaluate(() => window.__src))); util.push(await pg.evaluate(() => (document.querySelector('main')?.innerText || '').length)); await c.close()
  }
  const cnt = {}; src.forEach(s => { cnt[s] = (cnt[s] || 0) + 1 }); return { cls, util, src: cnt }
}
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐★☆]/u
const done = async () => { console.log(`RESUMEN [${LABEL}]: ${total - fails}/${total} OK, ${fails} FALLAS`); try { await BR?.close() } catch {} try { await DB.end() } catch {} }
module.exports = { API, WEB, LABEL, sleep, med, ck, info, call, DB, dbq, serve, mk, PASS, launch, open, axeRun, clsRuns, EMOJI, done, crypto, fs, path, counts: () => ({ total, fails }), getBR: () => BR }
