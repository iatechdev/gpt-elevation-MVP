// ES-234 (E232-1): sin conexión al abrir una pantalla de carga perezosa (chunk aún no descargado) el cuerpo NO queda en blanco: aparece el aviso recuperable con «Recargar»,
// y al volver la conexión «Recargar» recupera la pantalla. Navegador real (Chromium) con la red caída DESPUÉS de cargar la aplicación; API simulada. ES/EN × 390/1360.
// Pantallas perezosas probadas: evidencias, diario, Brújula, hojas de vida. También 404 y bloqueo del archivo (los casos que ya funcionaban) para que no regresen.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es234-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = { es: { notice: /Sin conexión. Cuando vuelvas|Hay una versión nueva de la aplicación/i, reload: 'Recargar' }, en: { notice: /No connection. Reload once|A new version of the app is available/i, reload: 'Reload' } } // ES-250: sin conexión el aviso es «Sin conexión»; con red y chunk roto, «versión nueva»
const SCREENS = [['/app/evidence', 'evidencias'], ['/app/diary', 'diario'], ['/app/compass', 'Brújula'], ['/app/context/resumes', 'hojas de vida']]

async function open(browser, { width, lang }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    return route.fulfill({ json: p.endsWith('/evidence') ? { evidence: [] } : p.endsWith('/diary') ? { entries: [] } : {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' })
  return { ctx, page, errors }
}
// Navegación de la aplicación (sin recargar): lo que hace un enlace interno.
const go = (page, path) => page.evaluate(p => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
const visibleText = page => page.locator('body').innerText()

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const t = T[lang]; const tag = `${lang} ${width}px`
    for (const [path, name] of SCREENS) {
      const { ctx, page } = await open(browser, { width, lang })
      await ctx.setOffline(true)
      await go(page, path)
      await page.waitForTimeout(1500)
      const text = await visibleText(page)
      report(t.notice.test(text) && await page.getByRole('button', { name: t.reload, exact: true }).count() === 1, `sin conexión → ${name}: aviso recuperable con «${t.reload}», no cuerpo en blanco ${tag}`, text.trim() ? '' : '(cuerpo vacío)')
      await page.addScriptTag({ content: axeSource }).catch(() => {})
      if (name === 'evidencias') {
        const axe = await page.evaluate(() => typeof axe === 'undefined' ? ['sin axe'] : axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
        report(axe.length === 0, `aviso sin conexión: axe ${tag}`, `axe=[${axe}]`)
      }
      // vuelve la conexión → «Recargar» recupera la pantalla
      await ctx.setOffline(false)
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {}), page.getByRole('button', { name: t.reload, exact: true }).click()])
      await page.waitForFunction(() => document.querySelector('h1'), null, { timeout: 15000 }).catch(() => {})
      report(await page.locator('h1').count() >= 1 && !t.notice.test(await visibleText(page)), `con la conexión de vuelta, «${t.reload}» recupera ${name} ${tag}`)
      await ctx.close()
    }
  }
  // los casos que ya funcionaban: 404 y bloqueo del archivo del chunk
  for (const mode of ['404', 'blocked']) {
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es' })
    await page.route('**/assets/**', route => mode === '404' ? route.fulfill({ status: 404, body: 'no' }) : route.abort('blockedbyclient'))
    await go(page, '/app/evidence'); await page.waitForTimeout(1500)
    report(T.es.notice.test(await visibleText(page)), `se mantiene el aviso con el archivo del chunk en ${mode}`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
