// ES-315: Contenido · Planes y Textos públicos (/admin/content) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe wcag2a/2aa/21a/21aa/22aa = 0 (Planes, formulario de plan vacío y con errores, confirmación de desactivar, Textos públicos con la lista REAL de claves de shared/landing-content.json,
// error de guardado 403) en claro/oscuro × ES/EN × 1360/390/320 px, h1 único, sin estilos en línea, sin desborde, objetivos >= 24 px, plan inactivo sin opacity, diálogo (foco al abrir,
// Tab atrapado, Esc cierra y devuelve el foco), foco a «Editar» tras desactivar, 403 visible en el campo y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-315 && npx vite preview --outDir dist-315 --host 127.0.0.1 --port 4315 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4315 node scripts/es315-check.cjs
const fs = require('fs')
const path = require('path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4315'
const fields = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'shared', 'landing-content.json'), 'utf8'))
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const plans0 = () => [
  { id: 1, slug: 'gratis', name_es: 'Plan gratuito (ejemplo)', name_en: 'Free plan (example)', description_es: '', description_en: '', price: '0.00', currency: 'USD', period: 'forever', features_es: ['Conversaciones de ejemplo', 'Diario privado (ejemplo)'], features_en: ['Example conversations'], isHighlighted: false, isActive: true, order: 0 },
  { id: 2, slug: 'completo', name_es: 'Plan completo (ejemplo)', name_en: 'Full plan (example)', description_es: 'Descripción', description_en: 'Description', price: '12.50', currency: 'USD', period: 'month', features_es: ['Función de ejemplo A con un texto largo que debe partirse sin desbordar la tarjeta en pantallas angostas', 'B', 'C'], features_en: ['Example feature A'], isHighlighted: true, isActive: true, order: 1 },
  { id: 3, slug: 'anterior', name_es: 'Plan anterior (ejemplo)', name_en: 'Former plan (example)', description_es: '', description_en: '', price: '99000.00', currency: 'COP', period: 'year', features_es: ['Función de ejemplo A'], features_en: ['Example feature A'], isHighlighted: false, isActive: false, order: 2 },
]

async function open(browser, { width, lang, scheme, cpu = 1, forbid = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  let plans = plans0()
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
    if (p === '/api/junta/pending') return route.fulfill({ json: [] })
    if (p === '/api/admin/professional-applications') return route.fulfill({ json: [] })
    if (p === '/api/admin/pricing/all') return route.fulfill({ json: plans })
    if (/^\/api\/admin\/pricing\/\d+$/.test(p) && method === 'DELETE') { const id = Number(p.split('/').pop()); plans = plans.map(x => x.id === id ? { ...x, isActive: false } : x); return route.fulfill({ json: { ok: true } }) }
    if (p.startsWith('/api/admin/pricing')) return route.fulfill({ json: { ok: true } })
    if (p === '/api/landing-content/admin') return route.fulfill({ json: Object.fromEntries(fields.map(f => [f.key, 'Texto sintético de ' + f.key])) })
    if (p === '/api/landing-content' && method === 'PUT') { await new Promise(done => setTimeout(done, 400)) } // el guardado tarda: así se ve el estado «guardando»
    if (p === '/api/landing-content' && method === 'PUT') return route.fulfill({ status: forbid ? 403 : 200, json: { ok: !forbid } })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/content', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map(n => n.target.join('>')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href], main input, main select, main textarea, dialog[open] button, dialog[open] input, dialog[open] select, dialog[open] textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && !(e.matches('input[type=checkbox]') && r.width >= 24) }).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 5))
const tab = (page, i) => page.getByRole('tab').nth(i)

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page, errors } = await open(browser, { width, lang, scheme })
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    // ── Planes ──
    await tab(page, 2).click(); await page.locator('.ac-plan').first().waitFor()
    report(await page.locator('.ac-plan').count() === 3, `tres planes (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea en Planes (${tag})`)
    report(await page.locator('.ac-plan--off').count() === 1 && await page.evaluate(() => { const c = document.querySelector('.ac-plan--off'); return getComputedStyle(c).opacity === '1' && getComputedStyle(c).borderLeftStyle === 'dashed' }), `plan inactivo sin opacity y con borde discontinuo (${tag})`)
    report(await page.locator('.ac-plan--off .cg-chip--bad').count() === 1 && await page.locator('.ac-plan .cg-chip--ok').count() === 1, `chips Inactivo y Destacado con palabra (${tag})`)
    let v = await axe(page); report(v.length === 0, `axe en 0, Planes (${tag})`, v.join(','))
    report(await overflow(page) <= 0, `sin desborde horizontal en Planes (${tag})`)
    let small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px en Planes (${tag})`, small.join(','))
    // formulario nuevo: foco, errores por campo, Esc y retorno de foco
    const newBtn = page.locator('.ac-bar .cg-btn').first(); await newBtn.click()
    await page.locator('dialog[open] #plan-slug').waitFor()
    report(await page.evaluate(() => document.activeElement && document.activeElement.closest('dialog[open]') !== null), `el foco entra al diálogo del plan (${tag})`)
    report(await page.locator('dialog[open] fieldset legend').count() === 5, `cinco secciones rotuladas (${tag})`)
    const wide = await page.evaluate(() => Math.round(document.querySelector('dialog[open]').getBoundingClientRect().width)); report(wide <= (width >= 700 ? 640 : width), `diálogo ancho <= 40 rem o el ancho de la pantalla (${tag})`, String(wide))
    await page.locator('dialog[open] .cg-dialog__actions .cg-btn').last().click() // Crear plan vacío → errores
    await page.locator('dialog[open] .cg-error').first().waitFor()
    report(await page.locator('dialog[open] .cg-error').count() >= 3, `errores por campo (${tag})`)
    report(await page.evaluate(() => document.activeElement && document.activeElement.id === 'plan-slug'), `el foco va al primer campo con error (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, formulario con errores (${tag})`, v.join(','))
    small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px en el formulario (${tag})`, small.join(','))
    report(await overflow(page) <= 0, `sin desborde horizontal con el formulario (${tag})`)
    // Tab atrapado
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
    report(await page.evaluate(() => document.activeElement.closest('dialog[open]') !== null), `Tab queda dentro del diálogo (${tag})`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    report(await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim().length > 0 && document.activeElement.closest('.ac-bar') !== null), `Esc cierra y el foco vuelve a «Nuevo plan» (${tag})`)
    // editar: identificador de solo lectura
    await page.locator('#plan-edit-2').click(); await page.locator('dialog[open] #plan-slug').waitFor()
    report(await page.locator('dialog[open] #plan-slug').getAttribute('readonly') !== null, `identificador de solo lectura al editar (${tag})`)
    report(await page.evaluate(() => document.activeElement && document.activeElement.id === 'plan-name-es'), `al editar el foco inicial va al primer campo editable (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    // desactivar: confirmación, axe, foco a Editar
    await page.locator('.ac-off').first().click(); await page.locator('dialog[open]').waitFor()
    v = await axe(page); report(v.length === 0, `axe en 0, confirmar desactivar (${tag})`, v.join(','))
    await page.locator('dialog[open] .cg-btn--danger').click()
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'plan-edit-1')
    report(true, `tras desactivar el foco pasa a «Editar» del mismo plan (${tag})`)
    // ── Textos públicos ──
    await tab(page, 3).click(); await page.locator('.ac-frow').first().waitFor()
    const rows = await page.locator('.ac-frow').count(); report(rows >= 300, `lista real de textos (${rows} filas) (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea en Textos (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, Textos públicos (${tag})`, v.join(','))
    report(await overflow(page) <= 0, `sin desborde horizontal en Textos (${tag})`)
    small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px en Textos (${tag})`, small.join(','))
    report(await page.locator('.ac-lang [aria-pressed=true]').count() === 1, `selector de idioma con aria-pressed (${tag})`)
    const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.ac-frow')).gridTemplateColumns.split(' ').length); report(cols === (width <= 560 ? 1 : 2), `fila campo + Guardar: ${cols} columna(s) (${tag})`)
    await page.locator('.ac-frow .cg-btn').first().click()
    report(await page.locator('.ac-frow .cg-btn').first().getAttribute('aria-disabled') === 'true' && (await page.locator('.ac-frow .cg-btn').first().innerText()).trim() === '...', `«Guardar» con aria-disabled y «...» mientras guarda (${tag})`)
    await page.locator('.ac-frow p[role=status]').first().waitFor()
    report(/✓/.test(await page.locator('.ac-frow p[role=status]').first().innerText()), `guardado confirmado con símbolo y palabra (${tag})`)
    report(errors.length === 0, `sin errores de consola (${tag})`, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
  // 403: solo superadmin guarda textos
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, forbid: true })
    await tab(page, 3).click(); await page.locator('.ac-frow').first().waitFor()
    await page.locator('.ac-frow .cg-btn').first().click(); await page.locator('.ac-frow .cg-error').first().waitFor()
    report((await page.locator('.ac-frow .cg-error').first().innerText()).includes('Solo superadmin puede guardar textos.'), `403 visible en el campo (${scheme})`)
    const v = await axe(page); report(v.length === 0, `axe en 0 con el error 403 (${scheme})`, v.join(','))
    await ctx.close()
  }
  // CLS a 390 px con CPU×4: carga, y cambio a cada pestaña tras esperar
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 })
    await page.waitForTimeout(800)
    await tab(page, 2).click(); await page.locator('.ac-plan').first().waitFor(); await page.waitForTimeout(800)
    await tab(page, 3).click(); await page.locator('.ac-frow').first().waitFor(); await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} fallas` : '\nTodo OK')
  process.exit(failures ? 1 : 0)
})()
