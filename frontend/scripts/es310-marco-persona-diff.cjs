// ES-310 (PR 1, E331-1): el marco de PERSONA no debe cambiar respecto de main. Compara, en dos compilaciones (A = main, B = esta rama), el rectángulo de cada botón, enlace, encabezado y párrafo
// de la página, en las rutas de persona × claro/oscuro × ES/EN × 1360/390 px. Imprime las combinaciones con diferencia (> 0,5 px) y un resumen. Evidencia; no corre en CI.
// Uso: PLAYWRIGHT_MODULE=<playwright> A=http://127.0.0.1:4316 B=http://127.0.0.1:4317 node scripts/es310-marco-persona-diff.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const A = process.env.A, B = process.env.B
const ROUTES = ['/app/dashboard', '/app/skill-map', '/app/chat', '/app/evidence', '/app/diary', '/app/next-step', '/app/checkin', '/app/bridge', '/app/my-therapist', '/app/progress']
async function snap(browser, base, route, { scheme, lang, width }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [lang])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : {} }) })
  await page.goto(base + route, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(600)
  const rects = await page.evaluate(() => [...document.querySelectorAll('button, a, h1, h2, h3, p, label, li, span')].map((e, i) => { const r = e.getBoundingClientRect(); return `${i}|${e.tagName}|${(e.textContent || '').trim().slice(0, 24)}|${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}` }))
  await ctx.close(); return rects
}
;(async () => {
  const browser = await chromium.launch(); let total = 0, diff = 0
  for (const route of ROUTES) for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390]) {
    total++; const o = { scheme, lang, width }
    const [a, b] = [await snap(browser, A, route, o), await snap(browser, B, route, o)]
    const changed = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i] !== b[i]) changed.push(`${a[i]} => ${b[i]}`) }
    if (changed.length) { diff++; console.log(`DIFERENTE ${route} ${scheme} ${lang} ${width}: ${changed.length} elementos`, changed.slice(0, 2).join(' ; ')) }
  }
  await browser.close(); console.log(`\n${total} combinaciones · ${diff} con diferencia`); process.exit(diff ? 1 : 0)
})()
