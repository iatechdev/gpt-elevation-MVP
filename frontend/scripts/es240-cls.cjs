// ES-240 (E358-1): CLS de /app/my-therapist con profesional a 390 px y CPU ×4. Perfil, sesiones y permiso de compartir llegan por separado (con retrasos distintos y realistas); sin reservar
// el espacio, las tarjetas aparecían una a una y empujaban a las demás. Chromium, API simulada, datos sintéticos. No corre en CI; evidencia del PR.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5299 --strictPort   y luego
//   PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:5299 node scripts/es240-cls.cjs [--runs 7] [--order sessions-first]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5299'
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? fallback : process.argv[i + 1] }
const RUNS = Number(arg('runs', 7)); const ORDER = arg('order', 'profile-first')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const future = mins => new Date(Date.now() + mins * 60000).toISOString()
const data = {
  therapist: { id: 9, name: 'Profesional Sintético', email: 'pro@example.test', profile: { specialties: 'Orientación en transiciones', approach: 'Reflexivo', languages: 'Español, inglés', bio: 'Acompaño pasos pequeños con calma y con tiempo, sin prisa y sin promesas.' } },
  upcomingSessions: [{ id: 1, scheduledAt: future(600), duration: 50, meetingUrl: 'https://example.test/room', status: 'scheduled' }, { id: 2, scheduledAt: future(2000), duration: 50, meetingUrl: 'https://example.test/room2', status: 'scheduled' }],
  pastSessions: [{ id: 5, scheduledAt: '2026-10-20T15:00:00.000Z', patientMoodAfter: 4, status: 'completed' }, { id: 6, scheduledAt: '2026-10-10T15:00:00.000Z', patientMoodAfter: 1, status: 'completed' }],
}
;(async () => {
  const browser = await chromium.launch(); const values = []; const detail = []
  const delays = ORDER === 'sessions-first' ? { profile: 700, sessions: 250, consents: 900 } : { profile: 250, sessions: 700, consents: 450 }
  for (let run = 0; run < RUNS; run += 1) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'es-CO' }); const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; window.__shifts = []
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map(s => (s.node && (s.node.id || s.node.className || s.node.nodeName) || '?').toString().slice(0, 30)).join('|')]) } }).observe({ type: 'layout-shift', buffered: true }) })
    await page.route('**/api/**', async route => {
      const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/sessions/user/my-therapist/profile') { await sleep(delays.profile); return route.fulfill({ json: { therapist: data.therapist } }) }
      if (p === '/api/sessions/user/my-therapist/sessions') { await sleep(delays.sessions); return route.fulfill({ json: { upcomingSessions: data.upcomingSessions, pastSessions: data.pastSessions } }) }
      if (p === '/api/sessions/user/my-therapist') { await sleep(delays.sessions); return route.fulfill({ json: data }) } // versión anterior (una sola petición)
      if (p === '/api/consents') { await sleep(delays.consents); return route.fulfill({ json: { consents: [{ purpose: 'therapist_sharing', status: 'granted', applicable: true }] } }) }
      return route.fulfill({ json: {} })
    })
    await page.goto(BASE + '/app/my-therapist', { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: /Próximas sesiones|Upcoming sessions/ }).waitFor({ timeout: 30000 }); await sleep(2500)
    values.push(await page.evaluate(() => window.__cls)); detail.push(await page.evaluate(() => window.__shifts))
    if (run === 0) console.log('alturas (px):', JSON.stringify(await page.evaluate(() => Object.fromEntries(['mp-profile', 'mp-upcoming', 'mp-past'].map(id => [id, Math.round(document.getElementById(id)?.closest('section')?.getBoundingClientRect().height ?? 0)])))))
    await ctx.close()
  }
  const sorted = [...values].sort((a, b) => a - b)
  console.log(`CLS (${ORDER}) por corrida:`, values.map(v => v.toFixed(4)).join(' '), '| mediana', sorted[Math.floor(sorted.length / 2)].toFixed(4), '| máx', sorted[sorted.length - 1].toFixed(4))
  if (process.argv.includes('--detail')) console.log(JSON.stringify(detail[0]))
  await browser.close()
})()
