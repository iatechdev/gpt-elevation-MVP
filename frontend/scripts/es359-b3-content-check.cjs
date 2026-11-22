// ES-359 (B3, regresión QA-5): /admin/content con 403 muestra la falta de permiso SIN «Reintentar»; con 500 o red conserva «Reintentar» y reintenta. Chromium, API simulada, datos sintéticos.
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4124 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4124 node scripts/es359-b3-content-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4124'
let total = 0, failures = 0
const report = (ok, text) => { total++; if (!ok) { failures++; console.log('FALLA ' + text) } }
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) for (const mode of ['403', '500', 'red']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    let pendingCalls = 0
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/junta/pending') { pendingCalls++; if (mode === 'red') return route.abort(); return route.fulfill({ status: mode === '403' ? 403 : 500, json: { error: 'x' } }) }
      if (p === '/api/session') return route.fulfill({ json: { role: 'admin', onboardingCompleted: true } })
      return route.fulfill({ json: [] }) })
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l) }, lang)
    await page.goto(BASE + '/admin/content', { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
    const tag = `${mode} ${lang} ${width}px ${scheme}`
    const alert = page.locator('[role="alert"]').filter({ hasText: /superadministraci|superadministration|No se pudieron cargar los documentos|Could not load/i }).first()
    const retry = alert.getByRole('button', { name: /Reintentar|Retry/ })
    report(await alert.count() === 1, `${tag}: no aparece el aviso`)
    if (mode === '403') {
      report(/Solo superadministración|Only superadministration/.test(await alert.innerText()), `${tag}: mensaje de permiso incorrecto: ${await alert.innerText()}`)
      report(await retry.count() === 0, `${tag}: 403 con «Reintentar»`)
    } else {
      report(await retry.count() === 1, `${tag}: sin «Reintentar» en error recuperable`)
      const before = pendingCalls; await retry.click(); await page.waitForTimeout(300)
      report(pendingCalls === before + 1, `${tag}: «Reintentar» no repitió la petición (${before} → ${pendingCalls})`)
    }
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    report(axe.length === 0 && overflow <= 0, `${tag}: axe=[${axe}] desborde=${overflow}`)
    await ctx.close()
  }
  console.log(`${total - failures}/${total} comprobaciones OK`); await browser.close(); process.exit(failures ? 1 : 0)
})()
