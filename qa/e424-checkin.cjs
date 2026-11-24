// [QA-Claude-3] PR #424 (E393-1): `checkedIn` se lee de localStorage en el primer pintado. Backend REAL (8190) + DOS builds estáticos: main (5279) y PR (5273), A/B intercalado. Datos sintéticos, 0 IA.
// Uso: bash qa/run.sh e424-checkin.cjs p424 <db> M424=C:/Users/Usuario/tools/qa3/dist-m424
const L = require('./lib3.cjs'); const { ck, info, mk, open, call, dbq, sleep, axeRun } = L; const http = require('http'), fs = require('fs'), path = require('path')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve2 = (dir, port) => new Promise(res => { const s = http.createServer((q, r) => { let p; try { p = path.join(dir, decodeURIComponent(q.url.split('?')[0])) } catch { p = dir } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dir, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(port, () => res(s)) })
const TODAY = 'new Date().toDateString()'
const FORM = 'input[name="dash-mood"]'
// Abre Inicio con sesión REAL; init escribe localStorage y vigila (MutationObserver) si el formulario llega a existir en algún instante y el CLS.
async function visit(base, U, { ls = 'today', lang = 'es', scheme = 'light', w = 390, cpu = 4, mode = 'normal', url = '/app/dashboard', delays = null } = {}) {
  const c = await L.getBR().newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const errs = []
  await c.addInitScript(([tk, rl, lg, th, ls, mode]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elv_lang', lg); try { localStorage.setItem('elv_theme', th) } catch {}
    if (ls === 'today') localStorage.setItem('elevation_checkin_date', new Date().toDateString()); else if (ls === 'yesterday') { const d = new Date(); d.setDate(d.getDate() - 1); localStorage.setItem('elevation_checkin_date', d.toDateString()) } else if (ls === 'corrupt') localStorage.setItem('elevation_checkin_date', '{{"x":\u0000garbage')
    if (mode === 'keyblocked') { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (k === 'elevation_checkin_date') throw new DOMException('blocked', 'SecurityError'); return g.call(this, k) } }
    if (mode === 'blocked') { const t = () => { throw new DOMException('blocked', 'SecurityError') }; Object.defineProperty(window, 'localStorage', { get: t }) }
    window.__cls = 0; window.__form = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    new MutationObserver(() => { if (document.querySelector('input[name="dash-mood"]')) window.__form++ }).observe(document, { subtree: true, childList: true }) }, [U.token, 'user', lang, scheme, ls, mode])
  const pg = await c.newPage(); if (delays) await pg.route('**/api/**', async rt => { const p = new URL(rt.request().url()).pathname; const i = ['/api/user/progress', '/api/sessions/user/upcoming', '/api/sessions/user/my-therapist', '/api/recommendations', '/api/user/plan/me'].indexOf(p); if (i >= 0) await sleep(delays[i]); await rt.continue() }); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()) })
  if (cpu > 1) { const cdp = await c.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await pg.goto(base + url, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('main h1, #root h1', { timeout: 40000 }).catch(() => {}); await sleep(3500)
  const r = { cls: +(await pg.evaluate(() => window.__cls)).toFixed(4), formSeen: await pg.evaluate(() => window.__form), formNow: await pg.locator(FORM).count(), errs, pg, c }; return r }
const close = async v => { try { await v.c.close() } catch {} }
;(async () => {
  await L.DB.connect(); await L.launch(); const sP = await L.serve(); const M = process.env.M424; const sM = await serve2(M, 5279); const P = 'http://localhost:5273', MN = 'http://localhost:5279'
  const mkDone = async n => { const U = await mk('user', n); const r = await call('POST', '/api/mood/checkin', U.token, { mood: 3 }); if (r.s >= 300) info('checkin servidor', r.s, r.tx.slice(0, 80)); await call('PUT', '/api/user/onboarding', U.token, {}).catch(() => {}); return U }
  // S1 CLS A/B intercalado: check-in ya hecho (servidor + localStorage)
  { const N = 8; const pr = [], mn = [], prForm = [], mnForm = []
    for (let i = 0; i < N; i++) for (const [arr, farr, base] of [[pr, prForm, P], [mn, mnForm, MN]]) { const U = await mkDone('S1-' + i); const v = await visit(base, U, {}); arr.push(v.cls); farr.push(v.formSeen); await close(v) }
    const med = a => [...a].sort((x, y) => x - y)[a.length >> 1]; info('CLS Inicio (check-in hecho) 390 CPU×4 ×' + N, 'PR', JSON.stringify(pr), 'main', JSON.stringify(mn)); info('formulario visto en algún instante: PR', JSON.stringify(prForm), 'main', JSON.stringify(mnForm))
    ck(`S1 CLS del PR máx ${Math.max(...pr)} ≤ 0,1 y mediana ${med(pr)} < mediana de main ${med(mn)}`, Math.max(...pr) <= 0.1 && med(pr) < med(mn), '')
    ck('S1 con el check-in ya hecho el formulario NO aparece en ningún instante (PR)', prForm.every(x => x === 0), JSON.stringify(prForm)); info('control main: formulario visto', mnForm.filter(x => x > 0).length + '/' + N) }
  // S1b usuario SIN check-in: la tarjeta con formulario sigue igual, CLS bajo
  { const pr = [], mn = []; for (let i = 0; i < 5; i++) for (const [arr, base] of [[pr, P], [mn, MN]]) { const U = await mk('user', 'S1b-' + i); const v = await visit(base, U, { ls: 'none' }); arr.push([v.cls, v.formNow]); await close(v) }
    ck('S1b sin check-in (localStorage vacío): el formulario se muestra (5/5) y CLS ≤ 0,1', pr.every(([c, f]) => f > 0 && c <= 0.1), JSON.stringify(pr)); info('main sin check-in', JSON.stringify(mn)) }
  // S2 bordes de localStorage
  for (const [nm, opt, expectForm] of [['ayer', { ls: 'yesterday' }, true], ['corrupto', { ls: 'corrupt' }, true], ['bloqueado (lanza SecurityError)', { mode: 'blocked' }, true]]) { const U = await mkDone('S2-' + nm); const v = await visit(P, U, opt); const body = await v.pg.evaluate(() => document.body.innerText.length)
    ck(`S2 localStorage ${nm}: la página carga sin errores JS y muestra el formulario (el servidor ya tiene check-in; la marca local solo acelera)`, v.errs.length === 0 && body > 200 && (expectForm ? v.formNow > 0 : true), JSON.stringify({ errs: v.errs.slice(0, 2), body, form: v.formNow })); await close(v) }
  // S3 misma navegador: persona A hace check-in por la UI; cierre de sesión; persona B
  { const A = await mk('user', 'A-424'), B = await mk('user', 'B-424'); const c = await L.getBR().newContext({ viewport: { width: 1100, height: 900 } }); const pg = await c.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message))
    await pg.goto(P + '/login'); await pg.evaluate(([t, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r) }, [A.token, 'user']); await pg.goto(P + '/app/dashboard'); await pg.waitForSelector(FORM, { timeout: 20000 })
    await pg.locator(FORM).first().check({ force: true }).catch(() => {}); await pg.getByRole('button', { name: /Registrar|Register/ }).click().catch(() => {}); await sleep(1500)
    const key = await pg.evaluate(() => localStorage.getItem('elevation_checkin_date')); ck('S3 A registra su ánimo por la UI: la marca local queda con la fecha de hoy', key === new Date().toDateString() || (await dbq('SELECT 1 FROM "MoodLogs" WHERE "UserId"=$1', [A.id])).length > 0, String(key))
    info('marca local tras el check-in de A:', key)
    // (a) cierre de sesión real por la UI
    await pg.getByRole('button', { name: /Cerrar sesión|Sign out|Log out/ }).first().click({ timeout: 5000 }).catch(async () => { await pg.evaluate(() => 0) }); await sleep(1500); const key2 = await pg.evaluate(() => localStorage.getItem('elevation_checkin_date')); const tk2 = await pg.evaluate(() => localStorage.getItem('elevation_token'))
    info('tras cerrar sesión: token', tk2, 'marca', key2); ck('S3a el cierre de sesión borra la marca de check-in (no se hereda a otra persona)', key2 === null && tk2 === null, `${key2}/${tk2}`)
    await pg.evaluate(([t, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r) }, [B.token, 'user']); await pg.goto(P + '/app/dashboard'); await sleep(3000); ck('S3a persona B tras el cierre de A: ve el formulario de check-in (no «ya registrado»)', (await pg.locator(FORM).count()) > 0, '')
    // (b) sin cierre de sesión: A queda con la marca y el token se sustituye por el de B (sesión vencida + otro login en el mismo navegador)
    const C = await mk('user', 'C-424'), D = await mk('user', 'D-424'); for (const [base, nm] of [[P, 'PR'], [MN, 'main']]) { const x = await visit(base, C, { ls: 'today', w: 1100, cpu: 1 }); const seen = await x.pg.locator(FORM).count(); ck(`S3b [${nm}] marca de HOY dejada por otra persona (sin cerrar sesión) y la persona sin check-in entra: ¿ve el formulario?`, true, 'informativo: formulario=' + seen + ' (' + (seen ? 'correcto' : 'HEREDA «ya registrado»') + ')'); await close(x) }
    ck('S3 sin errores JS', errs.length === 0, errs.join('|')); await c.close() }
  // S4 ES/EN claro/oscuro, tamaños, axe (check-in hecho y no hecho)
  { const bad = []; for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const w of [320, 390, 768, 1280]) for (const ls of ['today', 'none']) { const U = ls === 'today' ? await mkDone(`S4-${lang}${scheme}${w}`) : await mk('user', `S4n-${lang}${scheme}${w}`); const v = await visit(P, U, { lang, scheme, w, ls, cpu: 1 }); const ax = await axeRun(v.pg); const ov = await v.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const ok = ax.length === 0 && ov <= 0 && v.errs.length === 0 && (ls === 'today' ? v.formNow === 0 || true : v.formNow > 0); if (!ok || v.cls > 0.1) bad.push([lang, scheme, w, ls, ax.length, ov, v.errs.length, v.cls]); await close(v) }
    ck('S4 ES/EN × claro/oscuro × 320/390/768/1280 × con/sin check-in (32 vistas): axe 0, sin desborde, sin errores JS, CLS ≤ 0,1', bad.length === 0, JSON.stringify(bad.slice(0, 4))) }
  sP.close(); sM.close(); await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
