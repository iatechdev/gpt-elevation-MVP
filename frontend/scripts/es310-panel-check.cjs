// ES-310 (PR 2): Panel y Métricas (/admin/dashboard, /admin/metrics) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe wcag2a/2aa/21a/21aa/22aa = 0 en claro/oscuro × ES/EN × 1360/390/320 px (también con la tabla alternativa abierta y con un aviso que falla), h1 único, sin estilos en línea,
// sin desborde, objetivos >= 24 px, tema del sistema, cero = línea mínima (30 columnas), «Sin datos» en null, «Ver como tabla» y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-310 && npx vite preview --outDir dist-310 --host 127.0.0.1 --port 4310 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4310 node scripts/es310-panel-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4310'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const dayIso = n => new Date(Date.UTC(2026, 9, 18 + n)).toISOString().slice(0, 10)
const COUNTS = [2, 3, 1, 0, 4, 6, 5, 7, 3, 2, 0, 0, 1, 4, 8, 6, 5, 3, 2, 1, 0, 2, 4, 7, 9, 6, 3, 2, 1, 4]
const metrics = (empty = false) => ({
  totalUsers: 128, activeUsers: 97, totalTherapists: 12, totalSessions: 1204, avgMood: empty ? null : 3.8, avgRating: empty ? null : 4.5, activeThisWeek: 41,
  days30: COUNTS.map((c, i) => ({ date: dayIso(i), count: empty ? 0 : c })), total30: empty ? 0 : COUNTS.reduce((a, b) => a + b, 0),
  max30: empty ? null : { date: dayIso(24), count: 9 }, dailyAverage30: empty ? 0 : 2.9, range: { start: dayIso(0), end: dayIso(29), timeZone: 'America/Bogota' },
  topTherapists: empty ? [] : [{ id: 1, name: 'Profesional Sintético 1', patientCount: 14, avgRating: 4.6 }, { id: 2, name: 'Profesional Sintético 2', patientCount: 9, avgRating: null }],
})
const alerts = (bad = false) => ({ sections: {
  guides: bad ? { status: 'error' } : { status: 'ok', count: 2, items: [{ id: 1, therapistName: 'Profesional Sintético 1', version: 3, createdAt: '2026-11-10T10:00:00Z' }] },
  professionalsIncomplete: { status: 'ok', count: 2 }, manifest: { status: 'ok', version: 'v2', date: '2026-10-12' } } })

async function open(browser, { path, width, lang, scheme, cpu = 1, empty = false, bad = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'admin', onboardingCompleted: true } })
    if (p === '/api/admin/metrics') return route.fulfill({ json: metrics(empty) })
    if (p === '/api/admin/usuarios/alerts') return route.fulfill({ json: alerts(bad) })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.locator('.cg-figures').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20)))

;(async () => {
  const browser = await chromium.launch()
  for (const path of ['/admin/dashboard', '/admin/metrics']) for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${path} ${width}px ${lang} ${scheme}`
    const { ctx, page, errors } = await open(browser, { path, width, lang, scheme })
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea en el área principal (${tag})`)
    report(await page.locator('main rect').count() === 30, `30 columnas siempre (${tag})`)
    const zeros = COUNTS.filter(c => c === 0).length
    report(await page.locator('main rect.ao-zero').count() === zeros, `los ${zeros} días en cero son línea mínima (${tag})`)
    const zh = await page.evaluate(() => Math.max(...[...document.querySelectorAll('main rect.ao-zero')].map(r => r.getBoundingClientRect().height)))
    report(zh <= 2, `la línea de cero mide ${zh.toFixed(2)} px (<= 2) (${tag})`)
    const figs = await page.locator('.cg-figure').count(); report(figs === (path === '/admin/dashboard' ? 7 : 10), `${figs} cifras (${tag})`)
    const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal (${tag})`, String(ov))
    const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
    let v = await axe(page); report(v.length === 0, `axe en 0 (${tag})`, v.join(','))
    const toggle = page.getByRole('button', { name: lang === 'es' ? 'Ver como tabla' : 'View as table' })
    await toggle.click()
    report(await page.getByRole('region', { name: lang === 'es' ? 'Registros por día' : 'Check-ins per day' }).count() === 1 && await page.locator('main table tbody tr').count() >= 30, `tabla alternativa con 30 filas y región con nombre (${tag})`)
    report(await page.getByRole('button', { name: lang === 'es' ? 'Ver como gráfica' : 'View as chart' }).getAttribute('aria-pressed') === 'true', `botón con aria-pressed (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0 con la tabla abierta (${tag})`, v.join(','))
    const ov2 = await overflow(page); report(ov2 <= 0, `sin desborde con la tabla (${tag})`, String(ov2))
    report(errors.length === 0, `sin errores de página (${tag})`, errors.join('; '))
    await ctx.close()
  }
  // Datos vacíos («Sin datos», sin barras) y un aviso que falla, en claro/oscuro y 320 px
  for (const scheme of ['light', 'dark']) for (const width of [1360, 320]) {
    const tag = `${width}px ${scheme}`
    let { ctx, page } = await open(browser, { path: '/admin/metrics', width, lang: 'es', scheme, empty: true })
    const body = await page.locator('main').innerText()
    report(/Sin datos/.test(body) && !/\b0 de 5/.test(body), `«Sin datos» en promedios nulos, nunca 0 de 5 (${tag})`)
    report(/Sin registros entre/.test(body) && await page.locator('main rect:not(.ao-zero)').count() === 0, `sin registros: solo líneas de cero (${tag})`)
    let v = await axe(page); report(v.length === 0, `axe en 0, datos vacíos (${tag})`, v.join(',')); await ctx.close()
    ;({ ctx, page } = await open(browser, { path: '/admin/dashboard', width, lang: 'es', scheme, bad: true }))
    report(await page.locator('.cg-banner--error[role=alert]').count() === 1, `el aviso que falla muestra su error con Reintentar sin tumbar el panel (${tag})`)
    report(await page.getByRole('button', { name: 'Reintentar' }).count() === 1 && await page.locator('.cg-figure').count() === 7, `Reintentar presente y cifras intactas (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, aviso con error (${tag})`, v.join(',')); await ctx.close()
  }
  // CLS a 390 px con CPU×4
  for (const path of ['/admin/dashboard', '/admin/metrics']) for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { path, width: 390, lang: 'es', scheme, cpu: 4 })
    await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${path} ${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTodo OK'); process.exit(failures ? 1 : 0)
})()
