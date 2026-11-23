// ES-402: CLS A/B intercalado de /app/onboarding (CPU×4) con API simulada, DATOS SINTÉTICOS y latencias distintas del contexto. Evidencia; no corre en CI.
// Uso: PLAYWRIGHT_MODULE=… PR=http://127.0.0.1:PUERTO MAIN=http://127.0.0.1:PUERTO RUNS=3 node scripts/cls-ab-onboarding.cjs   (WIDTHS=390,320,1360 LANGS=es,en SCHEMES=light,dark)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const PR = process.env.PR, MAIN = process.env.MAIN, RUNS = Number(process.env.RUNS || 3)
const WIDTHS = (process.env.WIDTHS || '390,320,1360').split(',').map(Number), LANGS = (process.env.LANGS || 'es,en').split(','), SCHEMES = (process.env.SCHEMES || 'light,dark').split(',')
const DELAYS = [0, 200, 600, 1200]
const empty = { preferredLanguage: null, residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }
async function once(browser, base, w, lang, scheme, delay) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(([l, sc]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', sc); window.__c = 0
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang, scheme])
  await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname
    if (p === '/api/user/context') { await new Promise(r => setTimeout(r, delay)); return route.fulfill({ json: { schemaVersion: 2, version: 0, context: null, savedAt: null, completedAt: null } }) }
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: false } })
    return route.fulfill({ json: [] }) })
  void empty
  await page.goto(base + '/app/onboarding', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c }
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1]
;(async () => { const b = await chromium.launch(); let bad = 0
  for (const w of WIDTHS) for (const lang of LANGS) for (const scheme of SCHEMES) { const pr = [], mn = []
    for (let i = 0; i < RUNS; i++) for (const d of DELAYS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(b, base, w, lang, scheme, d))
    const ok = Math.max(...pr) <= 0.1; if (!ok) bad++
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${w}px ${lang} ${scheme}: PR mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)} · main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)}`) }
  await b.close(); console.log(bad ? `${bad} combinación(es) del PR > 0,1` : 'PR ≤ 0,1 en todas'); process.exit(bad ? 1 : 0) })()
