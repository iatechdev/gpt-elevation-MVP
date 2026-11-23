// [QA-Claude-5] PR #421 (ES-303 PR B): CLS A/B INTERCALADO PR vs main (merge-base), CPU×4, backend REAL con latencia añadida a las respuestas de /api/me/review-shares y /api/reviewer/invites. Datos sintéticos.
// Uso: PLAYWRIGHT_MODULE=... PR=http://127.0.0.1:4402 MAIN=http://127.0.0.1:4403 API=... RUNS=4 DELAYS=150,900 WIDTHS=390,1360,320 node qa/qa5-421-cls.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const PR = process.env.PR, MAIN = process.env.MAIN, RUNS = Number(process.env.RUNS || 4), DELAYS = (process.env.DELAYS || '150,900').split(',').map(Number), WIDTHS = (process.env.WIDTHS || '390,1360,320').split(',').map(Number)
const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', 'utf8')).users
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] }
async function once(br, base, { width, user, delay, lang = 'es', scheme = 'light' }) {
  const ctx = await br.newContext({ viewport: { width, height: Number(process.env.HEIGHT || 800) }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const u = U[user]; await page.addInitScript(([tk, rl, name, l]) => { window.__c = 0; localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', name); localStorage.setItem('elv_lang', l)
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [u.token, u.role, u.name, lang])
  await page.route(/\/api\/(me\/review-shares|reviewer\/invites|professional-reviews|me\/reviews|evidence)/, async (route) => { await new Promise((r) => setTimeout(r, delay)); return route.continue() })
  await page.goto(base + '/app/professional-reviews', { waitUntil: 'load' }); await page.waitForTimeout(1800 + delay)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c
}
;(async () => {
  const br = await chromium.launch(); let bad = 0
  for (const width of WIDTHS) for (const user of ['pA', 'pB', 'rev1']) for (const [lang, scheme] of [['es', 'light'], ['en', 'dark']]) {
    const pr = [], mn = []
    for (let i = 0; i < RUNS; i++) for (const d of DELAYS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(br, base, { width, user, delay: d, lang, scheme }))
    const okPR = Math.max(...pr) <= 0.1; if (!okPR) bad++
    console.log(`${okPR ? 'OK   ' : 'FALLA'} ${width}px ${user} ${lang}/${scheme}: PR mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)} | main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)} (n=${pr.length} c/u)`)
  }
  await br.close(); console.log(bad ? `FALLAN ${bad}` : 'CLS del PR ≤ 0,1 en todas las combinaciones'); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
