// [QA-Claude-5] PR #389 (ES-357 / E366-2): «Editar» un plan con moneda/período HEREDADO. Backend REAL + PostgreSQL desechable; planes heredados sembrados por SQL; Chromium; IA 0.
// Uso: qa/qa5-run.sh qa5-389.cjs <pr389|main> <base> [ONLY=F1,F2,...]   (LABEL=pr|main; en main las comprobaciones de comportamiento nuevo son CONTROL: se informan)
const L = require('./qa5-lib.cjs'); const { ck, info, mk, open, call, sleep, axeRun, dbq } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const PR = L.LABEL === 'pr'
const MSG = { currency: 'La moneda debe ser USD, COP o EUR. / The currency must be USD, COP or EUR.', period: 'El período debe ser month o year. / The period must be month or year.' }
const tag = Date.now().toString(36).slice(-5)
let n = 0
async function plan(S, { currency = 'USD', period = 'month', price = '10.00', active = true, name = 'Plan', extra = {} } = {}) {
  n++; const slug = `q${tag}${n}`
  const r = await call('POST', '/api/admin/pricing', S.token, { slug, name_es: `${name} ${slug}`, name_en: `${name} EN ${slug}`, description_es: '', description_en: '', price, currency: 'USD', period: 'month', features_es: ['a'], features_en: ['b'], isHighlighted: false, isActive: active, order: n, ...extra })
  if (r.s >= 300) throw new Error('crear plan ' + r.s + ' ' + r.tx.slice(0, 200))
  const id = r.j.plan?.id ?? r.j.id; await dbq('UPDATE "PricingPlans" SET currency=$2, period=$3 WHERE id=$1', [id, currency, period]); return { id, slug }
}
const row = async id => (await dbq('SELECT currency, period, price, "isActive", "name_es" FROM "PricingPlans" WHERE id=$1', [id]))[0]
const tab = async p => { await p.getByRole('tab', { name: /Planes|Plans/ }).click(); await sleep(700) }
const edit = async (p, id) => { await p.locator(`#plan-edit-${id}`).click(); await p.locator('#plan-currency').waitFor(); await sleep(300) }
const txt = (p, sel) => p.locator(sel).count().then(c => c ? p.locator(sel).first().innerText() : null)
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL)
  const S = await mk('superadmin', 'Super Sintético'); const ADM = await mk('admin', 'Admin Sintético')
  const sess = await call('GET', '/api/session', S.token); info('sesión superadmin', sess.s)

  if (want('F1')) for (const lang of ['es', 'en']) {
    for (const [nm, cfg, want_] of [['JPY + forever', { currency: 'JPY', period: 'forever' }, ['currency', 'period']], ['solo moneda (JPY/month)', { currency: 'JPY', period: 'month' }, ['currency']], ['solo período (USD/forever)', { currency: 'USD', period: 'forever' }, ['period']], ['basura (xx/ñandú)', { currency: 'xx', period: 'ñandú' }, ['currency', 'period']]]) {
      const pl = await plan(S, cfg); const p = await open(S, { lang, url: '/admin/content', wait: 1800 }); await tab(p); await edit(p, pl.id)
      const cur = await p.locator('#plan-currency').inputValue(); const per = await p.locator('#plan-period').inputValue()
      const errC = await txt(p, '#plan-currency-err'); const errP = await txt(p, '#plan-period-err')
      const exp = { cur: cfg.currency === 'JPY' || cfg.currency === 'xx' ? 'USD' : cfg.currency, per: cfg.period === 'forever' || cfg.period === 'ñandú' ? 'month' : cfg.period }
      const marks = (want_.includes('currency') ? errC && errC.includes(lang === 'en' ? 'The currency must be USD, COP or EUR.' : 'La moneda debe ser USD, COP o EUR.') : !errC) && (want_.includes('period') ? errP && errP.includes('The period must be month or year.') : !errP)
      if (PR) ck(`F1 [${lang}] «Editar» plan ${nm}: desplegables ${exp.cur}/${exp.per}, campos marcados solo donde hay valor heredado`, cur === exp.cur && per === exp.per && !!marks, JSON.stringify({ cur, per, errC, errP }))
      else info(`CONTROL main [${lang}] ${nm}: ${cur}/${per} marcas=${!!errC}/${!!errP}`)
      // F2: guardar sin tocar los desplegables
      const puts = []; p.on('request', rq => { if (rq.method() === 'PUT' && rq.url().includes('/api/admin/pricing/')) puts.push(JSON.parse(rq.postData())) })
      const resp = p.waitForResponse(r => r.url().includes('/api/admin/pricing/') && r.request().method() === 'PUT', { timeout: 8000 }).catch(() => null)
      await p.getByRole('button', { name: /Actualizar|Update/ }).click(); const r = await resp; await sleep(1200)
      const db = await row(pl.id); const body = await p.evaluate(() => document.body.innerText)
      if (PR) ck(`F2 [${lang}] ${nm}: guardar SIN tocar los desplegables = 200, se envía lo mostrado y el plan queda en ${exp.cur}/${exp.per}; sin «Error guardando.»`, r && r.status() === 200 && puts.length === 1 && puts[0].currency === exp.cur && puts[0].period === exp.per && db.currency === exp.cur && db.period === exp.per && !/Error guardando|Could not save|Error saving/.test(body), JSON.stringify({ st: r && r.status(), put: puts[0] && [puts[0].currency, puts[0].period], db: [db.currency, db.period] }))
      else info(`CONTROL main [${lang}] ${nm}: PUT ${r && r.status()} enviado ${puts[0] && puts[0].currency}/${puts[0] && puts[0].period} «Error guardando»=${/Error guardando/.test(body)}`)
      await p.c.close()
    }
  }
  if (want('F2')) { // elegir un valor limpia solo el aviso de ese campo
    const pl = await plan(S, { currency: 'JPY', period: 'forever' }); const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tab(p); await edit(p, pl.id)
    await p.locator('#plan-currency').selectOption('COP'); await sleep(200)
    if (PR) ck('F2b elegir moneda limpia SOLO el aviso de moneda (el de período sigue)', (await p.locator('#plan-currency-err').count()) === 0 && (await p.locator('#plan-period-err').count()) === 1)
    await p.locator('#plan-period').selectOption('year'); await sleep(200)
    if (PR) ck('F2c elegir período limpia el aviso de período', (await p.locator('#plan-period-err').count()) === 0)
    await p.getByRole('button', { name: /Actualizar/ }).click(); await sleep(1200); const db = await row(pl.id)
    if (PR) ck('F2d guardar con lo elegido (COP/year) = persistido', db.currency === 'COP' && db.period === 'year', JSON.stringify(db)); await p.c.close()
  }
  if (want('F3')) { // plan válido: sin marcas, mismos valores; crear sin cambios
    for (const lang of ['es', 'en']) {
      const pl = await plan(S, { currency: 'COP', period: 'year', price: '1500.50' }); const p = await open(S, { lang, url: '/admin/content', wait: 1800 }); await tab(p); await edit(p, pl.id)
      const cur = await p.locator('#plan-currency').inputValue(), per = await p.locator('#plan-period').inputValue(), marks = (await p.locator('#plan-currency-err').count()) + (await p.locator('#plan-period-err').count())
      ck(`F3 [${lang}] plan válido COP/year: valores intactos y SIN marcas`, cur === 'COP' && per === 'year' && marks === 0, JSON.stringify({ cur, per, marks }))
      await p.getByRole('button', { name: /Actualizar|Update/ }).click(); await sleep(1200); const db = await row(pl.id); ck(`F3 [${lang}] guardar plan válido sin cambios: COP/year y precio igual`, db.currency === 'COP' && db.period === 'year' && String(db.price) === '1500.50', JSON.stringify(db)); await p.c.close()
    }
    const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tab(p); await p.getByRole('button', { name: /Nuevo plan|Crear plan|Agregar/i }).first().click().catch(() => {}); await sleep(500)
    const hasForm = await p.locator('#plan-currency').count(); if (hasForm) { ck('F3 plan NUEVO: sin marcas de moneda/período', (await p.locator('#plan-currency-err').count()) + (await p.locator('#plan-period-err').count()) === 0) } else info('F3 no se encontró el botón de plan nuevo (revisar selector)'); await p.c.close()
  }
  if (want('F4')) { // 400 invalid_plan con campo (servidor real) y otros fallos
    const pl = await plan(S, { currency: 'USD', period: 'month' })
    const cases = [['price', 'plan-price', b => ({ ...b, price: '1.234' }), /El precio debe ser un número/], ['currency', 'plan-currency', b => ({ ...b, currency: 'JPY' }), /La moneda debe ser USD, COP o EUR/], ['period', 'plan-period', b => ({ ...b, period: 'forever' }), /El período debe ser month o year/], ['name_es', 'plan-name-es', b => ({ ...b, name_es: 'x'.repeat(300) }), /El nombre debe tener/], ['order(sin campo en pantalla → general)', 'plan-order', b => ({ ...b, order: -3 }), /^$/]]
    for (const lang of ['es', 'en']) for (const [fld, id, mut, re] of cases) {
      const p = await open(S, { lang, url: '/admin/content', wait: 1800 }); await tab(p); await edit(p, pl.id)
      await p.route(u => new URL(u).pathname === `/api/admin/pricing/${pl.id}`, rt => rt.request().method() === 'PUT' ? rt.continue({ postData: JSON.stringify(mut(JSON.parse(rt.request().postData()))) }) : rt.continue())
      await p.getByRole('button', { name: /Actualizar|Update/ }).click(); await sleep(1500)
      const e = await txt(p, `#${id}-err`); const foc = await p.evaluate(() => document.activeElement && document.activeElement.id); const gen = /Error guardando|Could not save|Error saving/.test(await p.evaluate(() => document.body.innerText))
      if (PR && fld.startsWith('order')) ck(`F4 [${lang}] 400 invalid_plan de un campo SIN control de error en pantalla (orden): aviso general, no se pinta en ningún lado`, !e && gen, JSON.stringify({ e, gen })); else if (PR) ck(`F4 [${lang}] 400 invalid_plan del servidor real (${fld}): mensaje bajo ESE campo y foco en él; sin «Error guardando.»`, !!e && re.test(e) && foc === id && !gen, JSON.stringify({ e: e && e.slice(0, 70), foc, gen }))
      else info(`CONTROL main [${lang}] ${fld}: bajo campo=${!!e} genérico=${gen}`)
      await p.c.close()
    }
    const others = [['500', rt => rt.fulfill({ status: 500, json: { error: 'x' } })], ['sin red', rt => rt.abort()], ['400 sin campo', rt => rt.fulfill({ status: 400, json: { code: 'invalid_plan', error: 'Datos del plan inválidos. / Invalid plan data.' } })], ['400 campo desconocido', rt => rt.fulfill({ status: 400, json: { code: 'invalid_plan', field: 'constructor', error: 'Raro. / Odd.' } })], ['400 otro código', rt => rt.fulfill({ status: 400, json: { code: 'slug_taken', field: 'plan-price', error: 'Ya existe. / Exists.' } })], ['400 HTML', rt => rt.fulfill({ status: 400, json: { code: 'invalid_plan', field: 'price', error: '<img src=x onerror="window.__x=1"><b>x</b> ' + 'A'.repeat(3000) } })], ['400 cuerpo no JSON', rt => rt.fulfill({ status: 400, body: '<html>boom</html>', contentType: 'text/html' })], ['403', rt => rt.fulfill({ status: 403, json: { error: 'no' } })]]
    for (const [nm, h] of others) {
      const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tab(p); await edit(p, pl.id)
      await p.route(u => new URL(u).pathname === `/api/admin/pricing/${pl.id}`, rt => rt.request().method() === 'PUT' ? h(rt) : rt.continue())
      await p.getByRole('button', { name: /Actualizar/ }).click(); await sleep(1400)
      const body = await p.evaluate(() => ({ t: document.body.innerText, x: window.__x === 1, imgs: document.querySelectorAll('[id$="-err"] img, [id$="-err"] b').length, errs: [...document.querySelectorAll('[id$="-err"]')].map(e => e.id + ':' + e.innerText.length) }))
      const ok = nm === '400 HTML' ? !body.x && body.imgs === 0 && body.errs.every(s => +s.split(':')[1] <= 400) : /Error guardando|Could not save|Error de conexión|Connection error/.test(body.t) && !body.errs.length
      if (PR) ck(`F4 otro fallo «${nm}»: aviso general (no se pinta bajo un campo); HTML solo como texto/acotado`, ok, JSON.stringify({ errs: body.errs, x: body.x })); await p.c.close()
    }
  }
  if (want('F5')) { // servidor NO relajado + desactivar + pública intacta
    for (const [nm, m, route] of [['POST JPY', 'POST', '/api/admin/pricing'], ['PUT JPY', 'PUT', null], ['PUT forever', 'PUT', null]]) {
      const pl = await plan(S, {}); const bad = nm === 'PUT forever' ? { period: 'forever' } : { currency: 'JPY' }
      const body = { slug: `z${tag}${++n}`, name_es: 'x', name_en: 'x', price: '1', currency: 'USD', period: 'month', features_es: [], features_en: [], isHighlighted: false, isActive: true, order: 1, ...bad }
      const r = await call(m, route || `/api/admin/pricing/${pl.id}`, S.token, body); const db = await row(pl.id)
      ck(`F5 servidor sin relajar: ${nm} → 400 invalid_plan con campo, sin escribir`, r.s === 400 && r.j?.code === 'invalid_plan' && !!r.j?.field && (m === 'POST' || (db.currency === 'USD' && db.period === 'month')), JSON.stringify({ s: r.s, j: r.j }))
    }
    const act = await plan(S, { name: 'Desact' }); const p = await open(S, { lang: 'es', url: '/admin/content', wait: 1800 }); await tab(p)
    await p.locator(`#plan-edit-${act.id}`).locator('xpath=following-sibling::button[contains(.,"Desactivar")]').click(); await sleep(400)
    await p.getByRole('dialog').getByRole('button', { name: 'Desactivar' }).click(); await sleep(1500)
    ck('F5 «Desactivar» sigue funcionando (confirmación → isActive=false, fila marcada INACTIVO)', (await row(act.id)).isActive === false && /INACTIVO/i.test(await p.evaluate(() => document.body.innerText)), JSON.stringify(await row(act.id))); await p.c.close()
    const pub = await call('GET', '/api/pricing'); ck('F5 lista pública GET /api/pricing: 200 y solo planes activos', pub.s === 200 && Array.isArray(pub.j) && pub.j.every(x => x.isActive === true), String(pub.s))
    const q = await open(null, { lang: 'es', url: '/pricing', wait: 2500 }); const sh = await q.evaluate(() => ({ h1: document.querySelectorAll('h1').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, t: document.querySelector('main')?.innerText.length })); const ax = await axeRun(q)
    ck('F5 /pricing pública: renderiza, 1 h1, sin desborde, axe 0', sh.h1 === 1 && sh.ov <= 0 && sh.t > 100 && ax.length === 0, JSON.stringify({ sh, ax })); console.log(`U389 ${L.LABEL} pricing chars=${sh.t}`); await q.c.close()
  }
  if (want('F6')) { // a11y con error
    const bad = []; const pl = await plan(S, { currency: 'JPY', period: 'forever' })
    for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [1360, 'dark'], [390, 'light'], [390, 'dark'], [320, 'light'], [320, 'dark']]) {
      const p = await open(S, { lang, w, scheme, theme: scheme, url: '/admin/content', wait: 1500 }); await tab(p); await edit(p, pl.id)
      const a = await axeRun(p); const s = await p.evaluate(() => ({ ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, inv: document.querySelector('#plan-currency')?.getAttribute('aria-invalid'), desc: document.querySelector('#plan-currency')?.getAttribute('aria-describedby') }))
      if (a.length || s.ov > 0 || (PR && (s.inv !== 'true' || !(s.desc || '').includes('plan-currency-err')))) bad.push(`${lang} ${w} ${scheme}: ${a.join(';')} ${JSON.stringify(s)}`)
      await p.c.close()
    }
    ck('F6 axe wcag2a/2aa/21a/21aa/22aa = 0 con el plan heredado abierto (12 estados), sin desborde, aria-invalid + aria-describedby al mensaje', bad.length === 0, bad.slice(0, 3).join(' | '))
    const p = await open(S, { lang: 'es', w: 390, url: '/admin/content', wait: 1500 }); await tab(p); await edit(p, pl.id); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab')
    const first = await p.evaluate(() => document.activeElement && document.activeElement.id); info('F6 foco al abrir Editar:', first); await p.c.close()
  }
  if (want('F8')) { // solo admin/superadmin
    for (const role of ['user', 'therapist']) { const U = await mk(role, 'R ' + role); const r = await call('GET', '/api/admin/pricing/all', U.token); const pl = await plan(S, {}); const w = await call('PUT', `/api/admin/pricing/${pl.id}`, U.token, { name_es: 'hack' }); const none = await call('GET', '/api/admin/pricing/all', null)
      const p = await open(U, { lang: 'es', url: '/admin/content', wait: 1800 }); const path = await p.evaluate(() => location.pathname)
      ck(`F8 [${role}] GET/PUT /api/admin/pricing = 401/403; sin token 401; la pantalla no se abre (${path})`, [401, 403].includes(r.s) && [401, 403].includes(w.s) && none.s === 401 && /no tiene acceso|IR A MI INICIO/i.test(await p.evaluate(() => document.body.innerText)) && (await row(pl.id)).name_es !== 'hack', `${r.s}/${w.s}/${none.s} ${path}`); await p.c.close() }
  }
  if (want('U')) { const q = await open(null, { lang: 'es', url: '/pricing', wait: 2500 }); const t = await q.evaluate(() => document.querySelector('main')?.innerText || ''); console.log(`U389 ${L.LABEL} /pricing chars=${t.length} hash=${L.crypto.createHash('sha1').update(t).digest('hex').slice(0, 10)}`); await q.c.close() }
  if (want('R')) { // CLS a 390 px CPU×4 al abrir «Editar» (plan heredado)
    const pl = await plan(S, { currency: 'JPY', period: 'forever' }); const cls = [], util = []
    for (let i = 0; i < +(process.env.RUNS || 2); i++) {
      const c = await L.getBR().newContext({ viewport: { width: 390, height: 900 } })
      await c.addInitScript(([tk, rl]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; try { new PerformanceObserver(x => { for (const e of x.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch {} }, [S.token, 'superadmin'])
      const pg = await c.newPage(); const cdp = await c.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await pg.goto('http://localhost:' + (process.env.WEB_PORT || 5278) + '/admin/content', { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('main h1, #root h1', { timeout: 40000 }).catch(() => {}); await sleep(2500)
      await tab(pg); await pg.locator(`#plan-edit-${pl.id}`).click(); await pg.locator('#plan-currency').waitFor(); await sleep(2500)
      cls.push(+(await pg.evaluate(() => window.__cls)).toFixed(4)); util.push(await pg.evaluate(() => (document.querySelector('[role=dialog]')?.innerText || '').length)); await c.close()
    }
    console.log(`R389 ${L.LABEL} editar-plan cls=${JSON.stringify(cls)} util_dialogo=${JSON.stringify(util)}`)
  }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
