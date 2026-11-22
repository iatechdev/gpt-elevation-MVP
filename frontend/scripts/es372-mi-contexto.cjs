// ES-372 (O428-1): «Mi contexto» solo para el rol user en Mi panel. Chromium, API simulada, DATOS SINTÉTICOS. Evidencia (no corre en CI).
// Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4374 node scripts/es372-mi-contexto.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE || 'http://127.0.0.1:4374'
const tok = id => 'h.' + Buffer.from(JSON.stringify({ id, role: 'x' })).toString('base64url') + '.s'
let failures = 0, total = 0; const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
;(async () => {
  const browser = await chromium.launch()
  for (const role of ['user', 'superadmin', 'admin']) for (const width of [390, 1360]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(([t, r]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', 'es') }, [tok(7), role])
    await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname; if (p === '/api/session') return r.fulfill({ json: { role, onboardingCompleted: true } }); if (p === '/api/user/progress') return r.fulfill({ json: { stats: null, moodLogs: [], ratings: [], recommendations: [], timeZone: 'America/Bogota' } })
      if (p.includes('upcoming')) return r.fulfill({ json: { session: null } }); if (p.includes('my-therapist')) return r.fulfill({ json: { therapist: null } }); if (p.includes('plan/me')) return r.fulfill({ json: { plan: null, limits: null } }); return r.fulfill({ json: [] }) })
    await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(500)
    const onDashboard = await page.locator('.pc-links').count() > 0; const link = await page.locator('a.context-dashboard-link').count()
    if (role === 'user') { check(onDashboard && link === 1, `${role} ${width}px: ve «Mi contexto» (${link})`); check(await page.locator('a.context-dashboard-link').getAttribute('href') === '/app/onboarding', `${role} ${width}px: lleva a /app/onboarding`) }
    else { check(link === 0, `${role} ${width}px: NO hay enlace «Mi contexto» (${link}; panel ${onDashboard})`); check(await page.locator('a[href="/app/onboarding"]').count() === 0, `${role} ${width}px: ningún enlace a /app/onboarding`) }
    check(errors.length === 0, `${role} ${width}px: sin errores de JavaScript ${errors}`); await ctx.close()
  }
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures ? 1 : 0)
})()
