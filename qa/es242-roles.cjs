// QA-Claude-2 — ES-196 (PR #242): matriz de roles × rutas con los bloques nuevos (vendor-react / vendor-router). Backend REAL (:8090, Postgres con migraciones reales), 0 IA, datos SINTETICOS. Nada simulado.
// Imprime una firma por rol×ruta (ruta final, pantalla en blanco, errores de consola/página, bloques con error HTTP, bloques JS cargados normalizados) para COMPARAR PR vs main con diff.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, DIST, LABEL (pr|main).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr'
const sleep = ms => new Promise(r => setTimeout(r, ms)); const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const mk = async (role, onboarded = true, extra = {}) => { n++; const email = `qa2-p242-${tag}-${n}@example.test`; const name = `QA242 ${tag} ${n}`; const r = await call('POST', '/api/register', null, { name: 'x' + name, email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$4, "onboardingCompleted"=$5, role=$2, "therapistId"=$3 WHERE id=$1', [id, role, extra.therapistId ?? null, name, onboarded]); return { id, role, token: (await call('POST', '/api/login', null, { email, password: PASS })).j?.token } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(process.env.DIST, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(process.env.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(5173, () => res(s)) })
const ROUTES = ['/', '/login', '/pricing', '/profesionales', '/manifiesto', '/forgot-password', '/reset-password', '/design-system', '/ruta-que-no-existe', '/app/dashboard', '/app/chat', '/app/diary', '/app/plan', '/app/skill-map', '/app/onboarding', '/app/my-therapist', '/app/professional-reviews', '/therapist/dashboard', '/therapist/patient/1', '/admin/dashboard', '/admin/users', '/admin/metrics', '/admin/content', '/admin/route-catalog', '/facilitation', '/board/x']
const norm = u => new URL(u).pathname.replace(/^\/assets\//, '').replace(/-[A-Za-z0-9_-]{8}(\.(js|css))$/, '$1')
let BR
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve()
  const T = await mk('therapist'); const ROLES = [['anonimo', null], ['persona', await mk('user', true, { therapistId: T.id })], ['persona-sin-onboarding', await mk('user', false)], ['profesional', T], ['admin', await mk('admin')], ['superadmin', await mk('superadmin')], ['junta', await mk('board')]]
  const reactLoads = new Set(); let blank = 0, errsTotal = 0, assetFail = 0, cases = 0
  for (const [role, u] of ROLES) { const c = await BR.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); await c.addInitScript(([tk, r]) => { if (tk && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', r) } localStorage.setItem('elv_lang', 'es') }, [u?.token ?? '', u?.role ?? ''])
    for (const route of ROUTES) { const p = await c.newPage(); const js = new Set(), fails = [], errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 80))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 80)) })
      p.on('response', r => { const url = r.url(); if (url.startsWith('http://localhost:5173/assets/')) { if (r.status() >= 400) fails.push(r.status() + ' ' + norm(url)); if (/\.js$/.test(url)) js.add(norm(url)) } })
      await p.goto('http://localhost:5173' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}); await sleep(2200); const fin = new URL(p.url()).pathname; const len = (await p.locator('body').innerText().catch(() => '')).trim().length; const isBlank = len < 20; cases++
      if (isBlank) blank++; errsTotal += errs.length; assetFail += fails.length; for (const j of js) if (/vendor-react|react-dom/.test(j)) reactLoads.add(j)
      const vr = [...js].filter(x => /^vendor-react\.js$/.test(x)).length, vt = [...js].filter(x => /^vendor-router\.js$/.test(x)).length
      console.log(`SIG ${role} ${route} -> ${fin} | blank=${isBlank} | errs=${errs.length} | assetFails=${fails.length} | vendorReact=${vr} vendorRouter=${vt}${errs.length ? ' | ' + errs[0] : ''}${fails.length ? ' | ' + fails[0] : ''}`); await p.close() }
    await c.close() }
  console.log(`\nRESUMEN [${LABEL}]: ${cases} casos, ${blank} en blanco, ${errsTotal} errores de consola/página, ${assetFail} bloques con error HTTP`)
  await DB.end(); await BR.close(); srv.close()
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 900)); process.exit(3) })
