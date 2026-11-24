// QA-Claude-2 — ES-265 (PR #237): sesión vencida en el panel profesional (401 → /login, 403 mensaje propio sin «Reintentar»). Backend REAL (:8090, Postgres con migraciones reales), 0 IA, datos SINTETICOS.
// SIMULADO (declarado): GET /api/session -> «therapist» en los casos que lo indican (para que la compuerta deje ver el panel y probar los bloques); y los 5xx/403 por bloque cuando se dice SIMULADO. Revocación y 401/403 por rol son REALES.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, AXE, DIST, COPYDIR (frontend/src/i18n), LABEL (pr|main).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr', AXE = fs.readFileSync(process.env.AXE, 'utf8')
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }; const sleep = ms => new Promise(r => setTimeout(r, ms))
const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const rd = f2 => fs.readFileSync(path.join(process.env.COPYDIR, f2), 'utf8'); const TC = rd('therapistCopy.ts')
const grab = key => [...TC.matchAll(new RegExp('^\\s*' + key + ':\\s*([\'"])(.*)\\1,?\\s*$', 'gm'))].map(m => m[2]); const cp = (lang, key) => grab(key)[lang === 'es' ? 0 : 1]
const mk = async role => { n++; const email = `qa2-p237-${tag}-${n}@example.test`; const name = `QA237 ${tag} ${n}`; const r = await call('POST', '/api/register', null, { name: 'x' + name, email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$3, "onboardingCompleted"=true, role=$2 WHERE id=$1', [id, role, name]); const login = async () => (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; return { id, name, email, login, token: await login() } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(process.env.DIST, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(process.env.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(5173, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length)) }
const ENDS = ['/api/therapist/pacientes', '/api/sessions/therapist/upcoming', '/api/therapist/alerts', '/api/therapist/prompt', '/api/therapist/validation/status']
const simSession = async p => p.route(u => new URL(u).pathname === '/api/session', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: 'therapist', onboardingCompleted: true }) }))
let BR
const open = async (tk, { lang = 'es', w = 1360, sim = true, routes, token2 } = {}) => {
  const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); await c.addInitScript(([t, l]) => { if (!localStorage.getItem('elevation_token')) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l) } }, [tk, lang])
  const p = await c.newPage(); p.errs = []; p.cons = []; p.urls = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.on('console', m => p.cons.push(m.text())); p.on('framenavigated', fr => { if (fr === p.mainFrame()) p.urls.push(fr.url()) })
  if (sim) await simSession(p); if (routes) await routes(p)
  await p.goto('http://localhost:5173/therapist/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(2500); return { c, p } }
const tokenOf = p => p.evaluate(() => localStorage.getItem('elevation_token'))
const retries = (p, lang) => p.getByRole('button', { name: new RegExp(cp(lang, 'panel_retry')) }).count()
const alerts = p => p.locator('[role=alert]').allInnerTexts()
const failBlock = (pathName, status, bodyObj = {}) => async p => p.route(u => new URL(u).pathname === pathName, r => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(bodyObj) }))
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve()
  const TP = await mk('therapist'), TU = await mk('user'), TR = await mk('therapist'), TN = await mk('therapist')
  await sleep(1100); const rv = await call('POST', '/api/logout-all', TR.token); ck('Y0 REAL: logout-all revoca las sesiones del profesional (preparación)', rv.s === 200, rv.s)
  for (const e of ENDS) { const a = await call('GET', e, TR.token), b = await call('GET', e, TU.token); ck(`Y0b REAL ${e}: revocado → 401 y rol user → 403`, a.s === 401 && b.s === 403, a.s + '/' + b.s) }
  for (const [lang, w] of [['es', 1360], ['en', 390], ['es', 320]]) { const t = k => cp(lang, k)
    // Y1 token revocado REAL, compuerta simulada
    { const { c, p } = await open(TR.token, { lang, w }); const tk = await tokenOf(p); const url = p.url(); const rt = await retries(p, lang); const body = (await p.locator('body').innerText()).replace(/\s+/g, ' ')
      ck(`Y1 ${lang}/${w} (revocación REAL; /api/session simulado): llega a /login, token borrado, sin «${t('panel_retry')}»`, /\/login/.test(url) && !tk && rt === 0 && !body.includes(t('panel_section_error')), JSON.stringify({ url, tk: !!tk, rt })); await c.close() }
    // Y1b token revocado REAL sin simular nada
    { const { c, p } = await open(TR.token, { lang, w, sim: false }); const url = p.url(); const tk = await tokenOf(p); ck(`Y1b ${lang}/${w} (todo REAL): token revocado → /login y sesión borrada`, /\/login/.test(url) && !tk, JSON.stringify({ url, tk: !!tk })); await c.close() }
    // Y1c token inválido (firma rota) REAL
    { const bad = TP.token.slice(0, -4) + 'AAAA'; const { c, p } = await open(bad, { lang, w }); const url = p.url(); const tk = await tokenOf(p); ck(`Y1c ${lang}/${w} (token con firma rota, 401 REAL): /login y sesión borrada`, /\/login/.test(url) && !tk, JSON.stringify({ url, tk: !!tk })); await c.close() }
    // Y3 rol user REAL → 403 en los 5 bloques
    { const { c, p } = await open(TU.token, { lang, w }); const al = await alerts(p); const rt = await retries(p, lang); const tk = await tokenOf(p); const url = p.url()
      ck(`Y3 ${lang}/${w} (403 REAL por rol «user»; /api/session simulado): 6 bloques con «${t('panel_section_forbidden')}», sin «${t('panel_retry')}», sesión intacta`, al.length === 6 && al.every(x => x.trim().startsWith(t('panel_section_forbidden'))) && rt === 0 && tk === TU.token && /dashboard/.test(url), JSON.stringify({ n: al.length, rt, keep: tk === TU.token, url })); await c.close() }
  }
  // Y1d 401 SIMULADO por bloque (uno a la vez), el resto REAL con profesional vigente
  for (const e of ENDS) { const { c, p } = await open(TP.token, { lang: 'es', w: 1360, routes: failBlock(e, 401, { code: 'session_invalid' }) }); const url = p.url(); const tk = await tokenOf(p); const rt = await retries(p, 'es'); ck(`Y1d (401 SIMULADO solo en ${e}): /login, token borrado, sin Reintentar`, /\/login/.test(url) && !tk && rt === 0, JSON.stringify({ url, tk: !!tk, rt })); await c.close() }
  // Y2 un login más nuevo no se borra por un 401 tardío con el token viejo
  { const old = TN.token; const fresh = await TN.login(); ck('Y2 pre: dos tokens distintos', old !== fresh)
    const { c, p } = await open(old, { routes: async pg => { await pg.route(u => new URL(u).pathname === '/api/therapist/alerts', async r => { await pg.evaluate(t => localStorage.setItem('elevation_token', t), fresh).catch(() => {}); await r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }) }) } })
    const tk = await tokenOf(p); ck('Y2 (401 SIMULADO tardío con token viejo mientras hay login nuevo): el token nuevo se conserva y no se va a /login', tk === fresh && !/\/login/.test(p.url()), JSON.stringify({ keep: tk === fresh, url: p.url() })); await c.close() }
  // Y4 red y 5xx conservan Reintentar
  for (const [lang, w] of [['es', 1360], ['en', 390]]) { const t = k => cp(lang, k)
    { const { c, p } = await open(TP.token, { lang, w, routes: async pg => pg.route(u => new URL(u).pathname === '/api/therapist/alerts', r => r.abort('connectionreset')) }); const al = await alerts(p); const rt = await retries(p, lang); const tk = await tokenOf(p)
      ck(`Y4 ${lang}/${w} (corte de red REAL con route.abort): un bloque con «${t('panel_section_error')}» y «${t('panel_retry')}», sesión intacta`, al.length === 1 && al[0].includes(t('panel_section_error')) && rt === 1 && tk === TP.token, JSON.stringify({ al, rt })); await c.close() }
    { const { c, p } = await open(TP.token, { lang, w, routes: failBlock('/api/therapist/prompt', 500) }); const al = await alerts(p); const rt = await retries(p, lang); const tk = await tokenOf(p)
      ck(`Y4b ${lang}/${w} (500 SIMULADO): mensaje de error + «${t('panel_retry')}», sin cerrar sesión`, al.length === 1 && al[0].includes(t('panel_section_error')) && rt === 1 && tk === TP.token, JSON.stringify({ al, rt })); await c.close() }
    // Y5/Y7 reintento por teclado: 500 -> Enter -> 200 (REAL)
    { let first = true; const { c, p } = await open(TP.token, { lang, w, routes: async pg => pg.route(u => new URL(u).pathname === '/api/therapist/alerts', r => { if (first) { first = false; return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) } return r.continue() }) })
      const btn = p.getByRole('button', { name: new RegExp(t('panel_retry')) }); await btn.focus(); const foc = await p.evaluate(() => document.activeElement?.textContent?.trim()); await p.keyboard.press('Enter'); await sleep(1800)
      const rt = await retries(p, lang); const al = await alerts(p); const fo = await p.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent?.trim().slice(0, 40) }))
      ck(`Y5/Y7 ${lang}/${w} (500 SIMULADO y luego REAL): Enter en «${t('panel_retry')}» recarga, el bloque se muestra y el foco va a su título (no se pierde)`, foc === t('panel_retry') && rt === 0 && al.length === 0 && fo.tag === 'H2', JSON.stringify({ foc, rt, al, fo })); await c.close() }
    // Y5b 500 -> reintento -> 403 : mensaje propio sin botón
    { let k = 0; const { c, p } = await open(TP.token, { lang, w, routes: async pg => pg.route(u => new URL(u).pathname === '/api/therapist/alerts', r => { k++; return r.fulfill({ status: k === 1 ? 500 : 403, contentType: 'application/json', body: '{}' }) }) })
      await p.getByRole('button', { name: new RegExp(t('panel_retry')) }).click(); await sleep(1500); const al = await alerts(p); const rt = await retries(p, lang); const tk = await tokenOf(p)
      ck(`Y5b ${lang}/${w} (SIMULADO 500 y luego 403 al reintentar): pasa a «${t('panel_section_forbidden')}» sin botón, sesión intacta`, al.length === 1 && al[0].includes(t('panel_section_forbidden')) && rt === 0 && tk === TP.token, JSON.stringify({ al, rt })); await c.close() }
    // Y5c 403 en un bloque (SIMULADO) y los demás cargan
    { const { c, p } = await open(TP.token, { lang, w, routes: failBlock('/api/therapist/prompt', 403) }); const al = await alerts(p); const rt = await retries(p, lang); const tk = await tokenOf(p)
      ck(`Y5c ${lang}/${w} (403 SIMULADO en un solo bloque): solo ese bloque dice «${t('panel_section_forbidden')}»; sin Reintentar; los otros cargan; sesión intacta`, al.length === 1 && al[0].includes(t('panel_section_forbidden')) && rt === 0 && tk === TP.token, JSON.stringify({ al, rt })); await c.close() }
  }
  // Y6/Y8/Y9 responsive, axe, privacidad
  for (const [lang, w] of [['es', 1360], ['en', 390], ['es', 320]]) { const t = k => cp(lang, k)
    for (const [label, tk, routes] of [['403', TU.token, undefined], ['5xx', TP.token, async pg => { for (const e of ENDS) await failBlock(e, 500)(pg) }]]) {
      const { c, p } = await open(tk, { lang, w, routes }); const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); const v0 = await axeRun(p); const v = v0.filter(x => !x.startsWith("label-content-name-mismatch:1")); if (v0.length !== v.length) console.log("INFO O227-A conocida (marca aria-label, fuera del PR):", lang, w, label)
      const small = await p.evaluate(() => [...document.querySelectorAll('[role=alert] button')].filter(b => { const r = b.getBoundingClientRect(); return r.width < 24 || r.height < 24 }).length)
      ck(`Y6/Y8 ${lang}/${w} estado ${label}: sin desborde horizontal, axe sin violaciones, botones ≥ 24 px`, !ov && v.length === 0 && small === 0, JSON.stringify({ ov, v, small }))
      const body = await p.locator('body').innerText(); const leak = body.includes(tk) || p.urls.some(u => u.includes(tk)) || p.cons.some(x => x.includes(tk)) || body.includes(TP.email) || body.includes(TU.email)
      ck(`Y9 ${lang}/${w} estado ${label}: sin token ni correos en texto, URL ni consola; sin errores de página`, !leak && p.errs.length === 0, JSON.stringify({ errs: p.errs })); await c.close() } }
  await DB.end(); await BR.close(); srv.close(); console.log(`\nRESUMEN [${LABEL}]: ${total - f}/${total} OK, ${f} FALLA`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 900)); process.exit(3) })
