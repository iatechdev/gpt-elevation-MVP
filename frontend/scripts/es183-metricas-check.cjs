// ES-310 (ES-349): métricas del piloto de Administración (/admin/pilot-metrics) en Cartografía, en navegador real (Chromium) con datos sintéticos (sin servidor: el modo de vista previa usa el repositorio en memoria).
// Tres compilaciones, una por modo (PM_MODE):
//   nodata  → build normal: metas «en definición», resultados «Sin datos», «Actualizar» deshabilitado con su nota; no pide NADA al servidor.
//   preview → VITE_ENABLE_PILOT_FEEDBACK_PREVIEW=true: franja de revisión (Banner), cohorte ficticia, estados en palabra con chip, «datos protegidos», «Actualizar» con cargando.
//   error   → preview + VITE_PILOT_FEEDBACK_SCENARIO=metrics-error: aviso de error con «Reintentar carga».
// Mide en claro/oscuro × ES/EN × 1360/390/320: axe wcag2a/2aa/21a/21aa/22aa = 0, h1 único, un solo main y un solo «Saltar al contenido» (los del marco), sin clases antiguas (pilot-scope, elv-), sin estilos en línea,
// sin desborde, objetivos >= 24 px, y CLS <= 0,1 a 390 px con CPU×4.
// Uso: PM_MODE=nodata|preview|error PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4319 node scripts/es183-metricas-check.cjs
//   (el build y `vite preview` de cada modo los levanta quien corre el script; ver la descripción del PR)
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4319'
const MODE = process.env.PM_MODE || 'nodata'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }

async function open(browser, { width, lang, scheme, cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []; const requests = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  page.on('request', r => { const p = new URL(r.url()).pathname; if (p.startsWith('/api/') && p !== '/api/session') requests.push(p) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/pilot-metrics', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.waitForTimeout(MODE === 'nodata' ? 300 : 700)
  return { ctx, page, errors, requests }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map(n => n.target.join('>')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 5))

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${MODE} ${width}px ${lang} ${scheme}`
    const { ctx, page, errors, requests } = await open(browser, { width, lang, scheme })
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    report(await page.locator('main').count() === 1 && await page.locator('a[href^="#"]').filter({ hasText: /Saltar|Skip/ }).count() === 1, `un solo main y un solo «Saltar al contenido» (el del marco) (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('.pilot-scope, [class*="elv-"], .pilot-card, .pilot-grid').length) === 0, `sin clases antiguas (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea (${tag})`)
    report(await page.locator('.pm-grid > *').count() >= 4, `cuatro metas y cuatro resultados o más tarjetas (${tag})`)
    const v = await axe(page); report(v.length === 0, `axe en 0 (${tag})`, v.join(','))
    report(await overflow(page) <= 0, `sin desborde horizontal (${tag})`)
    const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
    if (MODE === 'nodata') {
      const btn = page.locator('main .cg-btn').first()
      report(await btn.isDisabled() && await btn.getAttribute('aria-describedby') === 'metrics-refresh-note' && await page.locator('#metrics-refresh-note').count() === 1, `«Actualizar» deshabilitado con su nota (${tag})`)
      report(requests.length === 0, `no pide nada al servidor (${tag})`, requests.join(','))
    }
    if (MODE === 'preview') {
      report(await page.locator('.cg-banner[role=note]').count() === 1, `franja de revisión con la pieza Banner (${tag})`)
      report(await page.locator('.pm-grid .cg-chip').count() === 4, `los cuatro estados con palabra en un chip (${tag})`)
      const text = (await page.locator('main').innerText()).toLowerCase()
      report(/(5 personas|5 people)/.test(text), `«datos protegidos» con su umbral (${tag})`)
      await page.locator('main .pg-actions .cg-btn').last().click()
      report(await page.locator('.pm-grid > *').count() >= 4, `«Actualizar» vuelve a mostrar los resultados (${tag})`)
    }
    if (MODE === 'error') {
      report(await page.locator('.cg-banner--error').count() === 1, `aviso de error con la pieza Banner (${tag})`)
      await page.locator('.cg-banner--error .cg-btn').click(); await page.waitForTimeout(400)
      report(await page.locator('.cg-banner--error').count() === 1, `«Reintentar carga» sigue mostrando el error y no rompe (${tag})`)
    }
    report(errors.length === 0, `sin errores de consola (${tag})`, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 })
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${MODE} ${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} fallas` : '\nTodo OK')
  process.exit(failures ? 1 : 0)
})()
