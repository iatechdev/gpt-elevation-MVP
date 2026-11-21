// ES-359 (PR5): CLS a 390 px con CPU×4, corridas INTERCALADAS entre dos builds (PR y main), pantallas de los roles con API simulada (DATOS SINTÉTICOS). Evidencia (no corre en CI).
// Uso: PLAYWRIGHT_MODULE=<playwright> PR=http://127.0.0.1:4309 MAIN=http://127.0.0.1:4310 [RUNS=10] node scripts/es359-marcos-cls.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const RUNS = Number(process.env.RUNS || 10)
const CASES = [
  ['profesional vacío', 'therapist', '/therapist/dashboard', 'empty'], ['profesional con datos', 'therapist', '/therapist/dashboard', 'data'],
  ['administración (usuarios)', 'admin', '/admin/users', 'empty'], ['Panel de administración vacío', 'admin', '/admin/dashboard', 'empty'], ['Panel de administración con datos', 'admin', '/admin/dashboard', 'data'], ['Panel de superadministración con datos', 'superadmin', '/admin/dashboard', 'data'], ['Mis datos (profesional)', 'therapist', '/app/data', 'empty'], ['Mis datos (junta)', 'board', '/app/data', 'empty'], ['Mis datos (persona)', 'user', '/app/data', 'empty'],
]
const iso = d => new Date(Date.now() - d * 86400000).toISOString()
const people = [1, 2, 3, 4].map(n => ({ id: 100 + n, name: `Persona Sintética ${n}`, ordinal: n, email: `p${n}@example.test`, active: true, createdAt: iso(60), sharing: true, lastMood: { checkin_mood: 4, checkout_mood: 5, date: iso(n) }, moodTrend: 'neutral', avgRating: 4, totalSessions: 3, sessionsThisWeek: 1, trend: 'stable' }))
const upcoming = [1, 2].map(n => ({ id: 50 + n, patientId: 100 + n, scheduledAt: new Date(Date.now() + n * 3600000).toISOString(), duration: 50, status: 'scheduled', patientName: `Persona Sintética ${n}`, phase: 'upcoming' }))
async function run(browser, base, [, role, path, data]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(r => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, role)
  await page.route('**/api/**', async r => { const p = new URL(r.request().url()).pathname; await new Promise(x => setTimeout(x, 80)); const full = data === 'data'
    if (p === '/api/session') return r.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/therapist/pacientes') return r.fulfill({ json: full ? people : [] }); if (p === '/api/sessions/therapist/upcoming') return r.fulfill({ json: full ? upcoming : [] })
    if (p === '/api/therapist/alerts') return r.fulfill({ json: { inactivePatients: [], notableProgress: [] } }); if (p === '/api/therapist/prompt') return r.fulfill({ json: { hasPrompt: false, content: '', active: null, pending: null, rejected: null } })
    if (p === '/api/admin/metrics') return r.fulfill({ json: { totalUsers: full ? 12 : 0, activeUsers: full ? 9 : 0, totalTherapists: full ? 3 : 0, totalSessions: full ? 20 : 0, avgMood: full ? 4 : null, avgRating: full ? 4.5 : null, activeThisWeek: full ? 6 : 0, days30: Array.from({ length: 30 }, (_, i) => ({ date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10), count: full ? i % 4 : 0 })), total30: full ? 45 : 0, max30: full ? { date: iso(2).slice(0, 10), count: 3 } : null, dailyAverage30: full ? 1.5 : 0, range: { start: iso(29).slice(0, 10), end: iso(0).slice(0, 10), timeZone: 'America/Bogota' }, topTherapists: full ? [{ id: 1, name: 'Profesional Sintético', patientCount: 4, avgRating: 4.5 }] : [] } })
    if (p === '/api/admin/usuarios/alerts') return r.fulfill({ json: { sections: { guides: { status: 'ok', count: full ? 1 : 0, items: full ? [{ id: 1, therapistName: 'Profesional Sintético', version: 2, createdAt: iso(3) }] : [] }, professionalsIncomplete: { status: 'ok', count: full ? 2 : 0 }, manifest: { status: 'ok', version: 'v1', date: iso(30) } } } })
    return r.fulfill({ json: [] }) })
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); const cls = await page.evaluate(() => window.__cls); await ctx.close(); return cls
}
;(async () => {
  const browser = await chromium.launch(); const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]
  for (const c of CASES) { const pr = [], main = []
    for (let i = 0; i < RUNS; i++) { pr.push(await run(browser, process.env.PR, c)); main.push(await run(browser, process.env.MAIN, c)) }
    console.log(`${c[0].padEnd(26)} PR mediana ${med(pr).toFixed(4)} máx ${Math.max(...pr).toFixed(4)}   main mediana ${med(main).toFixed(4)} máx ${Math.max(...main).toFixed(4)}`) }
  await browser.close()
})()
