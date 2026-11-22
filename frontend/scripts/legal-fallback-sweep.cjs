// ES-354: mide qué size-adjust de la reserva local (Arial/Liberation/Helvetica) iguala el DISEÑO que da Barlow real en las páginas legales (/privacidad y /terminos, ES y EN, a 390 y 1360 px).
// Referencia: fuentes reales cargadas (swap, esperando a que lleguen). Variante: las .woff2 bloqueadas y una reserva de prueba con el size-adjust indicado. Métrica: suma de |diferencia| de la posición
// vertical de cada título/sección/párrafo y del alto del documento. Menor = el texto cambia de fuente sin reflujo.
// No corre en CI. Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 5311 --strictPort   y luego
//   PLAYWRIGHT_MODULE=<playwright> BASE=http://127.0.0.1:5311 node scripts/legal-fallback-sweep.cjs [sans400|sans600|cond700]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:5311'
const WHICH = process.argv[2] || 'sans400'
const RANGES = { sans400: [88, 104], sans600: [82, 98], cond700: [56, 80] }
const PAGES = [['/privacidad', 'es'], ['/privacidad', 'en'], ['/terminos', 'es'], ['/terminos', 'en']]
const WIDTHS = (process.env.WIDTHS || '390,1360').split(',').map(Number)
const UR = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'

const positions = () => [...document.querySelectorAll('.lg h1, .lg h2, .lg p, .lg li')].map(e => Math.round(e.getBoundingClientRect().top + scrollY)).concat([document.documentElement.scrollHeight])

async function layout(browser, route, lang, width, adjust) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(l => localStorage.setItem('elv_lang', l), lang)
  await page.route('**/api/**', r => r.fulfill({ status: 404, json: {} }))
  if (adjust) await page.route('**/*.woff2', r => r.abort())
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await page.locator('h1').first().waitFor()
  if (adjust) {
    const family = { sans400: ['Barlow Legal Fallback', 400], sans600: ['Barlow Legal Fallback', 600], cond700: ['Barlow Condensed Legal Fallback', 700] }[WHICH]
    // la prueba redefine SOLO el peso medido (otra familia con ese size-adjust) y deja el resto como en producción
    await page.addStyleTag({ content: `@font-face { font-family: 'T'; src: local('Arial'), local('Liberation Sans'), local('Helvetica'); font-weight: ${family[1]}; size-adjust: ${adjust}%; unicode-range: ${UR}; }
      ${{ sans400: '.lg p, .lg li', sans600: '.lg-todo, .lg-also a, .lg strong', cond700: '.lg h1, .lg h2' }[WHICH]} { font-family: 'T', sans-serif !important; }` })
  } else {
    await page.evaluate(() => Promise.all([document.fonts.load('400 16px "Barlow Legal"'), document.fonts.load('600 16px "Barlow Legal"'), document.fonts.load('700 16px "Barlow Condensed Legal"')]))
  }
  await page.waitForTimeout(500)
  const out = await page.evaluate(positions)
  await ctx.close(); return out
}

;(async () => {
  const browser = await chromium.launch(); const [lo, hi] = RANGES[WHICH]
  const refs = {}
  for (const [r, l] of PAGES) for (const w of WIDTHS) refs[r + l + w] = await layout(browser, r, l, w, 0)
  const rows = []
  for (let a = lo; a <= hi; a += 2) {
    let total = 0; let worst = 0
    for (const [r, l] of PAGES) for (const w of WIDTHS) {
      const got = await layout(browser, r, l, w, a); const ref = refs[r + l + w]
      if (got.length !== ref.length) { total += 1e6; continue }
      const d = got.reduce((s, v, i) => s + Math.abs(v - ref[i]), 0); total += d; worst = Math.max(worst, Math.abs(got.at(-1) - ref.at(-1)))
    }
    rows.push([a, total, worst]); console.log(`${WHICH} size-adjust ${a}%: suma |Δ| ${total} px, peor Δ de alto ${worst} px`)
  }
  const best = rows.slice().sort((x, y) => x[1] - y[1])[0]; console.log('MEJOR', WHICH, best[0] + '%', 'suma', best[1])
  await browser.close()
})()
