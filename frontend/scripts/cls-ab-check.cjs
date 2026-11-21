// CLS A/B intercalado (390 px, CPU×4) de una ruta con API simulada y latencia. Evidencia; no corre en CI.
// Uso: PLAYWRIGHT_MODULE=… PR=http://127.0.0.1:4351 MAIN=http://127.0.0.1:4352 SCENARIO=manifest|invite RUNS=10 node scripts/cls-ab-check.cjs
// SCENARIO=manifest → /admin/manifest como superadmin (E409-1); SCENARIO=invite → /login?mode=register&invite=… con invitación inválida (E392-2).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const PR = process.env.PR, MAIN = process.env.MAIN, SCENARIO = process.env.SCENARIO || 'manifest', RUNS = Number(process.env.RUNS || 10), DELAYS = (process.env.DELAY || '0,150,400,900').split(',').map(Number)
const txt = 'Texto sintético del manifiesto. '.repeat(30)
const versions = [3, 2, 1].map(n => ({ id: n, version: `v${n}`, isActive: n === 3, note: n === 3 ? 'Nota de ejemplo' : null, content: txt, contentEn: n === 3 ? txt : null, createdAt: '2026-11-0' + n + 'T00:00:00Z', uploader: { id: 1, name: 'Alejo', email: 'a@x.test' } }))
const SHAPE = process.env.SHAPE || 'active' // active | empty | error | noactive (E409-1: también sin versión vigente)
const ROUTE = SCENARIO === 'manifest' ? '/admin/manifest' : '/login?mode=register&invite=tokeninvalido0123456789'
async function once(browser, base, DELAY) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(([role, scenario]) => { window.__c = 0; if (scenario === 'manifest') { localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', role); localStorage.setItem('elevation_name', 'Admin Sintética') }
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, ['superadmin', SCENARIO])
  await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; await new Promise(r => setTimeout(r, DELAY))
    if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
    if (p === '/api/board/manifest') return SHAPE === 'error' ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.fulfill({ json: SHAPE === 'empty' ? [] : SHAPE === 'noactive' ? versions.map(v => ({ ...v, isActive: false })) : versions })
    if (/invit/i.test(p)) return route.fulfill({ status: 404, json: { code: 'invitation_invalid' } })
    return route.fulfill({ json: {} }) })
  await page.goto(base + ROUTE, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c }
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
;(async () => {
  const browser = await chromium.launch(); const pr = [], mn = []
  for (let i = 0; i < RUNS; i++) for (const d of DELAYS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(browser, base, d))
  await browser.close()
  const f = a => a.map(x => x.toFixed(3)).join(' ')
  console.log(`CLS ${SCENARIO} 390 CPU×4 ×${RUNS} intercaladas, latencias ${DELAYS.join('/')} ms\n  PR   mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)} [${f(pr)}]\n  main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)} [${f(mn)}]`)
  const ok = med(pr) <= 0.1 && Math.max(...pr) <= 0.1; console.log(ok ? 'OK    PR ≤ 0,1' : 'FALLA PR > 0,1'); process.exit(ok ? 0 : 1)
})()
