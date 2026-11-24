// [QA-Claude-3] PR #432 (ES-369): marca del check-in por persona y por día en su zona. Backend REAL (8190) + build del PR (5273). Reloj del NAVEGADOR fijado con context.clock.setFixedTime; zona de la persona: el servidor siempre responde la suya (Bogotá por defecto), así que para otras zonas se reescribe `timeZone` en la respuesta de /api/user/progress (prueba del cliente). Datos sintéticos, 0 IA.
// Uso: bash qa/run.sh e432-marca.cjs p432 <db>
const L = require('./lib3.cjs'); const { ck, info, mk, call, sleep, axeRun } = L
const FORM = 'input[name="dash-mood"]'
const day = (iso, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const idOf = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).id
// abre un contexto con sesión de U; opts: now (ISO fijo), zone (reescribe timeZone de progress), ls (pares a escribir en localStorage antes de cargar), lang, mode ('blocked'|'getthrow')
async function ctx(U, { now = null, zone = null, ls = {}, lang = 'es', scheme = 'light', w = 1100, cpu = 1, mode = '' } = {}) {
  const c = await L.getBR().newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const errs = []
  if (now) await c.clock.setFixedTime(new Date(now))
  await c.addInitScript(([tk, lg, ls, mode]) => { if (tk && !localStorage.getItem('elevation_token')) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user') } try { localStorage.setItem('elv_lang', lg) } catch {}
    for (const [k, v] of Object.entries(ls)) if (!sessionStorage.getItem('__ls_' + k)) { localStorage.setItem(k, v); sessionStorage.setItem('__ls_' + k, '1') }
    if (mode === 'getthrow') { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { if (/^elevation_(checkin|tz)/.test(k)) throw new DOMException('blocked', 'SecurityError'); return g.call(this, k) } }
    if (mode === 'blocked') { const t = () => { throw new DOMException('blocked', 'SecurityError') }; Object.defineProperty(window, 'localStorage', { get: t }) }
    window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [U ? U.token : null, lang, ls, mode])
  const pg = await c.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()) })
  if (zone) await pg.route('**/api/user/progress', async rt => { const r = await rt.fetch(); let j; try { j = await r.json() } catch { return rt.fulfill({ response: r }) } j.timeZone = zone; await rt.fulfill({ response: r, json: j }) })
  if (cpu > 1) { const cdp = await c.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  return { c, pg, errs } }
const P = 'http://localhost:5273'
const dash = async (x, wait = 3000) => { await x.pg.goto(P + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await x.pg.waitForSelector('main h1, #root h1', { timeout: 40000 }).catch(() => {}); await sleep(wait); return x.pg.locator(FORM).count() }
const lsGet = (x, k) => x.pg.evaluate(k => { try { return localStorage.getItem(k) } catch { return 'THROWS' } }, k)
// check-in por la pantalla Hoy (/app/checkin); mood 3 navega al chat
const checkinUI = async x => { await x.pg.goto(P + '/app/checkin', { waitUntil: 'domcontentloaded' }); await x.pg.waitForSelector('input[name="mood"]', { timeout: 30000 }); await x.pg.locator('input[name="mood"][value="3"]').check({ force: true }); await x.pg.locator('form button[type="submit"]').first().click(); await sleep(2500) }
;(async () => {
  await L.DB.connect(); await L.launch(); const sP = await L.serve()
  const A = await mk('user', 'A-432'), B = await mk('user', 'B-432'); const idA = String(idOf(A.token)), idB = String(idOf(B.token))
  // F1 A hace check-in por Inicio (UI); B en el mismo navegador sin cerrar sesión
  { const x = await ctx(A); await dash(x); ck('F1 A sin marca: ve el formulario de Inicio', (await x.pg.locator(FORM).count()) > 0, '')
    await x.pg.locator(FORM).first().check({ force: true }).catch(() => {}); await x.pg.getByRole('button', { name: /Registrar|Register/ }).first().click().catch(() => {}); await sleep(1800)
    const mark = await lsGet(x, 'elevation_checkin'); info('marca tras el check-in de A:', mark, '| zona:', await lsGet(x, 'elevation_tz'))
    let m = null; try { m = JSON.parse(mark) } catch {}
    ck('F1 la marca queda como {id de A, día AAAA-MM-DD} (sin secretos) y la clave antigua no se escribe', !!m && String(m.id) === idA && /^\d{4}-\d{2}-\d{2}$/.test(m.day) && (await lsGet(x, 'elevation_checkin_date')) === null && Object.keys(m).sort().join() === 'day,id', String(mark))
    await x.pg.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500); ck('F1 A al volver ve «ya registrado» (sin formulario)', (await x.pg.locator(FORM).count()) === 0, '')
    // B entra en el mismo navegador sin cerrar sesión: token sustituido
    await x.pg.evaluate(t => { localStorage.setItem('elevation_token', t) }, B.token); const f = await dash(x); ck('F1 B (mismo navegador, sin cerrar sesión de A) NO hereda la marca: ve el formulario', f > 0, 'formulario=' + f)
    await x.pg.evaluate(t => { localStorage.setItem('elevation_token', t) }, A.token); ck('F1 A de nuevo: sigue marcado (la marca de A no se pisó por ver a B)', (await dash(x)) === 0, '')
    ck('F1 sin errores JS', x.errs.length === 0, x.errs.join('|')); await x.c.close() }
  // F2 clave antigua
  { const x = await ctx(A, { ls: { elevation_checkin_date: new Date().toDateString() } }); const f = await dash(x); ck('F2 la clave antigua `elevation_checkin_date` de hoy ya no vale: formulario visible', f > 0, 'formulario=' + f); await x.c.close() }
  // F3 día en la zona de la persona (Bogotá por defecto del servidor): cambio de día a medianoche de Bogotá
  { const Z = "America/Bogota"; const mark = d => ({ elevation_checkin: JSON.stringify({ id: idA, day: d }), elevation_tz: JSON.stringify({ id: idA, zone: Z }) })
    for (const [nm, now, d, expectForm] of [['23:59 del 21 (Bogotá) con marca del 21', '2026-11-22T04:59:00Z', '2026-11-21', false], ['00:01 del 22 (Bogotá) con marca del 21', '2026-11-22T05:01:00Z', '2026-11-21', true], ['mediodía del 21 con marca de ayer (20)', '2026-11-21T17:00:00Z', '2026-11-20', true], ['mediodía del 21 con marca de mañana (22)', '2026-11-21T17:00:00Z', '2026-11-22', true], ['mediodía del 21 con marca de hoy', '2026-11-21T17:00:00Z', '2026-11-21', false]]) { const x = await ctx(A, { now, ls: mark(d) }); const f = await dash(x); ck(`F3 ${nm}: ${expectForm ? 'formulario visible' : 'sin formulario'}`, expectForm ? f > 0 : f === 0, 'formulario=' + f + ' errs=' + x.errs.length); await x.c.close() } }
  // F4 zonas límite a las 19:00 locales; check-in desde Hoy (/app/checkin) y luego Inicio. (a) sin zona recordada (primera visita); (b) con zona recordada
  for (const [Z, now] of [['America/Bogota', '2026-11-22T00:00:00Z'], ['Pacific/Auckland', '2026-11-21T06:00:00Z'], ['Pacific/Kiritimati', '2026-11-21T05:00:00Z']]) { const local = day(now, Z), utc = day(now, 'UTC'); info(`F4 ${Z} 19:00 locales: día local ${local} · día UTC ${utc}`)
    for (const mode of ['a-sin-zona-recordada', 'b-zona-recordada']) { const U = await mk('user', `F4-${Z.split('/')[1]}-${mode[0]}`); const x = await ctx(U, { now, zone: Z })
      if (mode[0] === 'b') await dash(x, 2500)
      await checkinUI(x); const mark = await lsGet(x, 'elevation_checkin'); const f = await dash(x)
      const m = (() => { try { return JSON.parse(mark) } catch { return null } })()
      ck(`F4 ${Z} 19:00 [${mode}]: tras registrar en Hoy, Inicio muestra «ya registrado» y la marca lleva el día LOCAL ${local}`, f === 0 && m && m.day === local, `formulario=${f} marca=${mark} zona=${await lsGet(x, 'elevation_tz')}`)
      if (Z === 'America/Bogota' && mode[0] === 'a') { await x.c.clock.setFixedTime(new Date('2026-11-22T15:00:00Z')); const f2 = await dash(x); ck('F4c [Bogotá, sin zona recordada] AL DÍA SIGUIENTE (22, mediodía en Bogotá) sin haber registrado ese día: el formulario debe verse (la marca del día 21 no debe valer)', f2 > 0, 'formulario=' + f2 + ' marca=' + (await lsGet(x, 'elevation_checkin'))) }
      await x.c.close() } }
  // F5 cambio de zona entre visitas: check-in en Bogotá (19:00 del 21); la misma persona aparece con zona Auckland (ahí ya es 22 y las 08:00): otro día → el formulario debe volver
  { const U = await mk('user', 'F5'); const now = '2026-11-22T00:00:00Z'; const x = await ctx(U, { now, zone: 'America/Bogota' }); await dash(x, 2500); await checkinUI(x); const m1 = await lsGet(x, 'elevation_checkin'); const f1 = await dash(x)
    ck('F5 en Bogotá tras registrar: Inicio «ya registrado»', f1 === 0, m1)
    await x.pg.unroute('**/api/user/progress'); await x.pg.route('**/api/user/progress', async rt => { const r = await rt.fetch(); const j = await r.json(); j.timeZone = 'Pacific/Auckland'; await rt.fulfill({ response: r, json: j }) })
    const f2 = await dash(x); info('F5 tras pasar a zona Auckland (día local ' + day(now, 'Pacific/Auckland') + '): formulario=' + f2 + ' marca=' + (await lsGet(x, 'elevation_checkin')) + ' zona=' + (await lsGet(x, 'elevation_tz')))
    ck('F5 al cambiar la zona de la persona a otra donde ya es otro día, la marca del día anterior no vale (formulario visible, coherente con el servidor)', f2 > 0, 'formulario=' + f2); await x.c.close() }
  // F6 sesión expirada sin logout: A deja marca; el token de B sustituye al de A (ya cubierto en F1); además token basura/sin id
  { const x = await ctx(null, { ls: { elevation_token: 'x.y.z', elevation_role: 'user', elevation_checkin: JSON.stringify({ id: idA, day: day(Date.now(), 'America/Bogota') }) } }); await x.pg.goto(P + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await sleep(3000); const url = x.pg.url(); ck('F6 token sin forma válida: no rompe (sin errores JS no controlados) y termina en login o error controlado', !x.errs.some(e => /Cannot read|undefined|is not/.test(e)), url + ' ' + x.errs.slice(0, 2).join('|')); await x.c.close() }
  // F7 almacenamiento bloqueado / corrupto
  for (const [nm, opt] of [['getItem lanza para las claves de marca/zona', { mode: 'getthrow' }], ['localStorage inaccesible (SecurityError)', { mode: 'blocked' }], ['marca con JSON roto', { ls: { elevation_checkin: '{no es json', elevation_tz: '[]' } }], ['marca con tipos ajenos', { ls: { elevation_checkin: JSON.stringify({ id: { a: 1 }, day: 5 }), elevation_tz: JSON.stringify({ id: idA, zone: 7 }) } }], ['zona recordada inventada', { ls: { elevation_tz: JSON.stringify({ id: idA, zone: 'Zona/Inventada' }), elevation_checkin: JSON.stringify({ id: idA, day: day(Date.now(), 'UTC') }) } }]]) { const x = await ctx(A, opt); if (opt.mode === 'blocked') { await x.pg.goto(P + '/login', { waitUntil: 'domcontentloaded' }); await sleep(1500); ck(`F7 ${nm}: la página de entrada carga sin errores JS`, x.errs.length === 0, x.errs.slice(0, 2).join('|')) } else { const f = await dash(x); const body = await x.pg.evaluate(() => document.body.innerText.length); ck(`F7 ${nm}: Inicio carga sin errores JS, muestra contenido${/inventada/.test(nm) ? '' : ' y el formulario'}`, x.errs.length === 0 && body > 200 && (/inventada/.test(nm) ? true : f > 0), `formulario=${f} body=${body} errs=${x.errs.slice(0, 2).join('|')}`) } await x.c.close() }
  // F8 cierre de sesión borra todo
  { const x = await ctx(A); await dash(x, 2500); await x.pg.locator(FORM).first().check({ force: true }).catch(() => {}); await x.pg.getByRole('button', { name: /Registrar|Register/ }).first().click().catch(() => {}); await sleep(1500)
    await x.pg.evaluate(() => localStorage.setItem('elevation_checkin_date', new Date().toDateString())); const before = [await lsGet(x, 'elevation_checkin'), await lsGet(x, 'elevation_tz'), await lsGet(x, 'elevation_checkin_date')]; info('antes de cerrar sesión: marca/zona/antigua', JSON.stringify(before))
    // salida real por la UI: menú de cuenta
    let out = false; try { await x.pg.locator('.cg-usermenu__button').first().click({ timeout: 4000 }); await sleep(500); await x.pg.locator('.cg-usermenu__out').first().click({ timeout: 4000 }); await sleep(2500); info('tras pulsar «Cerrar sesión»: url', x.pg.url(), '| texto:', (await x.pg.evaluate(() => document.body.innerText)).replace(/s+/g, ' ').slice(0, 160)); out = true; const stay = await lsGet(x, 'elevation_token'); if (stay) { const skip = x.pg.getByRole('button', { name: /^(Saltar|Skip)$/ }); info('despedida (Saltar/Skip) visible:', await skip.count()); if (await skip.count()) await skip.first().click({ timeout: 3000 }).catch(() => {}); await sleep(4000) } } catch (e) { info('menú de cuenta no accionable por la UI:', e.message.slice(0, 80)) }
    const after = [await lsGet(x, 'elevation_token'), await lsGet(x, 'elevation_checkin'), await lsGet(x, 'elevation_tz'), await lsGet(x, 'elevation_checkin_date')]; info('tras cerrar sesión por la UI (' + out + '): token/marca/zona/antigua', JSON.stringify(after))
    ck('F8 cierre de sesión por la UI borra token, marca, zona y clave antigua', out && after.every(v => v === null), JSON.stringify(after)); await x.c.close() }
  // F10 axe y desborde ES/EN claro/oscuro 320–1280 con y sin marca
  { const bad = []; for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const w of [320, 390, 768, 1280]) for (const done of [true, false]) { const U = await mk('user', `F10-${lang}${scheme}${w}${done ? 'd' : 'n'}`); const id = String(idOf(U.token)); const x = await ctx(U, { lang, scheme, w, ls: done ? { elevation_checkin: JSON.stringify({ id, day: day(Date.now(), 'America/Bogota') }), elevation_tz: JSON.stringify({ id, zone: 'America/Bogota' }) } : {} }); await dash(x, 2500); const ax = await axeRun(x.pg); const ov = await x.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const f = await x.pg.locator(FORM).count(); if (ax.length || ov > 0 || x.errs.length || (done ? f !== 0 : f === 0)) bad.push([lang, scheme, w, done, ax.length, ov, x.errs.length, f]); await x.c.close() }
    ck('F10 ES/EN × claro/oscuro × 320/390/768/1280 × con/sin marca (32 vistas): axe 0, sin desborde, sin errores JS, formulario coherente con la marca', bad.length === 0, JSON.stringify(bad.slice(0, 4))) }
  sP.close(); await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
