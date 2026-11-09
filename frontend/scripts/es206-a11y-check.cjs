// ES-206: h1 por pantalla y objetivos táctiles ≥ 24 px a 390 px, ES/EN. No corre en CI; evidencia del PR.
// API simulada: /api/session devuelve el rol; el resto responde 200 con lista vacía (objetos mínimos donde la pantalla los exige).
// Uso: `npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<ruta a playwright> BASE=http://localhost:5299 node scripts/es206-a11y-check.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://localhost:5299'
const SCREENS = [
  ['user', '/app/dashboard'], ['user', '/app/chat'], ['user', '/app/next-step'],
  ['admin', '/admin/users'], ['admin', '/admin/content'], ['admin', '/admin/prompts'],
  ['therapist', '/therapist/dashboard'],
]
const MIN = 24
let failures = 0

;(async () => {
  const browser = await chromium.launch()
  for (const [role, path] of SCREENS) for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const page = await ctx.newPage()
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname
      const body = p === '/api/session' ? JSON.stringify({ role, onboardingCompleted: true }) : p.endsWith('/alerts') ? '{"inactivePatients":[],"notableProgress":[]}' : '[]'
      return route.fulfill({ status: 200, contentType: 'application/json', body })
    })
    await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789'); localStorage.setItem('elevation_name', 'Synthetic QA') }, [lang])
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
      const r = await page.evaluate(min => {
        const h1 = document.querySelectorAll('h1').length
        const small = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch]')]
          .filter(el => { const s = getComputedStyle(el); const b = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 })
          .filter(el => { const b = el.getBoundingClientRect(); return !(b.width <= 1 && b.height <= 1) }) // enlace «saltar al contenido» oculto hasta recibir foco
          .filter(el => !(el.tagName === 'A' && el.closest('p, li, span') && getComputedStyle(el).display === 'inline')) // enlaces dentro de texto: excepción WCAG 2.5.8
          .map(el => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), text: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30) } })
          .filter(e => e.w < min || e.h < min)
        return { h1, small, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText }
      }, MIN)
      const english = lang === 'es' ? (r.text.match(/\b(plan requests?|matching pending|THERAPIST|Sprint \d+|Create prompt)\b/gi) || []) : []
      const ok = r.h1 === 1 && r.small.length === 0 && english.length === 0
      if (!ok) failures++
      console.log(`${ok ? 'OK   ' : 'FALLA'} ${role} ${path} ${lang} h1=${r.h1} pequeños=${r.small.length} desborde=${r.overflow}${english.length ? ` inglés=[${english}]` : ''}`)
      for (const e of r.small.slice(0, 5)) console.log(`       ${e.w}×${e.h} «${e.text}»`)
    } catch (error) { failures++; console.log(`FALLA ${role} ${path} ${lang} (${error.message.slice(0, 80)})`) }
    await ctx.close()
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
