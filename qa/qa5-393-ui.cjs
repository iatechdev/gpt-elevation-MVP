// [QA-Claude-5] PR #393 (ES-329): «Mi panel» y menú de usuario EN PANTALLA (build fresco del PR, API simulada con datos sintéticos, sin IA).
// Uso: PLAYWRIGHT_MODULE=... AXE=<axe.min.js> BASE=http://127.0.0.1:4393 node qa/qa5-393-ui.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const BASE = process.env.BASE
let ok = 0, bad = 0; const check = (label, cond, ev) => { if (cond) { ok++; console.log('OK    ' + label) } else { bad++; console.log('FALLA ' + label + (ev ? ' · ' + String(ev).slice(0, 300) : '')) } }
const iso = (d) => d.toISOString().slice(0, 10)
const PATHS = { progress: '/api/user/progress', upcoming: '/api/sessions/user/upcoming', therapist: '/api/sessions/user/my-therapist', recommendations: '/api/recommendations', plan: '/api/user/plan/me' }
const PLAN = { plan: { id: 2, slug: 'plus', name_es: 'Plus (ejemplo)', name_en: 'Plus (example)', price: 19, currency: 'USD', period: 'month', features_es: ['Uno'], features_en: ['One'], isHighlighted: false }, limits: {} }
async function open(browser, { lang = 'es', width = 1280, tz = 'America/Bogota', now, logs, name = 'Ana María Gómez', scheme = 'light' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce', timezoneId: tz, locale: lang === 'en' ? 'en-US' : 'es-CO' }); const page = await ctx.newPage()
  if (now) await page.clock.install({ time: new Date(now) })
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === PATHS.progress) return route.fulfill({ json: { stats: null, moodLogs: logs || [], ratings: [], recommendations: [] } })
    if (p === PATHS.upcoming) return route.fulfill({ json: { session: null } })
    if (p === PATHS.therapist) return route.fulfill({ json: { therapist: { id: 7 } } })
    if (p === PATHS.recommendations) return route.fulfill({ json: [] })
    if (p === PATHS.plan) return route.fulfill({ json: PLAN })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(([l, n]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', n); localStorage.setItem('elevation_checkin_date', new Date().toDateString()) }, [lang, name])
  return { ctx, page }
}
const read = (page) => page.evaluate(() => {
  const dl = document.querySelector('#dash-progress')?.closest('section'); const big = dl && dl.querySelector('.pc-big'); const ths = dl ? [...dl.querySelectorAll('.pc-trend th')].map((e) => e.textContent.trim()) : []; const tds = dl ? [...dl.querySelectorAll('.pc-trend td')].map((e) => e.textContent.trim()) : []
  return { week: big ? big.textContent.trim() : null, ths, tds }
})
const goto = async (page) => { await page.goto(BASE + '/app/dashboard'); await page.waitForSelector('.pc-trend', { timeout: 15000 }) }
const dowEs = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']; const dowEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const norm = (s) => s.toLowerCase().replace(/\./g, '')
;(async () => {
  const br = await chromium.launch()
  // ── semana y tendencia, con reloj fijo y zona Bogotá (UTC−5)
  // A) lunes 16-nov-2026 08:00 Bogotá (13:00Z). Registro del lunes 16 + del domingo 15 (semana anterior) + del jueves 12.
  { const { ctx, page } = await open(br, { now: '2026-11-16T13:00:00Z', logs: [{ id: 1, date: '2026-11-16', checkin_mood: 4, checkout_mood: 5 }, { id: 2, date: '2026-11-15', checkin_mood: 2, checkout_mood: 2 }, { id: 3, date: '2026-11-12', checkin_mood: 3, checkout_mood: 3 }] })
    await goto(page); const r = await read(page)
    check('A) lunes 08:00 en Bogotá: «esta semana» cuenta el registro del LUNES (1) y no el del domingo anterior (el bug original descartaba el del lunes en UTC−5)', r.week === '1', JSON.stringify(r))
    const last = r.ths[6]; check('A) la tendencia termina HOY (lun) y el día anterior es dom', norm(r.ths[6]) === 'lun' && norm(r.ths[5]) === 'dom', JSON.stringify(r.ths))
    check('A) el valor de la tendencia queda bajo el día correcto: lun = promedio 4,5 de 5; dom = 2 de 5; jue = 3 de 5', /4[,.]5/.test(r.tds[6]) && /^2\b|2 de|2 of/.test(r.tds[5]) && /^3\b|3 de|3 of/.test(r.tds[2]), JSON.stringify(r.tds)); await ctx.close() }
  // B) domingo 22-nov-2026 10:00 Bogotá: la semana va del lunes 16 al domingo 22. Registros: 16 y 22 cuentan; 15 no.
  { const { ctx, page } = await open(br, { now: '2026-11-22T15:00:00Z', logs: [{ id: 1, date: '2026-11-16', checkin_mood: 4, checkout_mood: 4 }, { id: 2, date: '2026-11-22', checkin_mood: 3, checkout_mood: 3 }, { id: 3, date: '2026-11-15', checkin_mood: 1, checkout_mood: 1 }] })
    await goto(page); const r = await read(page)
    check('B) domingo: «esta semana» = 2 (lunes 16 y domingo 22; el domingo 15 es de la semana anterior). Antes: 0 los domingos', r.week === '2', JSON.stringify(r)); check('B) la tendencia termina en dom y empieza en lun', norm(r.ths[6]) === 'dom' && norm(r.ths[0]) === 'lun', JSON.stringify(r.ths)); await ctx.close() }
  // C) 20:30 en Bogotá (= 01:30Z del día siguiente): el servidor guarda el registro con el día UTC (el siguiente). La pantalla debe usar el MISMO día.
  { const { ctx, page } = await open(br, { now: '2026-11-18T01:30:00Z', logs: [{ id: 1, date: '2026-11-18', checkin_mood: 5, checkout_mood: 5 }] })   // en Bogotá son las 20:30 del martes 17
    await goto(page); const r = await read(page); const i = r.tds.findIndex((t) => /^5\b|5 de|5 of/.test(t))
    check('C) 20:30 en Bogotá (día UTC siguiente): el registro de ese día UTC aparece en la ÚLTIMA columna (misma lógica que el servidor), nunca desplazado', i === 6, JSON.stringify(r))
    console.log(`INFO C) a las 20:30 locales la última columna se rotula «${r.ths[6]}» (día UTC = miércoles 18; el local es martes 17): consistente con los datos, pero la etiqueta no es el día local de la persona`); await ctx.close() }
  // D) inglés + zona de adelanto (Auckland, UTC+12/13) y zona atrasada (Pago Pago UTC−11): etiquetas y cuenta correctas
  for (const [tz, now] of [['Pacific/Auckland', '2026-11-16T20:00:00Z'], ['Pacific/Pago_Pago', '2026-11-16T05:00:00Z'], ['Asia/Kolkata', '2026-11-22T20:30:00Z']]) {
    const dayUtc = now.slice(0, 10); const d = new Date(dayUtc + 'T00:00:00Z'); const wd = d.getUTCDay(); const mon = new Date(d.getTime() - ((wd + 6) % 7) * 86400000)
    const logs = [{ id: 1, date: iso(mon), checkin_mood: 3, checkout_mood: 3 }, { id: 2, date: dayUtc, checkin_mood: 4, checkout_mood: 4 }, { id: 3, date: iso(new Date(mon.getTime() - 86400000)), checkin_mood: 2, checkout_mood: 2 }]
    const { ctx, page } = await open(br, { lang: 'en', tz, now, logs }); await goto(page); const r = await read(page); const exp = mon.getTime() === d.getTime() ? 2 : 2
    check(`D) ${tz}, inglés: «this week» = ${exp} (lunes y hoy; el día anterior al lunes no cuenta) y la última etiqueta es ${dowEn[wd]}`, r.week === String(exp) && r.ths[6] === dowEn[wd], JSON.stringify(r)); await ctx.close() }
  // E) sin registros: «0» y 7 guiones; lectura fallida no pinta datos (la cubre ES-332)
  { const { ctx, page } = await open(br, { now: '2026-11-18T15:00:00Z', logs: [] }); await goto(page); const r = await read(page); check('E) sin registros: 0 esta semana y 7 «—» en la tendencia', r.week === '0' && r.tds.length === 7 && r.tds.every((t) => t === '—'), JSON.stringify(r)); await ctx.close() }
  if (process.env.QA_FAST === "A") { console.log(`UI #393 (A-E): ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0) }
  // F) menú de usuario: tamaño computado, nombre largo, 5 «idiomas» de nombre, anchos 320/390/768/1280
  const names = ['Ana María Gómez', 'Maximiliano Fernández de la Vega y Rodríguez-Montalbán', 'می‌خواهم احمدی', '👩‍💻 Zoë', 'سلمى المنصوري', 'Ñ'.repeat(60)]
  for (const width of [320, 390, 768, 1280]) for (const name of names) {
    const { ctx, page } = await open(br, { width, name, now: '2026-11-18T15:00:00Z', logs: [] }); await goto(page)
    const m = await page.evaluate(() => { const who = document.querySelector('.cg-usermenu__who'); const brand = document.querySelector('.cg-brand, header a, [class*=brand]'); const btn = document.querySelector('.cg-usermenu__button'); const cs = getComputedStyle(who); const hdr = document.querySelector('header') || document.body
      return { fs: parseFloat(cs.fontSize) / parseFloat(getComputedStyle(document.documentElement).fontSize), btnW: btn.getBoundingClientRect().width, hdrH: hdr.getBoundingClientRect().height, overflowX: document.documentElement.scrollWidth > innerWidth + 1, brandLeft: brand ? brand.getBoundingClientRect().left : null, brandRight: brand ? brand.getBoundingClientRect().right : null, btnLeft: btn.getBoundingClientRect().left, btnRight: btn.getBoundingClientRect().right, btnTop: btn.getBoundingClientRect().top, btnBottom: btn.getBoundingClientRect().bottom, brandTop: brand ? brand.getBoundingClientRect().top : null, brandBottom: brand ? brand.getBoundingClientRect().bottom : null } })
    const overlap = m.brandLeft !== null && m.brandRight > m.btnLeft + 1 && m.brandLeft < m.btnRight - 1 && m.brandBottom > m.btnTop + 1 && m.brandTop < m.btnBottom - 1
    check(`F) ${width}px, nombre «${name.slice(0, 22)}»: tamaño computado 1,1 rem, sin desborde horizontal y sin solaparse con el logo`, Math.abs(m.fs - 1.1) < 0.02 && !m.overflowX && !overlap, JSON.stringify({ fs: m.fs, ox: m.overflowX, overlap, hdrH: m.hdrH })); await ctx.close() }
  if (process.env.QA_FAST === "F") { console.log(`UI #393 (A-F): ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0) }
  // G) axe en claro/oscuro a 390 y 1280, español e inglés, con el nombre largo
  for (const scheme of ['light', 'dark']) for (const width of [390, 1280]) for (const lang of ['es', 'en']) {
    const { ctx, page } = await open(br, { width, scheme, lang, now: '2026-11-18T15:00:00Z', name: names[1], logs: [{ id: 1, date: '2026-11-18', checkin_mood: 4, checkout_mood: 4 }] }); await goto(page); await page.addScriptTag({ content: axeSource })
    const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length)))
    check(`G) axe (wcag2a/2aa/21a/21aa/22aa) = 0 en ${scheme} ${width}px ${lang}`, v.length === 0, v.join(',')); await ctx.close() }
  // H) CLS a 390 px, CPU ×4, 10 ejecuciones
  { const cls = []; for (let i = 0; i < 10; i++) { const { ctx, page } = await open(br, { width: 390, now: undefined, logs: [{ id: 1, date: iso(new Date()), checkin_mood: 4, checkout_mood: 4 }] }); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }); await goto(page); await page.waitForTimeout(800); cls.push(await page.evaluate(() => window.__cls)); await ctx.close() }
    const max = Math.max(...cls); check(`H) CLS a 390 px con CPU ×4 (10 ejecuciones) ≤ 0,1`, max <= 0.1, `max=${max.toFixed(4)} todos=${cls.map((x) => x.toFixed(3)).join(',')}`) }
  console.log(`UI #393: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
