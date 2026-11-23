// CLS de las páginas legales públicas (/privacidad y /terminos, ES y EN) a 390 px, con la API legal simulada como 404 (solo el texto del repo). Imprime cada salto: instante (ms), valor y
// los elementos que se movieron (y de qué a qué posición vertical). Evidencia de ES-336 (observación previa a F1: /privacidad EN ≈ 0,196, por encima del 0,1 del gate de páginas migradas).
// No corre en CI. Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5301 --strictPort   y luego
//   PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:5301 node scripts/legal-cls.cjs [--cpu 4]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5301'
const i = process.argv.indexOf('--cpu'); const CPU = i === -1 ? 1 : Number(process.argv[i + 1])
;(async () => {
  const browser = await chromium.launch()
  for (const [route, lang] of [['/privacidad', 'es'], ['/privacidad', 'en'], ['/terminos', 'es'], ['/terminos', 'en']]) {
    const ctx = await browser.newContext({ viewport: { width: Number(process.env.WIDTH || 390), height: 844 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    if (CPU > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }) }
    await page.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__shifts = []; window.__cls = 0
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map(s => ((s.node && (s.node.className || s.node.nodeName)) || '?').toString().slice(0, 24) + ' ' + Math.round(s.previousRect.y) + '→' + Math.round(s.currentRect.y)).join(' | ')]) } }).observe({ type: 'layout-shift', buffered: true }) }, lang)
    await page.route('**/api/**', route => route.fulfill({ status: 404, json: {} }))
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await page.locator('h1').first().waitFor(); await page.waitForTimeout(2500)
    console.log(`${route} ${lang}: CLS ${(await page.evaluate(() => window.__cls)).toFixed(4)}`, JSON.stringify(await page.evaluate(() => window.__shifts)))
    await ctx.close()
  }
  await browser.close()
})()
