// ES-250: límites de error. Navegador real (Chromium), API simulada, ES/EN × 390/1360.
//  A) Un error REAL de código dentro de UN bloque (panel de fuentes de El Puente) solo sustituye ese bloque por «Algo salió mal en esta sección» + «Reintentar»; el resto de la pantalla sigue viva; «Reintentar» lo recupera.
//  B) Un error de código al renderizar la pantalla entera ya no deja el cuerpo en blanco: «Algo salió mal en esta pantalla» + «Reintentar».
//  C) Sin conexión → «Sin conexión» (no «versión nueva»); D) archivo CSS bloqueado con red → aviso genérico (no «versión nueva»); E) 404 del chunk con red → «versión nueva» (ES-234 se mantiene).
//  El registro por consola trae el nombre del error, la ruta y los componentes, SIN el mensaje del error (que aquí lleva un correo ficticio).
// Las excepciones se provocan con una MUTACIÓN temporal de la compilación (window.__boom / window.__boomRoute); la mutación NO está en el código del PR.
// No corre en CI; evidencia del PR. Uso: compilar con la mutación (ver el PR), `npx vite preview --outDir dist-mut --port 5250 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5250 node scripts/es250-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5250'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { section: /Algo salió mal en esta sección/, screen: /Algo salió mal en esta pantalla/, offline: /Sin conexión\. Cuando vuelvas/, version: /Hay una versión nueva de la aplicación/, resource: /No se pudo cargar una parte de la pantalla/, retry: 'Reintentar', reload: 'Recargar' },
  en: { section: /Something went wrong in this section/, screen: /Something went wrong on this screen/, offline: /No connection\. Reload once/, version: /There is a new version|A new version of the app is available/, resource: /A part of the screen could not be loaded/, retry: 'Retry', reload: 'Reload' } }

async function open(browser, { width, lang, flags = {}, path = '/app/dashboard' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text()) })
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
    if (p === '/api/career-context') return route.fulfill({ json: { active: null, versions: [] } })
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } })
    return route.fulfill({ json: p.endsWith('/evidence') ? { evidence: [] } : p.endsWith('/diary') ? { entries: [] } : {} })
  })
  await page.addInitScript(([l, f]) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); Object.assign(window, f) }, [lang, flags])
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  return { ctx, page, logs }
}
const go = (page, path) => page.evaluate(p => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')) }, path)
const text = page => page.locator('body').innerText()
const axe = async (page, label) => {
  await page.addScriptTag({ content: axeSource }).catch(() => {})
  const v = await page.evaluate(() => typeof axe === 'undefined' ? ['sin axe'] : axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(x => x.id + ':' + x.nodes.length)))
  report(v.length === 0, `${label}: axe`, `axe=[${v}]`)
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const t = T[lang]; const tag = `${lang} ${width}px`
    // A) bloque
    { const { ctx, page, logs } = await open(browser, { width, lang, flags: { __boom: true }, path: '/app/bridge' })
      await page.waitForTimeout(600)
      const body = await text(page)
      report(await page.locator('h1').count() >= 1, `A) el resto de la pantalla sigue viva (título presente) ${tag}`)
      report(t.section.test(body) && await page.getByRole('button', { name: t.retry, exact: true }).count() === 1, `A) el bloque que falló se sustituye por «${t.retry}» y el aviso de sección ${tag}`)
      report(await page.getByRole('alert').count() === 1, `A) un solo aviso (role=alert), no toda la pantalla ${tag}`)
      report(logs.every(l => !/boom|personal@example/.test(l)), `A) ES-256: NINGÚN console.error trae el mensaje del error (ni el registro nativo de React) ${tag}`, logs.find(l => /boom|personal@example/.test(l)) ? `«${logs.find(l => /boom|personal@example/.test(l)).slice(0, 80)}»` : '')
      const mine = logs.filter(l => l.startsWith('[boundary]')); const own = mine[0] || ''
      report(mine.length >= 1 && /^\[boundary\] Error \/app\/bridge /.test(own) && !/boom-section|personal@example/.test(own), `A) el registro propio trae nombre y ruta (componentes minificados en producción), sin el mensaje ${tag}`, `«${own.slice(0, 90)}»`)
      if (width === 1360) await axe(page, `A) aviso de sección ${lang}`)
      await page.evaluate(() => { window.__boom = false }); await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.waitForTimeout(500)
      report(await page.getByRole('alert').filter({ hasText: t.section }).count() === 0 && await page.locator('#bridge-src-title').count() === 1, `A) «${t.retry}» recupera el bloque ${tag}`)
      report(await page.waitForFunction(() => document.activeElement && document.activeElement !== document.body, null, { timeout: 3000 }).then(() => true, () => false), `A) ES-256: tras «${t.retry}» con éxito el foco NO cae a body ${tag}`)
      await ctx.close() }
    // B) pantalla entera
    { const { ctx, page } = await open(browser, { width, lang, flags: { __boomRoute: true }, path: '/app/bridge' })
      await page.waitForTimeout(600)
      report(t.screen.test(await text(page)) && await page.getByRole('button', { name: t.retry, exact: true }).count() === 1, `B) error de código en la pantalla: aviso con «${t.retry}», no cuerpo en blanco ${tag}`)
      if (width === 1360) await axe(page, `B) aviso de pantalla ${lang}`)
      await page.evaluate(() => { window.__boomRoute = false }); await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.locator('h1').first().waitFor({ timeout: 8000 }).catch(() => {})
      report(await page.locator('h1').count() >= 1 && !t.screen.test(await text(page)), `B) «${t.retry}» recupera la pantalla ${tag}`)
      report(await page.waitForFunction(() => document.activeElement && document.activeElement !== document.body, null, { timeout: 3000 }).then(() => true, () => false), `B) ES-256: tras «${t.retry}» con éxito el foco NO cae a body ${tag}`)
      await ctx.close() }
  }
  for (const lang of ['es', 'en']) {
    const t = T[lang]
    // C) sin conexión
    { const { ctx, page } = await open(browser, { width: 1360, lang }); await ctx.setOffline(true); await go(page, '/app/evidence'); await page.waitForTimeout(1500)
      const body = await text(page)
      report(t.offline.test(body) && !t.version.test(body), `C) sin conexión: dice «Sin conexión», no «versión nueva» ${lang}`)
      await axe(page, `C) aviso sin conexión ${lang}`)
      await ctx.setOffline(false)
      await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 15000 }).catch(() => {}), page.getByRole('button', { name: t.reload, exact: true }).click()])
      await page.waitForFunction(() => document.querySelector('h1'), null, { timeout: 15000 }).catch(() => {})
      report(await page.locator('h1').count() >= 1, `C) con la conexión de vuelta, «${t.reload}» recupera la pantalla ${lang}`)
      await ctx.close() }
    // D) con red, archivo CSS bloqueado: no se disfraza de «versión nueva»
    { const { ctx, page } = await open(browser, { width: 1360, lang }); await page.route('**/assets/**/*.css', r => r.abort('blockedbyclient')); await page.route('**/assets/*.css', r => r.abort('blockedbyclient'))
      await go(page, '/app/evidence'); await page.waitForTimeout(1500)
      const body = await text(page)
      report(t.resource.test(body) && !t.version.test(body), `D) CSS bloqueado con red: aviso genérico, no «versión nueva» ${lang}`, t.resource.test(body) ? '' : `«${body.trim().slice(0, 80)}»`)
      await ctx.close() }
    // E) 404 del chunk con red: «versión nueva» (ES-234)
    { const { ctx, page } = await open(browser, { width: 1360, lang }); await page.route('**/assets/**', r => r.request().url().endsWith('.js') ? r.fulfill({ status: 404, body: 'no' }) : r.continue())
      await go(page, '/app/evidence'); await page.waitForTimeout(1500)
      report(t.version.test(await text(page)), `E) 404 del chunk con red: «versión nueva» ${lang}`)
      await ctx.close() }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
