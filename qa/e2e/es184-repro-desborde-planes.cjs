// [QA-Claude] ES-184 · PR #284 · reproducción del desborde horizontal de «Planes» a 390 px con una característica larga SIN espacios (el servidor admite hasta 200 caracteres).
// Mide en el build indicado (PR o main). Env: PLAYWRIGHT_MODULE, QA_SUT, DATABASE_URL, QA_JWT_SECRET, DIST, API_PORT, WEB_PORT, MODE
process.env.DB_SSL = 'false'
const E = process.env; const { chromium } = require(E.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken')
const API = `http://localhost:${E.API_PORT || 8190}`, WEB = Number(E.WEB_PORT || 5273), MODE = E.MODE || 'pr'
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((qq, r) => { let p = path.join(E.DIST, decodeURIComponent(qq.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(E.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
;(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, a = []) => (await db.query(s, a)).rows
  const email = `qa184r-${Date.now().toString(36)}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA184 r', email, password: crypto.randomBytes(12).toString('base64url') + 'aA1!' }) }); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', ['superadmin', email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]
  const token = jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, E.QA_JWT_SECRET, { expiresIn: '3h', jwtid: crypto.randomBytes(8).toString('hex') })
  await q('delete from "PricingPlans"')
  const mkPlan = (slug, o = {}) => fetch(API + '/api/admin/pricing', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ slug, name_es: 'Plan ' + slug, name_en: 'Plan ' + slug, price: 5, currency: 'USD', period: 'month', features_es: ['uno'], features_en: ['one'], ...o }) })
  await mkPlan('normal'); await mkPlan('larga', { features_es: ['L'.repeat(150)], features_en: ['L'.repeat(150)] }); await mkPlan('nombre', { name_es: 'N'.repeat(120), name_en: 'N'.repeat(120) })
  const BR = await chromium.launch(); const srv = await serve(); const out = []
  for (const w of [390, 320, 1360]) { const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk) }, token); const p = await c.newPage()
    await p.goto(`http://localhost:${WEB}/admin/content`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); await new Promise(r => setTimeout(r, 900))
    const tab = p.getByRole('tab', { name: /^Planes$/ }); if (await tab.count()) await tab.click(); else await p.getByRole('button', { name: /^Planes$/ }).click(); await new Promise(r => setTimeout(r, 1200))
    const m = await p.evaluate(() => { const de = document.documentElement; const wide = [...document.querySelectorAll('main *')].map(e => ({ t: e.tagName + '.' + (e.className || '').toString().slice(0, 30), r: Math.round(e.getBoundingClientRect().right) })).sort((a, b) => b.r - a.r).slice(0, 3); return { ov: de.scrollWidth - de.clientWidth, wide } })
    out.push({ w, ...m }); await c.close() }
  console.log('REPRO ' + JSON.stringify({ mode: MODE, out })); fs.writeFileSync(path.join(E.OUT || '.', `ES-184-repro-${MODE}.json`), JSON.stringify({ mode: MODE, out }, null, 1)); await BR.close(); srv.close(); await db.end(); process.exit(0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 600)); process.exit(3) })
