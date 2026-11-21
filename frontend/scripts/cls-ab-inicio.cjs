// CLS A/B intercalado (390 px, CPU×4) de /app/dashboard (Inicio de persona) con API simulada, DATOS SINTÉTICOS y latencias distintas por lectura (llegan escalonadas). Evidencia; no corre en CI.
// Uso: PLAYWRIGHT_MODULE=… PR=http://127.0.0.1:4361 MAIN=http://127.0.0.1:4362 RUNS=6 node scripts/cls-ab-inicio.cjs   (SCENE=vacio|datos|errores)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const WIDTH = Number(process.env.WIDTH || 390), CHECKIN = process.env.CHECKIN !== 'no' // WIDTH=1280 CHECKIN=no: sin registro de hoy (ES-369, QA-424-3)
const PR = process.env.PR, MAIN = process.env.MAIN, RUNS = Number(process.env.RUNS || 6), SCENE = process.env.SCENE || 'datos'
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
const logs = SCENE === 'datos' || SCENE === 'completo' ? [0, 1, 2, 4, 5].map((n, i) => ({ id: i + 1, date: day(n), checkin_mood: 2 + (i % 3), checkout_mood: 3 + (i % 2) })) : []
const now = Date.now()
const FULL = { upcoming: { id: 1, scheduledAt: new Date(now + 86400000 * 2).toISOString(), duration: 45, meetingUrl: null, status: 'scheduled', therapistName: 'Ana (ejemplo)', therapistEmail: 'x@example.com' }, therapist: { id: 7 },
  recs: [['habit', 'Texto de ejemplo uno'], ['reflection', 'Texto de ejemplo dos'], ['mindfulness', 'Texto de ejemplo tres'], ['resource', 'Texto de ejemplo cuatro']].map(([category, content], i) => ({ id: i + 1, category, content, generatedAt: new Date().toISOString() })),
  plan: { id: 2, slug: 'plus', name_es: 'Plus (ejemplo)', name_en: 'Plus (example)', price: 19, currency: 'USD', period: 'month', features_es: ['Característica uno (ejemplo)', 'Característica dos (ejemplo)', 'Tres', 'Cuatro'], features_en: ['a', 'b', 'c', 'd'], isHighlighted: true }, limits: { chatMessagesDay: 100, sessionsMonth: -1, canAccessProgress: true, canMatchTherapist: true } }
const FULLSCENE = SCENE === 'completo'
const SETS = [[0, 0, 0, 0, 0], [100, 300, 200, 600, 400], [900, 100, 500, 200, 700], [300, 900, 100, 400, 800]]
async function once(browser, base, delays) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(ck => { localStorage.setItem('elevation_token', 'h.' + btoa(JSON.stringify({ id: 7 })) + '.s'); localStorage.setItem('elevation_role', 'user'); if (ck) localStorage.setItem('elevation_checkin_date', new Date().toDateString()) // marca anterior (main)
    if (ck) localStorage.setItem('elevation_checkin', JSON.stringify({ id: '7', day: new Date().toISOString().slice(0, 10) })); window.__c = 0
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }, CHECKIN)
  const order = ['/api/user/progress', '/api/sessions/user/upcoming', '/api/sessions/user/my-therapist', '/api/recommendations', '/api/user/plan/me']
  await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; const i = order.indexOf(p); await new Promise(r => setTimeout(r, i >= 0 ? delays[i] : 0))
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (SCENE === 'errores' && i >= 0) return route.fulfill({ status: 500, json: { error: 'x' } })
    if (p === order[0]) return route.fulfill({ json: { stats: null, moodLogs: logs, ratings: [], recommendations: [] } })
    if (p === order[1]) return route.fulfill({ json: { session: FULLSCENE ? FULL.upcoming : null } })
    if (p === order[2]) return route.fulfill({ json: { therapist: FULLSCENE ? FULL.therapist : null } })
    if (p === order[3]) return route.fulfill({ json: FULLSCENE ? FULL.recs : [] })
    if (p === order[4]) return route.fulfill({ json: { plan: FULLSCENE ? FULL.plan : null, limits: FULLSCENE ? FULL.limits : null } })
    return route.fulfill({ json: {} }) })
  await page.goto(base + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
  const c = await page.evaluate(() => window.__c); await ctx.close(); return c }
const med = a => [...a].sort((x, y) => x - y)[a.length >> 1]
;(async () => { const b = await chromium.launch(); const pr = [], mn = []
  for (let i = 0; i < RUNS; i++) for (const d of SETS) for (const [arr, base] of [[pr, PR], [mn, MAIN]]) arr.push(await once(b, base, d))
  await b.close(); const f = a => a.map(x => x.toFixed(3)).join(' ')
  console.log(`CLS Inicio ${SCENE} ${WIDTH} px CPU×4${CHECKIN ? '' : ' sin registro de hoy'} ×${RUNS} intercaladas\n  PR   mediana ${med(pr).toFixed(3)} máx ${Math.max(...pr).toFixed(3)}\n  main mediana ${med(mn).toFixed(3)} máx ${Math.max(...mn).toFixed(3)}`)
  const ok = Math.max(...pr) <= 0.1; console.log(ok ? 'OK    PR máx ≤ 0,1' : 'FALLA PR máx > 0,1'); process.exit(ok ? 0 : 1) })()
