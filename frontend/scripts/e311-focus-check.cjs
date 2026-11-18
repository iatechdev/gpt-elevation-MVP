// E311-1: «Reintentar» en la LISTA del catálogo de rutas devuelve el foco al título. Chromium, API simulada (falla una vez, luego responde). Sin datos reales.
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4113 --strictPort  → PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4113 node scripts/e311-focus-check.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE || 'http://127.0.0.1:4113'
;(async () => {
  const browser = await chromium.launch(); let failed = 0
  for (const lang of ['es', 'en']) {
    const page = await (await browser.newContext({ viewport: { width: 1000, height: 800 } })).newPage(); let calls = 0
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p.includes('route-catalog')) { calls += 1; return calls === 1 ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.fulfill({ json: { version: 1, publishedAt: '2026-11-01T00:00:00Z', contexts: [], sources: [], roles: [], offers: [], resources: [] } }) }
      return route.fulfill({ json: {} }) })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.goto(BASE + '/app/route-catalog', { waitUntil: 'networkidle' })
    const retry = page.locator('.cgp-notice button'); await retry.waitFor({ timeout: 10000 }); await retry.click(); await page.waitForTimeout(800)
    const active = await page.evaluate(() => ({ tag: document.activeElement && document.activeElement.tagName, cls: document.activeElement && document.activeElement.className }))
    const ok = active.tag === 'H1' && /pg-title/.test(active.cls); if (!ok) failed++
    console.log((ok ? 'OK    ' : 'FALLA ') + lang + ': foco tras «Reintentar» → ' + active.tag + ' ' + active.cls)
  }
  await browser.close(); process.exit(failed ? 1 : 0)
})()
