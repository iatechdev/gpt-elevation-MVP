// ES-310 (PR 1): diagnóstico y medición del CLS del marco de Administración a 390 px con CPU×4 (evidencia; no corre en CI).
// Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4315 node scripts/es310-marco-cls.cjs [rutas separadas por coma]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4315'
const ROUTES = (process.argv[2] || '/admin/dashboard,/admin/metrics,/admin/prompts,/admin/route-catalog,/admin/users').split(',')
let failures = 0
;(async () => {
  const browser = await chromium.launch()
  for (const scheme of ['light', 'dark']) for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.addInitScript(() => {
      localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', 'es')
      window.__cls = 0; window.__shifts = []
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value
        window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(3), fonts: [...document.fonts].filter(f => f.status === 'loaded').length, s: (e.sources || []).map(a => `${a.node?.nodeName}.${String(a.node?.className || '').slice(0, 24)} ${a.previousRect.y | 0}+${a.previousRect.height | 0} -> ${a.currentRect.y | 0}+${a.currentRect.height | 0}`) }) } }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
      if (/usuarios$|pending$|admin$|prompts|route-catalog|catalog/.test(p)) return route.fulfill({ json: [] })
      return route.fulfill({ json: {} }) })
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(BASE + (route.startsWith('/') ? route : '/' + route), { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
    const out = await page.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts, theme: getComputedStyle(document.querySelector('.cg-frame') || document.body).backgroundColor, bodyBg: getComputedStyle(document.body).backgroundColor, mainClass: (document.querySelector('main') || document.body).className, h1: !!document.querySelector('h1') }))
    const ok = out.cls <= 0.1; if (!ok) failures++
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${scheme} ${route} CLS ${out.cls.toFixed(3)} main[${out.mainClass}] bg ${out.theme}`)
    if (!ok) for (const s of out.shifts) console.log('   ', JSON.stringify(s))
    await ctx.close()
  }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
