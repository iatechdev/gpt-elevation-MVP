// ES-310 (ES-349): Manifiesto ético de Administración (/admin/manifest) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe wcag2a/2aa/21a/21aa/22aa = 0 (lista, formulario, error del mínimo de 50 caracteres, diálogo de reactivar, vacío, error de carga) en claro/oscuro × ES/EN × 1360/390/320 px,
// h1 único, sin estilos en línea, sin desborde, objetivos >= 24 px, historial con aria-expanded (teclado), diálogo (foco inicial en Cancelar, Tab atrapado, Esc cierra y devuelve el foco),
// reactivar y publicar con foco al aviso de resultado, y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-182 && npx vite preview --outDir dist-182 --host 127.0.0.1 --port 4318 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4318 node scripts/es182-manifest-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4318'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const versions = () => [
  { id: 3, version: 'v3', isActive: true, note: 'Ajuste de tono (ejemplo)', content: 'Elevation acompaña y no diagnostica. Texto de ejemplo del manifiesto.\n\nLa persona decide qué guardar. '.repeat(6), createdAt: '2026-10-12T15:00:00Z', uploader: { id: 1, name: 'Marta Sintética', email: 'marta@example.invalid' } },
  { id: 2, version: 'v2', isActive: false, note: null, content: 'Texto de ejemplo de una versión anterior con un identificador_muy_largo_que_debe_partirse_sin_desbordar_la_pantalla_estrecha', createdAt: '2026-09-02T15:00:00Z', uploader: { id: 1, name: 'Marta Sintética', email: 'marta@example.invalid' } },
  { id: 1, version: 'v1', isActive: false, note: 'Primera versión (ejemplo)', content: 'Texto de ejemplo de la primera versión.', createdAt: '2026-08-14T15:00:00Z', uploader: { id: 1, name: 'Marta Sintética', email: 'marta@example.invalid' } },
]

async function open(browser, { width, lang, scheme, cpu = 1, mode = 'ok', delay = 0, activate = 'ok' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []; const calls = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  let list = versions()
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
    if (p === '/api/board/manifest') {
      if (delay) await new Promise(done => setTimeout(done, delay))
      if (method === 'GET') return mode === 'error' ? route.fulfill({ status: 500, json: { error: 'Falla sintética' } }) : route.fulfill({ json: mode === 'empty' ? [] : list })
      calls.push('POST'); list = [{ ...list[0], isActive: false }, ...list.slice(1)]; list.unshift({ id: 4, version: 'v4', isActive: true, note: null, content: 'Nuevo texto sintético '.repeat(5), createdAt: '2026-11-18T15:00:00Z', uploader: list[0].uploader })
      return route.fulfill({ status: 201, json: { version: 'v4' } })
    }
    if (/^\/api\/board\/manifest\/\d+\/activate$/.test(p)) {
      calls.push('PUT'); const id = Number(p.split('/')[4])
      if (activate === 'raw') return route.fulfill({ status: 500, json: { error: 'SequelizeDatabaseError: relation "EthicManifests" is locked' } })
      if (activate === 'lost-not-applied') return route.abort()
      list = list.map(v => ({ ...v, isActive: v.id === id }))
      if (activate === 'lost-applied') return route.abort()
      return route.fulfill({ json: { ok: true } })
    }
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/manifest', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors, calls }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 2).map(n => n.target.join('>')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href], main input, main textarea, dialog[open] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => (e.id || e.className || e.tagName) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 5))

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page, errors, calls } = await open(browser, { width, lang, scheme })
    await page.locator('.bm-ver').first().waitFor()
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea (${tag})`)
    report(await page.locator('.bm-active').count() === 1 && await page.locator('.bm-versions .bm-ver').count() === 3, `versión activa y tres versiones (${tag})`)
    let v = await axe(page); report(v.length === 0, `axe en 0, lista (${tag})`, v.join(','))
    report(await overflow(page) <= 0, `sin desborde horizontal (${tag})`)
    let small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
    // historial: expandir con teclado
    const head = page.locator('.bm-ver__head').nth(1); await head.focus(); await page.keyboard.press('Enter')
    report(await head.getAttribute('aria-expanded') === 'true' && await page.locator('#bm-v-2').count() === 1, `expandir con Enter: aria-expanded=true y contenido enlazado (${tag})`)
    await page.keyboard.press('Space'); report(await head.getAttribute('aria-expanded') === 'false', `colapsar con Espacio (${tag})`)
    // formulario: mínimo de 50 caracteres
    await page.locator('.bm-bar .cg-btn').first().click(); await page.locator('#bm-content').waitFor()
    report(await page.locator('.bm-bar .cg-btn').first().getAttribute('aria-expanded') === 'true', `«Nueva versión» con aria-expanded (${tag})`)
    await page.fill('#bm-content', 'Texto corto'); await page.locator('#bm-form .pg-actions .cg-btn').click(); await page.locator('#bm-content-err').waitFor()
    report(await page.evaluate(() => document.activeElement && document.activeElement.id === 'bm-content'), `error del mínimo en el campo y foco al campo (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, formulario con error (${tag})`, v.join(','))
    small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px en el formulario (${tag})`, small.join(','))
    await page.fill('#bm-content', 'Texto de ejemplo suficientemente largo para superar el mínimo de cincuenta caracteres del servidor.')
    await page.locator('#bm-form .pg-actions .cg-btn').click(); await page.locator('.bm-ok .cg-banner__title').waitFor()
    report(calls.includes('POST') && /v4/.test(await page.locator('.bm-ok').innerText()), `publicar: llamada y aviso con la versión (${tag})`)
    report(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('bm-ok')), `el foco pasa al aviso de resultado (${tag})`)
    // reactivar: diálogo
    await page.locator('.bm-roll .cg-btn').first().click(); await page.locator('dialog[open]').waitFor()
    report(await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim().length > 0 && document.activeElement.closest('dialog[open]') !== null && document.activeElement === document.querySelector('dialog[open] .cg-btn')), `el foco inicial del diálogo está en Cancelar (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, diálogo de reactivar (${tag})`, v.join(','))
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
    report(await page.evaluate(() => document.activeElement.closest('dialog[open]') !== null), `Tab queda dentro del diálogo (${tag})`)
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    report(await page.evaluate(() => document.activeElement && document.activeElement.closest('.bm-roll') !== null), `Esc cierra sin reactivar y el foco vuelve a «Reactivar» (${tag})`)
    report(!calls.includes('PUT'), `cancelar no llama al servidor (${tag})`)
    await page.locator('.bm-roll .cg-btn').first().click(); await page.locator('dialog[open]').waitFor()
    await page.locator('dialog[open] .cg-btn').last().click(); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    await page.waitForFunction(() => document.querySelector('.bm-ok') && document.activeElement === document.querySelector('.bm-ok'))
    report(calls.includes('PUT') && await page.locator('.bm-ok .cg-banner__title').count() === 1, `confirmar reactiva y el foco pasa al aviso (${tag})`)
    report(errors.length === 0, `sin errores de consola (${tag})`, errors.slice(0, 2).join(' | '))
    await ctx.close()
  }
  for (const [mode, label] of [['empty', 'vacío'], ['error', 'error de carga']]) for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, mode })
    await page.waitForTimeout(500)
    const v = await axe(page); report(v.length === 0, `axe en 0, ${label} (${scheme})`, v.join(','))
    report(label === 'vacío' ? await page.getByText('No hay versiones del manifiesto todavía.').count() === 1 : await page.locator('.cg-banner--error').count() === 1, `${label}: aviso visible (${scheme})`)
    await ctx.close()
  }
  // ES-349 seguimiento (E365-1..4): respuesta de «Reactivar» perdida (con y sin cambio en el servidor), error crudo del servidor, fechas con el idioma activo y chip ACTIVO solo en la versión vigente.
  for (const lang of ['es', 'en']) {
    const UNCONF = lang === 'es' ? /No pudimos confirmar si la versión se reactivó/ : /couldn't confirm whether the version was reactivated/
    const GENERIC = lang === 'es' ? 'No se pudo reactivar la versión.' : 'The version could not be reactivated.'
    for (const [activate, label] of [['lost-not-applied', 'respuesta perdida sin cambio'], ['lost-applied', 'respuesta perdida con cambio'], ['raw', 'error crudo del servidor']]) {
      const { ctx, page } = await open(browser, { width: 390, lang, scheme: 'light', activate })
      await page.locator('.bm-ver').first().waitFor()
      await page.locator('.bm-roll .cg-btn').first().click(); await page.locator('dialog[open]').waitFor()
      await page.locator('dialog[open] .cg-btn').last().click(); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      await page.waitForTimeout(600)
      const alertText = (await page.locator('.cg-banner--error').count()) ? await page.locator('.cg-banner--error').innerText() : ''
      const okText = (await page.locator('.bm-ok').count()) ? await page.locator('.bm-ok').innerText() : ''
      const activeNow = await page.locator('.bm-ver:has(.cg-chip)').locator('strong').first().innerText()
      if (activate === 'lost-not-applied') report(UNCONF.test(alertText) && !/Failed to fetch/.test(alertText) && activeNow === 'v3', `${label}: dice que no pudo confirmar, sin «Failed to fetch», y deja v3 como vigente (${lang})`)
      if (activate === 'lost-applied') report(/v2/.test(okText) && alertText === '' && activeNow === 'v2', `${label}: se relee, ve el cambio y confirma v2 (${lang})`)
      if (activate === 'raw') report(alertText.trim() === GENERIC && !/Sequelize/.test(alertText), `${label}: mensaje propio, sin texto técnico (${lang})`)
      await ctx.close()
    }
    const { ctx, page } = await open(browser, { width: 390, lang, scheme: 'light' })
    await page.locator('.bm-ver').first().waitFor()
    const dateText = await page.locator('.bm-active .cg-hint').first().innerText()
    report(lang === 'en' ? /Oct|October/.test(dateText) && !/oct\b/.test(dateText) : /oct/i.test(dateText), `fecha de la versión activa con el idioma activo: «${dateText.slice(0, 20)}» (${lang})`)
    report(await page.locator('.bm-ver .cg-chip').count() === 1 && await page.locator('.bm-ver:first-child .cg-chip').count() === 1, `chip ACTIVO solo en la versión vigente (${lang})`)
    await ctx.close()
  }
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4, delay: 700 })
    await page.locator('.bm-ver').first().waitFor(); await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} fallas` : '\nTodo OK')
  process.exit(failures ? 1 : 0)
})()
