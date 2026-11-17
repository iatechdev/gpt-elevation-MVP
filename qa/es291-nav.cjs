// QA-Claude-2 — ES-153 paso 2 (PR #291): retirar SpaceNav/SpaceSkip. N2: ningún destino ni «Saltar al contenido» se pierde. Backend REAL (:8090), persona SINTÉTICA, 0 IA. Mismo guion contra el build del PR y el de main (DIST).
// Compara el conjunto de destinos alcanzables (marco, menú de usuario, «Mis herramientas»), el orden de Tab hasta cada uno, y el «Saltar al contenido» en las rutas de persona.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr'
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }; const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }; const DIR = process.env.DIST
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p; try { p = path.join(DIR, decodeURIComponent(q.url.split('?')[0])) } catch { p = DIR } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(5173, () => res(s)) })
let BR; const tag = Date.now().toString(36); const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!'
const mk = async (role, name) => { const email = `qa2-p291-${tag}-${name}@example.test`.toLowerCase(); const r = await call('POST', '/api/register', null, { name: 'x', email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$3, "onboardingCompleted"=true, role=$2, active=true WHERE id=$1', [id, role, name]); const login = (await call('POST', '/api/login', null, { email, password: PASS })).j; return { id, name, email, role, token: login?.token } }
const open = async (U, { lang = 'es', w = 1360, url = '/app/dashboard' } = {}) => { const c = await BR.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([tk, l, nm, rl]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', nm) } localStorage.setItem('elv_lang', l) }, [U?.token, lang, U?.name || 'x', U?.role || 'user']); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); await p.goto('http://localhost:5173' + url, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('main h1, #root h1', { timeout: 30000 }).catch(() => {}); await sleep(2000); p.c = c; return p }
const links = p => p.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ h: a.getAttribute('href'), t: (a.getAttribute('aria-label') || a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40), hidden: a.getClientRects().length === 0 })).filter(x => !x.hidden))
const WANT = ['/app/skill-map', '/app/chat', '/app/diary', '/app/evidence', '/app/data', '/app/plan', '/app/bridge', '/app/space/tools', '/app/exercises?from=dashboard', '/manifiesto']
const ROUTES = ['/app/dashboard', '/app/chat', '/app/diary', '/app/evidence', '/app/progress', '/app/skill-map', '/app/exercises', '/app/space/tools', '/app/data', '/app/plan', '/app/bridge', '/app/compass', '/app/checkin', '/app/next-step', '/app/context/resumes']

;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve(); const A = await mk('user', 'PERSONA-A-291')
  const found = {}
  for (const lang of ['es', 'en']) for (const w of [1360, 390]) {
    const reach = new Set(); let skipBad = [] ; let first = true
    for (const route of ROUTES) { const p = await open(A, { lang, w, url: route }); const ls = await links(p); ls.forEach(l => reach.add(l.h))
      // menú de usuario: ábrelo para ver sus entradas
      const um = p.locator('.cg-usermenu button, button[aria-haspopup]').first(); if (await um.count()) { await um.click().catch(() => {}); await sleep(300); (await links(p)).forEach(l => reach.add(l.h)) }
      // «Saltar al contenido»: uno, y lleva al main
      const skips = await p.evaluate(() => [...document.querySelectorAll('a')].filter(a => /^(Saltar al contenido|Skip to content)$/i.test((a.innerText || '').trim()) || a.classList.contains('cg-skip')).map(a => a.getAttribute('href')))
      if (skips.length !== 1) skipBad.push(`${route}:${skips.length}`)
      else { const target = skips[0]; const ok = await p.evaluate(h => !!document.querySelector(h), target).catch(() => false); if (!ok) skipBad.push(`${route}:destino-${target}`) }
      await p.c.close() }
    // «Mis herramientas»: enlaces
    { const p = await open(A, { lang, w, url: '/app/space/tools' }); (await links(p)).forEach(l => reach.add(l.h)); await p.c.close() }
    found[`${lang}/${w}`] = [...reach].sort(); const missing = WANT.filter(h => ![...reach].some(x => x === h || x.startsWith(h.split('?')[0]) && h.includes('?') === false)); const exact = WANT.filter(h => !reach.has(h))
    ck(`N2 ${lang}/${w}: todos los destinos del menú antiguo siguen alcanzables (${WANT.length}); faltan: ${exact.join(', ') || 'ninguno'}`, exact.length === 0, `alcanzables=${reach.size}`)
    ck(`N2 ${lang}/${w}: UN «Saltar al contenido» en cada una de ${ROUTES.length} rutas y su destino existe`, skipBad.length === 0, skipBad.join(' '))
  }
  // Tab: el menú del marco es alcanzable por teclado (en 20 Tab se pasa por ≥ 6 enlaces de navegación)
  for (const lang of ['es', 'en']) { const p = await open(A, { lang, url: '/app/dashboard' }); const seen = []; for (let i = 0; i < 22; i++) { await p.keyboard.press('Tab'); seen.push(await p.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('href') || a.getAttribute('aria-label') || a.innerText || a.tagName).trim().slice(0, 30) : '' })) } const hrefs = seen.filter(s => s.startsWith('/')); ck(`N2 ${lang}: por teclado se alcanzan ≥ 5 destinos del marco en 22 Tab`, new Set(hrefs).size >= 5, [...new Set(hrefs)].join(',')); await p.c.close() }
  // el marco no depende de SpaceNav: sin errores de página
  { const p = await open(A, { url: '/app/space/tools' }); ck('N2 «Mis herramientas» sin errores de página', p.errs.length === 0, p.errs.join('|')); await p.c.close() }
  if (process.env.OUT) fs.writeFileSync(process.env.OUT + `-reach-${LABEL}.json`, JSON.stringify(found))
  console.log(`RESUMEN [${LABEL}]: ${total - f}/${total} OK, ${f} FALLAS`); await BR.close(); srv.close(); await DB.end(); process.exit(0)
})().catch(async e => { console.log('EXCEPCION', e.stack || e.message); try { await BR?.close() } catch {} process.exit(1) })
