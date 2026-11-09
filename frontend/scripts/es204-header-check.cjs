// ES-204: el encabezado del panel del terapeuta no tapa el título «Mis pacientes» y no repite el rol (320–1440 px, ES/EN). No corre en CI; evidencia del PR.
// API simulada: /api/session devuelve rol terapeuta y el resto responde 200 con lista vacía.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [320, 360, 390, 640, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 } }); const page = await ctx.newPage()
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname
      return route.fulfill({ status: 200, contentType: 'application/json', body: p === '/api/session' ? '{"role":"therapist","onboardingCompleted":true}' : p.endsWith('/alerts') ? '{"inactivePatients":[],"notableProgress":[]}' : p.endsWith('/prompt') ? '{}' : '[]' })
    })
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789'); localStorage.setItem('elevation_name', 'Synthetic Therapist') }, [lang])
    await page.goto(BASE + '/therapist/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
    const m = await page.evaluate(() => {
      const fixedEls = [...document.querySelectorAll('header, [class*=header], [class*=topbar]')].filter(e => ['fixed', 'sticky'].includes(getComputedStyle(e).position))
      const bottom = Math.max(0, ...fixedEls.map(e => e.getBoundingClientRect().bottom))
      const h1 = document.querySelector('h1')
      const text = document.body.innerText
      const roleRepeats = (text.match(/(Terapeuta|Therapist|Profesional|Professional)\s*[·•|-]?\s*\1/gi) || []).length
      return { bottom: Math.round(bottom), h1Top: h1 ? Math.round(h1.getBoundingClientRect().top) : null, h1: h1 ? h1.textContent.trim().slice(0, 40) : null, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, roleRepeats }
    })
    const ok = m.h1Top !== null && m.h1Top >= m.bottom && m.overflow <= 0 && m.roleRepeats === 0
    if (!ok) failures++
    console.log(`${ok ? 'OK   ' : 'FALLA'} ${lang} ${width}px encabezado=${m.bottom} h1Top=${m.h1Top} «${m.h1}» desborde=${m.overflow} rolRepetido=${m.roleRepeats}`)
    await ctx.close()
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
