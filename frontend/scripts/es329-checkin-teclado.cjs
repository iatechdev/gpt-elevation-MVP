// E322-1: la escala de ánimo de Inicio NO registra al mover el foco con flechas; solo el botón «Registrar» envía el check-in (Chromium, API simulada, datos sintéticos).
// Uso: PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:4113 node scripts/es329-checkin-teclado.cjs   (con vite preview sirviendo dist)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); const BASE = process.env.BASE || 'http://127.0.0.1:4113'
;(async () => {
  const browser = await chromium.launch(); let fails = 0
  for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } }); const page = await ctx.newPage(); const posts = []
    await page.route('**/api/**', route => { const r = route.request(), p = new URL(r.url()).pathname
      if (r.method() === 'POST' && p === '/api/mood/checkin') { posts.push(r.postData()); return route.fulfill({ json: { ok: true } }) }
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/user/progress') return route.fulfill({ json: { stats: null, moodLogs: [], ratings: [], recommendations: [] } })
      return route.fulfill({ json: {} }) })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' })
    const btn = page.getByRole('button', { name: /Registrar mi estado|Log my state/ })
    const first = page.getByRole('radio').first(); await first.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight') // recorre 1→5 con flechas (cualquier valor 3–5 debe ser alcanzable)
    await page.keyboard.press('Space'); await page.waitForTimeout(300)
    const sent1 = posts.length, disabled = await btn.isDisabled(), checked = await page.getByRole('radio', { checked: true }).getAttribute('value')
    await page.keyboard.press('Tab'); const onBtn = await btn.evaluate(b => b === document.activeElement); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
    const ok = sent1 === 0 && !disabled && checked === '5' && onBtn && posts.length === 1 && /"mood":5/.test(posts[0])
    if (!ok) fails++
    console.log(`${ok ? 'OK    ' : 'FALLA '}${lang}: POST tras flechas=${sent1} (esperado 0) · elegido=${checked} · botón habilitado=${!disabled} · Tab→botón=${onBtn} · POST tras Enter=${posts.length} ${posts[0] || ''}`)
    await ctx.close()
  }
  await browser.close(); process.exit(fails ? 1 : 0)
})()
