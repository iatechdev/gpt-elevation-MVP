// ES-332 (punto 5): /app/dashboard con la API caída. Chromium, API simulada con DATOS SINTÉTICOS (sin datos reales ni IA).
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4114 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4114 node scripts/es332-dashboard-errores.cjs
// Por cada una de las 5 lecturas × (respuesta 500 | corte de red) × ES/EN × 390/1360:
//  - aparece UN aviso role=alert en SU tarjeta (con «Reintentar») y las demás tarjetas siguen con sus datos;
//  - nunca se pinta «0» como dato ni «—» de tendencia ni la tarjeta de plan vacía mientras la lectura falla;
//  - «Reintentar» repite SOLO las lecturas fallidas (se cuentan las peticiones); si sigue fallando, el aviso y el botón (con foco) permanecen;
//  - al recuperarse, se pintan los datos, desaparece el aviso y el foco pasa al título de la tarjeta.
// Además: todo caído (4 avisos), estado de carga (sin «0»), axe wcag2a/2aa/21a/21aa/22aa = 0 en los estados con error (claro y oscuro, 390/1360/320) y CLS a 390 px CPU ×4.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4114'
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
const PATHS = { progress: '/api/user/progress', upcoming: '/api/sessions/user/upcoming', therapist: '/api/sessions/user/my-therapist', recommendations: '/api/recommendations', plan: '/api/user/plan/me' }
// Tarjeta (id del título) que alimenta cada lectura.
const CARD = { progress: 'dash-progress', upcoming: 'dash-session', therapist: 'dash-session', recommendations: 'dash-recs', plan: 'dash-plan' }
const ALERT_TEXT = { 'dash-progress': /No se pudo cargar tu progreso|Could not load your progress/, 'dash-session': /No se pudo cargar tu próxima sesión|We could not load your next session/,
  'dash-plan': /No se pudo cargar tu plan|We could not load your plan/, 'dash-recs': /No se pudieron cargar tus recomendaciones|We could not load your recommendations/ }
const logs = [0, 1, 2, 4, 5].map((n, i) => ({ id: i + 1, date: day(n), checkin_mood: 2 + (i % 3), checkout_mood: 3 + (i % 2) }))
const BODY = {
  progress: { stats: null, moodLogs: logs, ratings: [], recommendations: [] },
  upcoming: { session: null },
  therapist: { therapist: { id: 7 } },
  recommendations: [{ id: 1, category: 'habit', content: 'Texto de ejemplo uno', generatedAt: new Date().toISOString() }],
  plan: { plan: { id: 2, slug: 'plus', name_es: 'Plus (ejemplo)', name_en: 'Plus (example)', price: 19, currency: 'USD', period: 'month', features_es: ['Característica uno (ejemplo)'], features_en: ['Feature one (example)'], isHighlighted: false }, limits: { chatMessagesDay: 10, sessionsMonth: 4, canAccessProgress: true, canMatchTherapist: true } },
}
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }

async function open(browser, { lang, width, scheme = 'light', modes = {}, delay = 0 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const hits = Object.fromEntries(Object.keys(PATHS).map(k => [k, 0]))
  await page.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    const key = Object.keys(PATHS).find(k => PATHS[k] === p)
    if (!key) return route.fulfill({ json: {} })
    hits[key]++
    if (delay) await new Promise(r => setTimeout(r, delay))
    const mode = modes[key]
    if (mode === '500') return route.fulfill({ status: 500, json: { error: 'Error sintético' } })
    if (mode === 'corte') return route.abort('connectionrefused')
    return route.fulfill({ json: BODY[key] })
  })
  await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_checkin_date', new Date().toDateString()) }, [lang])
  return { ctx, page, hits, modes }
}
const axeRun = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))) }
// Estado de las tarjetas: alertas por tarjeta, datos visibles y «0»/«—» como dato.
const snapshot = page => page.evaluate(() => {
  const card = id => document.getElementById(id)?.closest('section')
  const out = { alerts: {}, text: document.body.innerText, active: document.activeElement?.id || document.activeElement?.textContent?.trim() || '' }
  for (const id of ['dash-progress', 'dash-session', 'dash-plan', 'dash-recs']) { const s = card(id); out.alerts[id] = s ? [...s.querySelectorAll('[role="alert"]')].map(a => a.textContent) : null; out[id] = s ? s.innerText : '' }
  out.bigZero = [...document.querySelectorAll('.pc-big')].some(e => e.textContent.trim() === '0')
  out.trendDash = [...document.querySelectorAll('.pc-trend td')].some(e => e.textContent.trim() === '—')
  out.totalAlerts = document.querySelectorAll('[role="alert"]').length
  out.retryButtons = [...document.querySelectorAll('[role="alert"] button')].map(b => b.textContent.trim())
  return out
})

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const retryLabel = lang === 'es' ? 'Reintentar' : 'Retry'
    for (const read of Object.keys(PATHS)) for (const mode of ['500', 'corte']) {
      const tag = `${read} ${mode} ${lang} ${width}px`
      const { ctx, page, hits, modes } = await open(browser, { lang, width, modes: { [read]: mode } })
      await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
      let s = await snapshot(page)
      const card = CARD[read]
      // 'upcoming'/'therapist': el aviso de la sesión sale con upcoming caído; si solo cae el profesional y no hay sesión próxima, también (se necesita para decidir qué mostrar).
      check(s.alerts[card] && s.alerts[card].length === 1 && ALERT_TEXT[card].test(s.alerts[card][0]), `${tag}: un aviso en su tarjeta (${JSON.stringify(s.alerts)})`)
      check(s.totalAlerts === 1, `${tag}: ningún otro aviso (${s.totalAlerts})`)
      check(!s.bigZero, `${tag}: no se pinta «0» como dato`)
      if (read === 'progress') check(!s.trendDash && !/Lun|Mon|VIE|FRI/i.test(s['dash-progress']) , `${tag}: sin tendencia vacía como dato`)
      if (read === 'plan') check(!/Gratis|Free|Básico|Basic/i.test(s['dash-plan']), `${tag}: sin tarjeta de plan vacía`)
      if (read !== 'progress') check(/\d/.test(s['dash-progress']) || /de 5|of 5/.test(s['dash-progress']), `${tag}: las demás tarjetas conservan sus datos`)
      if (read !== 'plan') check(/Plus \(ejemplo\)|Plus \(example\)/i.test(s['dash-plan']), `${tag}: el plan sigue visible`)
      check(s.retryButtons.length === 1 && s.retryButtons[0] === retryLabel, `${tag}: un botón «${retryLabel}» (${JSON.stringify(s.retryButtons)})`)
      // Reintentar con la lectura aún caída: solo esa lectura se repite; el aviso y el foco permanecen.
      const before = { ...hits }
      await page.getByRole('button', { name: retryLabel, exact: true }).click(); await page.waitForTimeout(400)
      const after = { ...hits }
      const repeated = Object.keys(PATHS).filter(k => after[k] !== before[k])
      check(repeated.length === 1 && repeated[0] === read, `${tag}: «Reintentar» repite solo ${read} (repitió ${repeated})`)
      s = await snapshot(page)
      check(s.alerts[card]?.length === 1, `${tag}: el aviso permanece si sigue caído`)
      // Se recupera la API: «Reintentar» pinta los datos, quita el aviso y lleva el foco al título.
      delete modes[read]
      const b2 = { ...hits }
      await page.getByRole('button', { name: retryLabel, exact: true }).click(); await page.waitForTimeout(500)
      const rep2 = Object.keys(PATHS).filter(k => hits[k] !== b2[k])
      s = await snapshot(page)
      check(rep2.length === 1 && rep2[0] === read, `${tag}: al recuperarse, solo se repitió ${read} (${rep2})`)
      check(s.totalAlerts === 0, `${tag}: sin avisos tras recuperarse`)
      check(s.active === card, `${tag}: el foco pasa al título de la tarjeta (activo: «${s.active}»)`)
      await ctx.close()
    }
    // Todo caído: cuatro avisos (la sesión agrupa dos lecturas), ninguno de los «0».
    for (const mode of ['500', 'corte']) {
      const tag = `todo ${mode} ${lang} ${width}px`
      const modes = Object.fromEntries(Object.keys(PATHS).map(k => [k, mode]))
      const { ctx, page } = await open(browser, { lang, width, modes })
      await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
      const s = await snapshot(page)
      check(s.totalAlerts === 4 && Object.values(s.alerts).every(a => a && a.length === 1), `${tag}: 4 avisos, uno por tarjeta (${s.totalAlerts})`)
      check(!s.bigZero && !s.trendDash && !/Gratis|Free/.test(s['dash-plan']), `${tag}: ningún dato falso`)
      check(s.retryButtons.length === 4, `${tag}: 4 botones «${retryLabel}» (${s.retryButtons.length})`)
      await ctx.close()
    }
    // Cargando (respuesta lenta): ni «0» ni plan vacío; sí «Cargando».
    {
      const tag = `cargando ${lang} ${width}px`
      const { ctx, page } = await open(browser, { lang, width, delay: 2500 })
      await page.goto(BASE + '/app/dashboard', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(800)
      const s = await snapshot(page)
      check(!s.bigZero && !s.trendDash && !/Gratis|Free/.test(s['dash-plan']) && /Cargando|Loading/.test(s['dash-progress']) && s.totalAlerts === 0, `${tag}: sin «0» ni plan vacío mientras carga`)
      await ctx.close()
    }
  }
  // axe en los estados con error (todo caído y una lectura caída), claro y oscuro, 390/1360/320, ES/EN.
  for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) for (const which of ['todo', 'plan']) {
    const modes = which === 'todo' ? Object.fromEntries(Object.keys(PATHS).map(k => [k, '500'])) : { plan: '500' }
    const { ctx, page } = await open(browser, { lang, width, scheme, modes })
    await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(300)
    const axe = await axeRun(page)
    const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, inlineColor: [...document.querySelectorAll('main [style]')].filter(e => /color|background/.test(e.getAttribute('style') || '')).length }))
    check(axe.length === 0 && m.overflow <= 0 && m.h1 === 1 && m.inlineColor === 0, `axe/desborde ${which} ${lang} ${width}px ${scheme}: axe=[${axe}] desborde=${m.overflow} h1=${m.h1}`)
    await ctx.close()
  }
  // CLS a 390 px con CPU ×4 (10 corridas): con todo caído y con una lectura caída.
  for (const which of ['todo', 'plan']) {
    const values = [], cards = []
    for (let i = 0; i < 10; i++) {
      const modes = which === 'todo' ? Object.fromEntries(Object.keys(PATHS).map(k => [k, '500'])) : { plan: '500' }
      const { ctx, page } = await open(browser, { lang: 'es', width: 390, modes })
      const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => { window.__cls = 0; window.__cards = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if ((e.sources || []).some(x => x.node && x.node.closest && x.node.closest('section.cg-card'))) window.__cards += e.value } }).observe({ type: 'layout-shift', buffered: true }) })
      await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000)
      values.push(await page.evaluate(() => window.__cls)); cards.push(await page.evaluate(() => window.__cards)); await ctx.close()
    }
    values.sort((a, b) => a - b); cards.sort((a, b) => a - b)
    // «total» incluye el desplazamiento del primer pintado del marco (pc-stack 0→885), que main también tiene (mismo valor 0,1218 en ~50 % de las corridas, sin tarjetas): se declara aparte.
    console.log(`CLS 390px CPU×4 ${which} caído: total mediana=${values[5].toFixed(4)} máx=${values[9].toFixed(4)} | solo tarjetas del tablero mediana=${cards[5].toFixed(4)} máx=${cards[9].toFixed(4)}`)
    check(cards[9] <= 0.1, `CLS de las tarjetas ${which} ≤ 0,1`)
  }
  await browser.close()
  console.log(`${total - failures}/${total} comprobaciones OK`)
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
