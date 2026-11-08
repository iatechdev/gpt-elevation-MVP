// ES-209: barrido de contraste (axe, regla color-contrast, WCAG AA 4,5:1) por rol, idioma y ancho. No corre en CI; evidencia del PR.
// El servidor se simula con page.route: /api/session devuelve el rol; el resto de /api responde 200 con un cuerpo vacío sintético
// (lista vacía según la ruta), así que se miden los estados vacíos y de marco, no los datos reales.
// Uso: `npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<ruta a axe.min.js> BASE=http://localhost:5299 node scripts/es209-contrast-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'

const SCREENS = [
  ['user', '/app/dashboard'], ['user', '/app/chat'], ['user', '/app/checkin'], ['user', '/app/progress'],
  ['admin', '/admin/dashboard'], ['admin', '/admin/users'], ['admin', '/admin/content'], ['admin', '/admin/prompts'],
  ['superadmin', '/admin/dashboard'], ['superadmin', '/admin/manifest'], ['board', '/board/manifest'], ['therapist', '/therapist/dashboard'],
]

async function open(browser, { role, lang, width }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role, onboardingCompleted: true }) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  })
  await page.addInitScript(([l]) => {
    localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789')
    localStorage.setItem('elevation_name', 'Synthetic QA')
  }, [lang])
  return { ctx, page }
}

;(async () => {
  const browser = await chromium.launch()
  let total = 0
  for (const [role, path] of SCREENS) for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const { ctx, page } = await open(browser, { role, lang, width })
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      await page.addScriptTag({ content: axeSource })
      const nodes = await page.evaluate(() => axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } })
        .then(r => r.violations.flatMap(v => v.nodes.map(n => ({ target: n.target.join(' '), summary: (n.any[0] && n.any[0].message) || '' })))))
      total += nodes.length
      console.log(`${nodes.length === 0 ? 'OK   ' : 'FALLA'} ${role} ${path} ${lang} ${width}px${nodes.length ? ` → ${nodes.length}` : ''}`)
      for (const n of nodes.slice(0, 6)) console.log(`       ${n.target.slice(0, 90)} :: ${n.summary.slice(0, 150)}`)
    } catch (error) { total++; console.log(`FALLA ${role} ${path} ${lang} ${width}px (${error.message.slice(0, 80)})`) }
    await ctx.close()
  }
  await browser.close()
  console.log(total === 0 ? 'Sin violaciones de contraste en las combinaciones medidas.' : `Total de nodos con contraste insuficiente: ${total}`)
  process.exit(total === 0 ? 0 : 1)
})()
