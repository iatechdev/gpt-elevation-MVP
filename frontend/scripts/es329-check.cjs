// ES-329 (a): progreso, opinión, revisiones y catálogo dentro del marco de persona. Chromium, API simulada vacía/errores, SIN datos reales.
// Uso: VITE_ENABLE_PILOT_FEEDBACK_LIVE=true npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4112 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4112 node scripts/es329-check.cjs
// Por ruta × ES/EN × 390/1360/320 × claro/oscuro × (vacío, error): axe wcag2a/2aa/21a/21aa/22aa = 0, UN solo h1 (el de PersonScreen), un solo «Saltar al contenido» (el del marco),
// una sola cabecera de marco, sin desborde horizontal, el tema del layout aplicado.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4112'
const ROUTES = ['/app/progress', '/app/feedback', '/app/professional-reviews', '/app/route-catalog']
let failures = 0, total = 0
;(async () => {
  const browser = await chromium.launch()
  for (const mode of ['vacio', 'error']) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (mode === 'error') return route.fulfill({ status: 500, json: { error: 'x' } })
      if (p === '/api/user/progress') return route.fulfill({ json: { stats: null, moodLogs: [], ratings: [], recommendations: [] } })
      if (p === '/api/me/pilot-feedback') return route.fulfill({ json: { feedback: { window: 'day7', status: 'active', version: 0, questionnaireVersion: 1, answers: null, lastRequestId: null, permission: { purpose: 'pilot_feedback', granted: true } } } })
      return route.fulfill({ json: {} }) })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    for (const route of ROUTES) {
      total++
      await page.goto(BASE + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
      await page.addScriptTag({ content: axeSource })
      const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
      const m = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length, banners: document.querySelectorAll('header').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, oldRoots: document.querySelectorAll('.cg.prg, .cg.cgf, .cg.cgp').length, title: document.querySelector('h1')?.textContent || '' }))
      const ok = axe.length === 0 && m.h1 === 1 && m.skips === 1 && m.overflow <= 0 && m.oldRoots === 0 && m.title.length > 0
      if (!ok) failures++
      if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${mode} ${route} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${m.h1} saltar=${m.skips} cabeceras=${m.banners} desborde=${m.overflow} raícesViejas=${m.oldRoots} «${m.title}»`)
    }
    await ctx.close()
  }
  console.log(`${total - failures}/${total} combinaciones OK`); await browser.close(); process.exit(failures ? 1 : 0)
})()
