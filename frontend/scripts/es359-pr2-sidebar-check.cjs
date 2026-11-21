// ES-359 (PR2): barra lateral de persona. Chromium, API simulada. Evidencia; no corre en CI. Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… PR=http://127.0.0.1:4341 MAIN=http://127.0.0.1:4342 node scripts/es359-pr2-sidebar-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const PR = process.env.PR, MAIN = process.env.MAIN; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
let failures = 0; const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
const ROUTES = ['/app/dashboard', '/app/skill-map', '/app/progress', '/app/my-therapist']
async function open(browser, base, route, { width, lang = 'es', scheme = 'light', cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Marta'); localStorage.setItem('elv_lang', l); window.__c = 0
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
    if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/user/context') return r.fulfill({ json: { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: '2026-11-01T10:00:00.000Z' } })
    return r.fulfill({ json: [] }) })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(base + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(700); return { ctx, page } }
;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 1024, 901, 900, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, PR, '/app/skill-map', { width, lang, scheme }); await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); const bad = axe.violations.map(v => `${v.id} x${v.nodes.length}`)
    const m = await page.evaluate(() => { const side = document.querySelector('.cg-side--groups'); const vis = side && getComputedStyle(side).display !== 'none'
      const hdrNav = document.querySelector('.cg-header > .cg-nav'); return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, side: !!vis, groups: side ? side.querySelectorAll('.cg-sidegroup').length : 0, links: side ? side.querySelectorAll('a').length : 0,
        hdrNavShown: hdrNav ? getComputedStyle(hdrNav).display !== 'none' : false, current: side ? side.querySelectorAll('a[aria-current="page"]').length : 0, small: side ? [...side.querySelectorAll('a')].filter(a => a.getBoundingClientRect().height > 0 && a.getBoundingClientRect().height < 39.5).length : 0 } })
    const wide = width >= 901
    const ok = bad.length === 0 && m.scrollW <= m.innerW && m.side === wide && m.hdrNavShown === !wide && (!wide || (m.groups === 5 && m.links === 17 && m.current === 1 && m.small === 0))
    log(ok, `skill-map ${width} ${lang} ${scheme}${ok ? '' : ` axe[${bad}] ${JSON.stringify(m)}`}`); await ctx.close() }
  { // teclado: Tab llega a los enlaces de la barra y el foco es visible; Enter navega
    const { ctx, page } = await open(browser, PR, '/app/dashboard', { width: 1360 }); const seen = []
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => { const e = document.activeElement; return e && e.closest('.cg-side--groups') ? (e.textContent || '').trim() : '' })) }
    const inSide = seen.filter(Boolean); log(inSide.length >= 15 && inSide.includes('Ejercicios opcionales') && inSide.includes('Brújula profesional') && inSide.includes('Catálogo de rutas'), `teclado: Tab recorre la barra (${inSide.length} enlaces, incluye las 3 entradas nuevas)`)
    await page.getByRole('link', { name: 'Catálogo de rutas', exact: true }).first().click(); await page.waitForTimeout(500); log(new URL(page.url()).pathname === '/app/route-catalog', `Enter/clic navega a ${new URL(page.url()).pathname}`); await ctx.close() }
  { // contenido útil: área de <main> a 1360 PR vs main
    const a = await open(browser, PR, '/app/skill-map', { width: 1360 }), b = await open(browser, MAIN, '/app/skill-map', { width: 1360 })
    const wa = await a.page.evaluate(() => document.querySelector('main').getBoundingClientRect().width), wb = await b.page.evaluate(() => document.querySelector('main').getBoundingClientRect().width)
    log(wa >= wb * 0.8, `contenido útil a 1360 px: main ${wa | 0} px (PR) vs ${wb | 0} px (main) = ${(wa / wb * 100).toFixed(0)} % (límite ≥ 80 %)`); await a.ctx.close(); await b.ctx.close() }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
  for (const route of ROUTES) { const pr = [], mn = []
    for (let i = 0; i < 10; i++) { for (const [arr, base] of [[pr, PR], [mn, MAIN]]) { const { ctx, page } = await open(browser, base, route, { width: 390, cpu: 4 }); await page.waitForTimeout(900); arr.push(await page.evaluate(() => window.__c)); await ctx.close() } }
    log(med(pr) <= 0.1 && Math.max(...pr) <= 0.1, `CLS ${route} 390 CPU×4, 10 corridas intercaladas: PR mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)} · main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)}`) }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
