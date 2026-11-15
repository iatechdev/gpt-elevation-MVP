// [QA-Claude] ES-183 · PR #215 · vista preliminar y modo por defecto de /admin/pilot-metrics (diseño aprobado 12119/12120).
// Para cada build (def | pnorm | punc | perr) sirve el `dist` indicado y mide: sin cifras, 0 peticiones, franja, estados en palabra, «menos de 5 personas»,
// «Actualizar simulación» (cargando/error), axe, desborde, controles >= 44 px y teclado, en ES/EN y 320/390/1360.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, AXE, DIST, VARIANT (def|pnorm|punc|perr), API_PORT (8190), WEB_PORT (5273), OUT (carpeta de resultados JSON)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const E = process.env, API = `http://localhost:${E.API_PORT || 8190}`, WEB = Number(E.WEB_PORT || 5273), V = E.VARIANT || 'def', AXE = fs.readFileSync(E.AXE, 'utf8')
const results = []; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 600) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${V}] ` + n, String(x).slice(0, 300)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 800) }); console.log('INFO', `[${V}]`, n, String(x).slice(0, 400)) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch { /* */ } return { s: r.status, j } }
const DB = new Client({ connectionString: E.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const mk = async role => { n++; const email = `qa-p215-${tag}-${n}@example.test`; await call('POST', '/api/register', null, { name: 'QA p215 ' + n, email, password: PASS }); await dbq('UPDATE "Users" SET role=$1, "onboardingCompleted"=true WHERE email=$2', [role, email]); return { token: (await call('POST', '/api/login', null, { email, password: PASS })).j?.token } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p = path.join(E.DIST, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(E.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length)) }
let BR
const open = async (user, { lang = 'es', w = 1360 } = {}) => {
  const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk) }, user.token)
  const p = await c.newPage(); p.errs = []; p.apis = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text().slice(0, 160)) })
  p.on('request', r => { const u = new URL(r.url()); if (u.origin === API) p.apis.push(r.method() + ' ' + u.pathname) })
  await p.goto(`http://localhost:${WEB}/admin/pilot-metrics`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('h1', { timeout: 20000 }).catch(() => {})
  if (lang === 'en') await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await sleep(900); return { c, p } }
const body = async p => (await p.locator('main').innerText().catch(() => p.locator('body').innerText())).replace(/\s+/g, ' ')
const T = { es: { pending: 'Meta en definición', fra: /datos ficticios|ficticia/i, protectedTxt: /menos de 5 personas/, refresh: 'Actualizar simulación', loadErr: 'No pudimos cargar la simulación.', noData: 'Sin datos', notConf: 'Sin configurar', notAv: 'No disponible', prot: 'Datos protegidos', warn: 'Las metas no son resultados obtenidos ni evidencia de eficacia clínica' },
  en: { pending: 'Target being defined', fra: /fictional data|fictional/i, protectedTxt: /fewer than 5 people/, refresh: 'Refresh simulation', loadErr: 'We could not load the simulation.', noData: 'No data', notConf: 'Not configured', notAv: 'Not available', prot: 'Protected data', warn: 'Targets are not achieved results or evidence of clinical effectiveness' } }
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve(); const ADM = await mk('admin'), SUP = await mk('superadmin')
  const statesSeen = new Set()
  for (const [nm, who] of [['admin', ADM], ['superadmin', SUP]]) for (const lang of ['es', 'en']) { if (nm === 'superadmin' && V !== 'def' && V !== 'pnorm') continue
    const t = T[lang]; const { c, p } = await open(who, { lang }); const txt = await body(p); const tg = `${V} ${nm}/${lang}`
    ck(`${tg}: metas «${t.pending}» ×4 y ninguna cifra de meta (ni 5/6, 4/6, 7 días, 30 días, 7 days, 30 days, %)`, (txt.match(new RegExp(t.pending, 'g')) || []).length === 4 && !/\d+\s*\/\s*\d+|\b(7|30)\s*(días|days)\b|%/.test(txt), txt.slice(0, 220))
    ck(`${tg}: texto fijo «${t.warn}»`, txt.includes(t.warn))
    const calls = p.apis.filter(a => /metric|pilot|feedback/i.test(a)); ck(`${tg}: 0 peticiones a métricas/piloto/feedback (red completa: ${JSON.stringify(p.apis)})`, calls.length === 0, JSON.stringify(calls))
    if (V === 'def') {
      ck(`${tg}: «Resultados observados» con «${t.noData}» ×4 y ningún dígito después`, (() => { const i = txt.search(/Resultados observados|Observed results/); const o = i >= 0 ? txt.slice(i) : ''; return i >= 0 && (o.match(new RegExp(t.noData, 'g')) || []).length === 4 && !/\d/.test(o) })(), txt.slice(-260))
      const btn = p.getByRole('button', { name: lang === 'es' ? 'Actualizar' : 'Refresh', exact: true }); const dis = await btn.isDisabled().catch(() => null); const d = await btn.getAttribute('aria-describedby').catch(() => null); const reason = d ? await p.locator('#' + d).innerText().catch(() => '') : ''
      ck(`${tg}: «Actualizar» deshabilitado con motivo ligado por aria-describedby («${reason.slice(0, 50)}…»)`, dis === true && reason.length > 10, `dis=${dis} d=${d}`)
      ck(`${tg}: en el modo por defecto NO hay franja de datos ficticios, ni estados «${t.prot}» ni «${t.notConf}»`, !t.fra.test(txt) && !txt.includes(t.prot) && !txt.includes(t.notConf), '')
    } else {
      ck(`${tg}: franja de vista preliminar visible (datos ficticios)`, t.fra.test(txt), txt.slice(0, 160))
      for (const s of [t.noData, t.notConf, t.notAv, t.prot, lang === 'es' ? 'En curso' : 'In progress', lang === 'es' ? 'Disponible (ficticio)' : 'Available (fictional)']) if (txt.includes(s)) statesSeen.add(s)
      info(`${tg}: estados en palabra presentes`, JSON.stringify([...statesSeen]))
      if (V !== 'perr') {
        const hasProt = txt.includes(t.prot); ck(`${tg}: si hay «${t.prot}», el texto nombra el umbral («menos de 5 personas») y no se muestra ningún conteo`, !hasProt || (t.protectedTxt.test(txt) && (await p.locator('main dl').count()) === 0), `dl=${await p.locator('main dl').count()}`)
      }
      const rb = p.getByRole('button', { name: t.refresh, exact: true }); ck(`${tg}: botón «${t.refresh}» presente y habilitado`, (await rb.count()) === 1 && await rb.isEnabled(), '')
      if (V === 'perr') { ck(`${tg}: error de carga «${t.loadErr}» visible con role=status`, txt.includes(t.loadErr) && (await p.locator('[role=status]').filter({ hasText: t.loadErr }).count()) >= 1, txt.slice(0, 200)) }
      await p.evaluate(() => { window.__st = []; const mo = new MutationObserver(() => { const e = document.querySelector('[role=status]'); window.__st.push(e ? e.textContent : '') }); mo.observe(document.body, { subtree: true, childList: true, characterData: true }) })
      await rb.click(); await sleep(600); const st = await p.evaluate(() => window.__st); const after = await body(p)
      info(`${tg}: secuencia de [role=status] tras «${t.refresh}»`, JSON.stringify([...new Set(st)]))
      ck(`${tg}: tras «${t.refresh}» la pantalla vuelve a su estado (${V === 'perr' ? 'error otra vez' : 'resultados'}) sin romperse y con 0 peticiones al servidor`, (V === 'perr' ? after.includes(t.loadErr) : after.includes(t.pending)) && p.apis.filter(a => /metric|pilot|feedback/i.test(a)).length === 0 && p.errs.length === 0, `${p.errs.join('|')} ${after.slice(0, 120)}`)
    }
    ck(`${tg}: sin errores de página ni de consola`, p.errs.length === 0, p.errs.join('|')); await c.close() }
  // M5: axe, desborde, controles táctiles y teclado
  for (const [lang, w] of [['es', 1360], ['en', 390], ['es', 390], ['en', 1360], ['es', 320], ['en', 320]]) { const tg = `${V} ${lang}/${w}`; const { c, p } = await open(ADM, { lang, w })
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`${tg}: sin desborde horizontal`, ov <= 0, String(ov))
    const ax = await axeRun(p); ck(`${tg}: axe WCAG A/AA/2.2 AA = 0`, ax.length === 0, JSON.stringify(ax))
    const stops = []; await p.keyboard.press('Tab'); for (let i = 0; i < 25; i++) { const s = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { name: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), vis: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none', dis: e.disabled === true } }); if (s) stops.push(s); await p.keyboard.press('Tab') }
    ck(`${tg}: teclado con foco visible y sin foco en controles deshabilitados`, stops.length >= 3 && stops.every(s => s.vis) && !stops.some(s => s.dis), JSON.stringify(stops.slice(0, 5)))
    const small = await p.evaluate(() => [...document.querySelectorAll('#pilot-main button, #pilot-main a, main button, main a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44 }).map(e => e.textContent.trim().slice(0, 20) + ' ' + Math.round(e.getBoundingClientRect().height)))
    ck(`${tg}: controles de la pantalla >= 44 px de alto`, small.length === 0, JSON.stringify(small)); await c.close() }
  await DB.end(); await BR.close(); srv.close(); console.log(`RESUMEN [${V}]: ${results.filter(r => 'ok' in r && r.ok).length}/${results.filter(r => 'ok' in r).length} OK, ${f} FALLA`)
  fs.writeFileSync(path.join(E.OUT || '.', `ES-183-preview-${V}.json`), JSON.stringify({ variant: V, states: [...statesSeen], results }, null, 1)); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 900)); process.exit(3) })
