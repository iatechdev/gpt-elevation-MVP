// CLS A/B intercalado (390 px, CPU×4) de /app/chat con API simulada, DATOS SINTÉTICOS y latencias distintas. Evidencia; no corre en CI.
// Uso: PLAYWRIGHT_MODULE=… PR=http://127.0.0.1:4371 MAIN=http://127.0.0.1:4372 RUNS=6 node scripts/cls-ab-chat.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const PR = process.env.PR, MAIN = process.env.MAIN, RUNS = Number(process.env.RUNS || 6)
const DELAYS = [0, 150, 400, 900]
async function once(browser, base, delay) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); window.__c = 0
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) })
  await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; await new Promise(r => setTimeout(r, delay))
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (/usage/.test(p)) return route.fulfill({ json: { configured: true, limit: 100, used: 42, resetsAt: new Date(Date.now() + 864e5 * 5).toISOString() } })
    return route.fulfill({ json: route.request().method() === 'GET' ? [] : {} }) })
  await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c }
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1]
;(async () => { const b = await chromium.launch(); const pr = [], mn = []
  for (let i = 0; i < RUNS; i++) for (const d of DELAYS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(b, base, d))
  await b.close()
  console.log(`CLS chat 390 CPU×4 ×${RUNS} intercaladas, latencias ${DELAYS.join('/')} ms\n  PR   mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)}\n  main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)}`)
  const ok = Math.max(...pr) <= 0.1; console.log(ok ? 'OK    PR máx ≤ 0,1' : 'FALLA PR máx > 0,1'); process.exit(ok ? 0 : 1) })()
