// ES-350: «Textos públicos» (/admin/content, pestaña 4) agrupado por prefijo en acordeones y con buscador, en navegador real (Chromium) con API simulada y la lista REAL de claves (shared/landing-content.json).
// Mide: 19 grupos + 3 textos sueltos, primer grupo abierto y el resto cerrado, buscador con contador role=status («Sin resultados» con 0), solo los grupos con coincidencias abiertos y su resumen cuenta solo coincidencias,
// lo escrito sin guardar SOBREVIVE a filtrar y a borrar la búsqueda, teclado (Enter/Espacio abren un grupo), axe wcag2a/2aa/21a/21aa/22aa = 0, sin desborde, objetivos >= 24 px y CLS <= 0,1 a 390 px con CPU×4,
// en claro/oscuro × ES/EN × 1360/390/320.
// Uso: npx vite build --outDir dist-350 && npx vite preview --outDir dist-350 --host 127.0.0.1 --port 4350 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4350 node scripts/es350-check.cjs
const fs = require('fs')
const path = require('path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4350'
const fields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'landing-content.json'), 'utf8'))
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }

async function open(browser, { width, lang, scheme, cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
    if (p === '/api/landing-content/admin') return route.fulfill({ json: Object.fromEntries(fields.map(f => [f.key, 'Texto sintético de ' + f.key])) })
    if (p === '/api/landing-content/versions') return route.fulfill({ json: fields.map(f => ({ key: f.key, updatedAt: '2026-11-01T10:00:00.000Z', updatedBy: 'Sintética' })) })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/content', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.getByRole('tab').nth(3).click(); await page.locator('.ac-group').first().waitFor({ timeout: 10000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map(n => n.target.join('>')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const small = page => page.evaluate(() => [...document.querySelectorAll('main summary, main button, main input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !(e.type === 'checkbox') }).map(e => (e.id || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 5))
const openGroups = page => page.evaluate(() => [...document.querySelectorAll('details.ac-group')].filter(d => d.open && !d.hidden).length)
const visibleRows = page => page.evaluate(() => [...document.querySelectorAll('.ac-frow')].filter(li => !li.hidden && li.closest('details[hidden]') === null && (li.closest('details') === null || li.closest('details').open)).length)

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page, errors } = await open(browser, { width, lang, scheme })
    report(await page.locator('details.ac-group').count() === 19, `19 grupos en acordeón (${tag})`)
    report(await page.locator('.ac-frow').count() === fields.length + 3, `${fields.length + 3} filas montadas (337 textos + 3 sueltos) (${tag})`)
    report(await openGroups(page) === 1 && await page.locator('details.ac-group').first().evaluate(d => d.open), `el primer grupo abierto y el resto cerrados (${tag})`)
    const firstSummary = (await page.locator('.ac-summary').first().textContent()).trim() // textContent: el CSS pone el resumen en mayúsculas y innerText lo devolvería así
    report(/^.+, \d+ (textos|texts)$/.test(firstSummary), `el resumen dice «grupo, n textos»: «${firstSummary}» (${tag})`)
    let v = await axe(page); report(v.length === 0, `axe en 0, sin búsqueda (${tag})`, v.join(','))
    report(await overflow(page) <= 0, `sin desborde (${tag})`); const sm = await small(page); report(sm.length === 0, `objetivos >= 24 px (${tag})`, sm.join(','))
    // teclado: abrir el segundo grupo con Enter y cerrarlo con Espacio
    const second = page.locator('.ac-summary').nth(1); await second.focus(); await page.keyboard.press('Enter')
    report(await page.locator('details.ac-group').nth(1).evaluate(d => d.open), `Enter abre un grupo (${tag})`)
    await page.keyboard.press('Space'); report(!(await page.locator('details.ac-group').nth(1).evaluate(d => d.open)), `Espacio lo cierra (${tag})`)
    // lo escrito sin guardar sobrevive a filtrar y a borrar la búsqueda
    const fieldId = '#landing-landing\\.nav\\.skip'
    await page.locator(fieldId).fill('Texto editado sin guardar')
    const term = lang === 'es' ? 'precios' : 'pricing'
    await page.fill('#landing-search', term)
    const status = await page.locator('.ac-count').innerText()
    report(/^(\d+ (resultados|results)|1 (resultado|result))$/.test(status.trim()) && Number.parseInt(status, 10) >= 1, `contador anuncia coincidencias: «${status.trim()}» (${tag})`)
    report(await openGroups(page) === 1, `con búsqueda solo el grupo con coincidencias está abierto (${tag})`)
    const rows = await visibleRows(page); report(rows === Number.parseInt(status, 10), `filas visibles = contador (${rows}) (${tag})`)
    const sum = (await page.locator('details.ac-group:not([hidden]) .ac-summary').first().textContent()).trim(); report(sum.startsWith(lang === 'es' ? 'Precios' : 'Pricing') && sum.includes(String(rows)), `el resumen cuenta solo coincidencias: «${sum}» (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, con búsqueda (${tag})`, v.join(','))
    await page.fill('#landing-search', 'zzzz-no-existe')
    report((await page.locator('.ac-count').innerText()).trim() === (lang === 'es' ? 'Sin resultados' : 'No results') && await visibleRows(page) === 0, `0 coincidencias dice «Sin resultados» y no muestra filas (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, sin resultados (${tag})`, v.join(','))
    await page.fill('#landing-search', '')
    report((await page.locator(fieldId).inputValue()) === 'Texto editado sin guardar', `lo escrito sin guardar sobrevive a filtrar y a borrar la búsqueda (${tag})`)
    report(await openGroups(page) === 1, `sin búsqueda vuelve a quedar solo el primer grupo abierto (${tag})`)
    report(errors.length === 0, `sin errores de consola (${tag})`, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 })
    await page.waitForTimeout(500)
    const load = await page.evaluate(() => window.__cls) // CLS de la carga (marco y pestañas; es intermitente por las fuentes y no depende de esta pantalla)
    const t0 = Date.now(); await page.fill('#landing-search', 'precios'); await page.waitForTimeout(300)
    const delta = (await page.evaluate(() => window.__cls)) - load
    report(delta <= 0.1, `filtrar con el buscador suma CLS ${delta.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme}; carga del marco: ${load.toFixed(3)}, informativo)`)
    report(Date.now() - t0 < 4000, `escribir en el buscador con CPU×4 no se queda pegado (${Date.now() - t0} ms) (${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} fallas` : '\nTodo OK')
  process.exit(failures ? 1 : 0)
})()
