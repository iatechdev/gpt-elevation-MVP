// QA-Claude-2 — ES-284 (PR #240): nombre accesible del enlace de la marca contiene el texto visible (WCAG 2.5.3). Backend REAL (:8090, Postgres con migraciones reales), 0 IA, datos SINTETICOS. Nada simulado.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, AXE, DIST, LABEL (pr|main).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr', AXE = fs.readFileSync(process.env.AXE, 'utf8')
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }; const sleep = ms => new Promise(r => setTimeout(r, ms))
const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const mk = async (role, extra = {}) => { n++; const email = `qa2-p240-${tag}-${n}@example.test`; const name = `QA240 ${tag} ${n}`; const r = await call('POST', '/api/register', null, { name: 'x' + name, email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$4, "onboardingCompleted"=true, role=$2, "therapistId"=$3 WHERE id=$1', [id, role, extra.therapistId ?? null, name]); const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; return { id, name, email, token: tk, role } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(process.env.DIST, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(process.env.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(5173, () => res(s)) })
const AXETAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async tags => (await axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations.map(v => v.id + ':' + v.nodes.length), AXETAGS) }
const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
let BR
const open = async (u, url, { lang = 'es', w = 1360, role } = {}) => { const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); await c.addInitScript(([tk, l, r]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', r) } localStorage.setItem('elv_lang', l) }, [u?.token ?? '', lang, role ?? u?.role ?? ''])
  const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); await p.goto('http://localhost:5173' + url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('a.cg-brand', { timeout: 20000 }).catch(() => {}); await sleep(1500); return { c, p } }
const brandInfo = async p => { const loc = p.locator('a.cg-brand').first(); if (!(await loc.count())) return null; const vis = await loc.evaluate(a => { const cl = a.cloneNode(true); return cl.textContent }); const snap = await loc.ariaSnapshot(); const m = snap.match(/link "([^"]*)"/); return { vis: norm(vis), name: norm(m ? m[1] : ''), href: await loc.getAttribute('href'), aria: await loc.getAttribute('aria-label') } }
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve()
  const T = await mk('therapist'), P = await mk('user', { therapistId: T.id }), AD = await mk('admin'), BD = await mk('board')
  const consent = await call('PUT', '/api/consents/therapist_sharing', P.token, { status: 'granted' })
  const PAGES = [['profesional/panel', T, '/therapist/dashboard', 'pro'], ['profesional/ficha', T, `/therapist/patient/${P.id}`, 'pro'], ['profesional/revisiones', T, '/app/professional-reviews', 'pro'], ['persona/panel', P, '/app/dashboard', 'other'], ['admin/panel', AD, '/admin/dashboard', 'other'], ['junta/manifiesto', BD, '/manifiesto', 'other'], ['publico/login', null, '/login', 'other'], ['publico/inicio', null, '/', 'other']]
  for (const [lang, w] of [['es', 1360], ['en', 390], ['es', 320]]) for (const [label, u, url, kind] of PAGES) {
    const { c, p } = await open(u, url, { lang, w }); const b = await brandInfo(p); const v = await axeRun(p); const mism = v.filter(x => x.startsWith('label-content-name-mismatch')); const other = v.filter(x => !x.startsWith('label-content-name-mismatch'))
    const expect = lang === 'es' ? 'elevation. profesional' : 'elevation. professional'
    if (!b) { ck(`Z-${label} ${lang}/${w}: hay enlace de marca`, false, p.url()); await c.close(); continue }
    if (kind === 'pro') { ck(`Z1 ${label} ${lang}/${w}: texto visible «${b.vis}» y nombre accesible «${b.name}» (atributo «${b.aria}») → el nombre contiene lo visible`, b.name.includes(b.vis) && b.vis === expect, JSON.stringify(b)) }
    else { ck(`Z3 ${label} ${lang}/${w}: el nombre accesible «${b.name}» contiene lo visible «${b.vis}» (sin regresión)`, b.name.includes(b.vis.replace(/\.$/, '').trim()) || b.name.includes(b.vis), JSON.stringify(b)) }
    ck(`Z2 ${label} ${lang}/${w}: axe sin label-content-name-mismatch${other.length ? ' (otras violaciones: ' + other.join(',') + ')' : ''}`, mism.length === 0, JSON.stringify(v)); await c.close() }
  // Z4 clic y teclado; Z6 idioma
  for (const [lang, w] of [['es', 1360], ['en', 390]]) { const { c, p } = await open(T, `/therapist/patient/${P.id}`, { lang, w }); await p.locator('a.cg-brand').focus(); await p.keyboard.press('Enter'); await sleep(1500); const url1 = new URL(p.url()).pathname
    ck(`Z4 ${lang}/${w}: Enter en la marca lleva a /therapist/dashboard`, url1 === '/therapist/dashboard', url1)
    await p.goto('http://localhost:5173/therapist/dashboard', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('a.cg-brand'); await sleep(800); const vis = await p.locator('a.cg-brand').boundingBox(); await p.locator('a.cg-brand').click(); await sleep(800)
    ck(`Z4b ${lang}/${w}: clic en la marca funciona y el enlace es visible (≥ 24 px de alto)`, new URL(p.url()).pathname === '/therapist/dashboard' && vis && vis.height >= 24, JSON.stringify(vis)); await c.close() }
  { const { c, p } = await open(T, '/therapist/dashboard', { lang: 'es', w: 1360 }); const b1 = await brandInfo(p); const en = p.getByRole('button', { name: /^EN$|English/i }).first(); if (await en.count()) { await en.click(); await sleep(1200) } else { await p.evaluate(() => localStorage.setItem('elv_lang', 'en')); await p.reload(); await sleep(1500) }
    const b2 = await brandInfo(p); ck('Z6 cambiar ES→EN con la pantalla abierta: la etiqueta cambia con el idioma y contiene lo visible', b1.name.includes('profesional') && b2.name.includes('professional') && b2.name.includes(b2.vis), JSON.stringify({ b1, b2 })); await c.close() }
  // Z5: el nombre no repite ni se trunca
  { const { c, p } = await open(T, '/therapist/dashboard', { lang: 'es', w: 1360 }); const b = await brandInfo(p); ck('Z5 el nombre accesible calculado por Chromium no repite «Elevation» ni queda vacío', (b.name.match(/elevation/g) || []).length === 1 && b.name.length > 10, JSON.stringify(b)); await c.close() }
  await DB.end(); await BR.close(); srv.close(); console.log(`\nRESUMEN [${LABEL}]: ${total - f}/${total} OK, ${f} FALLA`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 900)); process.exit(3) })
