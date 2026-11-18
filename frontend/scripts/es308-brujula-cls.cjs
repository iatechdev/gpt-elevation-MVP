// ES-308 (PR 3): CLS de /app/compass a 390 px con CPU x4 (API simulada, datos sintéticos) y desborde a 320/390. Evidencia del PR; no corre en CI.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5299 --strictPort   y luego
//   PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:5299 node scripts/es308-brujula-cls.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5299'
;(async () => {
  const browser = await chromium.launch(); const results = []; let bad = 0
  const active = { version: 1, status: 'active', approvedAt: '2026-11-01T12:00:00.000Z', revokedAt: null, needsReview: false, fields: [{ key: 'interests', text: 'Contexto sintético', origin: { type: 'direct' } }] }
  for (let run = 0; run < 5; run++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
    await page.route('**/api/session', r => r.fulfill({ json: { role: 'user', onboardingCompleted: true } }))
    await page.route('**/api/career-context**', r => r.fulfill({ json: { active, versions: [active] } }))
    await page.route('**/api/**', r => r.fallback())
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(BASE + '/app/compass', { waitUntil: 'domcontentloaded' }); await page.getByRole('heading', { name: 'Nuevo contexto directo' }).waitFor(); await page.waitForTimeout(1200)
    const cls = await page.evaluate(() => window.__cls); results.push(cls); if (cls > 0.1) bad++
    if (run === 0) for (const width of [320, 390]) { await page.setViewportSize({ width, height: 800 }); const ok = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth); console.log(`desborde ${width}px:`, ok ? 'sin desborde' : 'DESBORDA'); if (!ok) bad++ }
    await ctx.close()
  }
  console.log('CLS por corrida:', results.map(v => v.toFixed(3)).join(' ')); await browser.close(); console.log(bad ? 'FALLA' : 'TODO OK'); process.exit(bad ? 1 : 0)
})()
