// ES-381: CLS de /manifiesto a 1024/1280/1360 px (y 320/390/768 con WIDTHS), CPU ×4, manifiesto sintético simulado (14 párrafos ES/EN), fuentes .woff2 con retraso 0 y 600 ms. Sin A/B interno: se ejecuta contra
// la compilación a medir (main y PR por separado). No corre en CI. Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4513 [WIDTHS=1024,1280,1360] node scripts/es381-check.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE; const RUNS = 4
const para = i => `Principio ${i + 1}. Elevation acompaña la reflexión personal y no sustituye la atención psicológica, médica ni de emergencia; las personas deciden qué comparten, con quién y por cuánto tiempo, y nadie interpreta por ellas lo que viven en su trabajo ni en su vida cotidiana.`
const paraEn = i => `Principle ${i + 1}. Elevation supports personal reflection and does not replace psychological, medical or emergency care; people decide what they share, with whom and for how long, and nobody interprets for them what they live at work or in daily life.`
const body = { version: 'v3', content: Array.from({ length: 14 }, (_, i) => para(i)).join('\n\n'), contentEn: Array.from({ length: 14 }, (_, i) => paraEn(i)).join('\n\n'), publishedAt: '2026-11-01T00:00:00Z' }
;(async () => {
  const b = await chromium.launch(); let worst = 0
  for (const delay of [0, 600]) for (const w of (process.env.WIDTHS || '1024,1280,1360').split(',').map(Number)) for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const vals = []
    for (let i = 0; i < RUNS; i++) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage()
      const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(l => { localStorage.setItem('elv_lang', l); window.__c = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
      await page.route('**/api/manifest/active', r => r.fulfill({ json: body }))
      await page.route('**/api/**', r => r.request().url().includes('/manifest/active') ? r.fallback() : r.fulfill({ status: 404, json: {} }))
      if (delay) await page.route('**/*.woff2', async r => { await new Promise(s => setTimeout(s, delay)); r.continue() })
      await page.goto(BASE + '/manifiesto', { waitUntil: 'domcontentloaded' }); await page.locator('.manifesto__body').waitFor(); await page.waitForTimeout(2500)
      vals.push(await page.evaluate(() => window.__c)); await ctx.close()
    }
    worst = Math.max(worst, ...vals)
    console.log(`retraso ${String(delay).padStart(3)} ms · ${w} px · ${lang} ${scheme}: máx ${Math.max(...vals).toFixed(4)} med ${vals.sort((a, b) => a - b)[vals.length >> 1].toFixed(4)}`)
  }
  console.log('PEOR', worst.toFixed(4)); await b.close()
})()
