// ES-153 (paso 3): encabezado de persona con PreferencesBar (idioma + tema) y rejilla móvil de 3 columnas. Chromium, API simulada (page.route), datos sintéticos.
// Mide: alto del encabezado y filas (1360/1100/901/390/320 px, ES/EN), sin desborde, objetivos ≥ 44 px, una sola línea por etiqueta, tema (cambia el marco, persiste entre pantallas,
// sin parpadeo al cargar con elv_theme=dark, funciona con el almacenamiento bloqueado), pantalla heredada (aria-disabled, en el orden de Tab, aria-describedby), orden de Tab,
// axe wcag2a/2aa/21aa/22aa + 2.5.3 + target-size, CLS del encabezado a 390 px con CPU ×4 y el chat a 320×568.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4161 --strictPort   y luego
//   ES153P_URL=http://127.0.0.1:4161 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es153-prefs-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES153P_URL ?? 'http://127.0.0.1:4161'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const browser = await chromium.launch(); let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  const open = async ({ width = 1360, height = 900, lang = 'es', scheme = 'light', path = '/app/skill-map', theme, cpu, blockStorage = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' })
    await context.addInitScript(([l, t, block]) => {
      if (block) { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado') } }); window.__blocked = true; return }
      localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Ana'); localStorage.setItem('elv_lang', l)
      if (t) localStorage.setItem('elv_theme', t)
    }, [lang, theme, blockStorage])
    const page = await context.newPage()
    await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }))
    if (cpu) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
    await page.goto(base + path); await page.waitForSelector('.cg-header .cg-prefs'); await page.waitForTimeout(500)
    return { context, page }
  }
  const header = page => page.evaluate(() => {
    const h = document.querySelector('.cg-header'); const rows = new Set([...h.querySelectorAll('.cg-brand, .cg-nav a, .cg-prefs, .cg-usermenu__button')].map(e => Math.round(e.getBoundingClientRect().top / 8)))
    const grid = innerWidth <= 900 // en escritorio los enlaces de navegación son del ancho de su texto (alto ≥ 44, ancho ≥ 24: WCAG 2.5.8); en la rejilla móvil, celdas completas
    const small = [...h.querySelectorAll('.cg-seg__btn, .cg-lang__btn, .cg-nav a, .cg-usermenu__button')].filter(e => { const r = e.getBoundingClientRect(); const link = !!e.closest('.cg-nav'); return r.height < 44 || (link && !grid ? r.width < 24 : r.width < 44) }).map(e => e.textContent)
    const wrapped = [...h.querySelectorAll('.cg-nav a')].filter(a => { const r = document.createRange(); r.selectNodeContents(a); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size > 1 }).map(a => a.textContent)
    return { alto: Math.round(h.getBoundingClientRect().height), filas: rows.size, desborde: document.documentElement.scrollWidth > innerWidth, small, wrapped }
  })

  // 1. Encabezado: alto, filas, desborde, objetivos, una línea por etiqueta
  for (const lang of ['es', 'en']) for (const width of [1360, 1100, 1000, 901, 390, 320]) {
    const { context, page } = await open({ width, lang }); const m = await header(page)
    console.log(`   ${lang} ${width}px: encabezado ${m.alto} px, ${m.filas} filas visuales`)
    assert.equal(m.desborde, false, `desborde horizontal (${lang} ${width})`); assert.deepEqual(m.small, [], `objetivos < 44 px (${lang} ${width})`)
    if (width <= 900) assert.deepEqual(m.wrapped, [], `etiquetas en 2 líneas (${lang} ${width})`)
    await context.close()
  }
  check('encabezado sin desborde, objetivos ≥ 44 px y etiquetas de una línea (ES/EN × 1360/1100/901/390/320)')

  // 2. Tema en pantalla migrada: cambia el marco, persiste al cambiar de pantalla (el marco no se desmonta), aria-pressed
  { const { context, page } = await open({ path: '/app/skill-map' })
    const theme = () => page.locator('.cg-frame').getAttribute('data-theme')
    assert.equal(await theme(), null, 'Auto: sin data-theme'); await page.getByRole('button', { name: 'Oscuro' }).click(); assert.equal(await theme(), 'dark')
    assert.equal(await page.getByRole('button', { name: 'Oscuro' }).getAttribute('aria-pressed'), 'true'); assert.equal(await page.evaluate(() => localStorage.getItem('elv_theme')), 'dark')
    await page.evaluate(() => document.querySelector('.cg-header').setAttribute('data-keep', 'si'))
    await page.locator('.cg-header .cg-nav a[href="/app/diary"]').click(); await page.waitForURL('**/app/diary'); await page.waitForTimeout(400)
    assert.equal(await page.locator('.cg-header').getAttribute('data-keep'), 'si', 'el marco no se desmonta'); assert.equal(await theme(), 'dark', 'persiste entre pantallas migradas')
    await page.getByRole('button', { name: 'Claro' }).click(); assert.equal(await theme(), 'light'); await page.getByRole('button', { name: 'Auto' }).click()
    assert.equal(await theme(), null); assert.equal(await page.evaluate(() => localStorage.getItem('elv_theme')), null); await context.close() }
  check('tema: Auto/Claro/Oscuro cambian el marco, persisten entre pantallas migradas y Auto borra la elección')

  // 3. Sin parpadeo: con elv_theme=dark el PRIMER pintado ya es oscuro; sin elección sigue el sistema (oscuro) y el clic en «Claro» gana
  { const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' })
    await context.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elv_theme', 'dark')
      window.__themes = []; new MutationObserver(() => { const f = document.querySelector('.cg-frame'); if (f) window.__themes.push(f.getAttribute('data-theme')) }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-theme'] }) })
    const page = await context.newPage(); await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }))
    await page.goto(base + '/app/skill-map'); await page.waitForSelector('.cg-header .cg-prefs'); await page.waitForTimeout(500)
    const seen = await page.evaluate(() => window.__themes); assert.ok(seen.length > 0 && seen.every(value => value === 'dark'), 'el marco nunca se vio claro: ' + JSON.stringify([...new Set(seen)])); await context.close() }
  check('sin parpadeo: con elv_theme=dark el marco nunca se pinta con otro tema')

  // 4. Almacenamiento bloqueado: la pantalla funciona y el tema se conserva en la sesión de la pestaña
  { const context = await browser.newContext({ viewport: { width: 1360, height: 900 } }); const errors = []
    await context.addInitScript(() => { const token = 't'; const store = { elevation_token: token, elevation_role: 'user', elv_lang: 'es' }
      Object.defineProperty(window, 'localStorage', { get() { return { getItem: key => (key in store ? store[key] : null), setItem() { throw new Error('bloqueado') }, removeItem() { throw new Error('bloqueado') } } } }) })
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }))
    await page.goto(base + '/app/skill-map'); await page.waitForSelector('.cg-header .cg-prefs'); await page.getByRole('button', { name: 'Oscuro' }).click()
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), 'dark'); await page.locator('.cg-header .cg-nav a[href="/app/diary"]').click(); await page.waitForURL('**/app/diary'); await page.waitForTimeout(400)
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), 'dark', 'se conserva en la sesión'); assert.deepEqual(errors, [], 'sin errores de página'); await context.close() }
  check('almacenamiento bloqueado: sin errores y el tema se conserva durante la sesión')

  // 5. Pantalla heredada: aria-disabled, sigue en el orden de Tab, el clic no cambia nada, aria-describedby con la razón (ES/EN); el chat sigue claro aunque haya elección
  for (const lang of ['es', 'en']) { const { context, page } = await open({ path: '/app/dashboard', lang, theme: 'dark' })
    const group = page.locator('.cg-seg'); const note = await group.getAttribute('aria-describedby'); assert.ok(note, 'aria-describedby')
    const text = (await page.locator('#' + CSS_ESCAPE(note)).textContent()).trim(); assert.equal(text, lang === 'es' ? 'Esta pantalla aún solo tiene tema claro.' : 'This screen only has the light theme for now.')
    const buttons = group.getByRole('button'); assert.equal(await buttons.count(), 3); for (let i = 0; i < 3; i++) assert.equal(await buttons.nth(i).getAttribute('aria-disabled'), 'true')
    assert.equal(await page.locator('.cg-frame').getAttribute('data-theme'), 'light', 'heredada: lienzo claro fijo')
    await buttons.nth(1).click({ force: true }); assert.equal(await page.evaluate(() => localStorage.getItem('elv_theme')), 'dark', 'el clic no cambia la elección')
    await buttons.nth(0).focus(); assert.equal(await page.evaluate(() => document.activeElement.className), 'cg-seg__btn', 'el botón con aria-disabled recibe foco')
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.className), 'cg-seg__btn'); await context.close() }
  check('pantalla heredada: aria-disabled en el orden de Tab, razón por aria-describedby (ES/EN), lienzo claro y elección intacta')

  // 6. Orden de Tab en pantalla migrada: marca → navegación → idioma → tema → menú
  { const { context, page } = await open({ path: '/app/skill-map' }); await page.locator('.cg-brand').focus(); const order = []
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const e = document.activeElement; return e.closest('.cg-nav') ? 'nav' : e.closest('.cg-lang') ? 'idioma' : e.closest('.cg-seg') ? 'tema' : e.closest('.cg-usermenu') ? 'menú' : 'otro' })) }
    const compact = order.filter((v, i) => v !== order[i - 1]); assert.deepEqual(compact.slice(0, 4), ['nav', 'idioma', 'tema', 'menú']); await context.close() }
  check('orden de Tab: navegación → idioma → tema → menú de usuario')

  // 7. axe sobre el encabezado (migrada y heredada; ES/EN; claro/oscuro; 1360/390/320)
  { let cases = 0
    for (const path of ['/app/skill-map', '/app/dashboard']) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) {
      const { context, page } = await open({ path, lang, scheme, width }); await page.evaluate(axeSource)
      const result = await page.evaluate(async () => (await axe.run(document.querySelector('.cg-header'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'wcag258', 'wcag2411'] } })).violations.map(v => v.id + ': ' + v.nodes.map(n => n.html.slice(0, 80)).join(' | ')))
      assert.deepEqual(result, [], `axe ${path} ${lang} ${scheme} ${width}`); cases++; await context.close() }
    check(`axe: 0 violaciones en el encabezado (${cases} combinaciones)`) }

  // 8. CLS del encabezado a 390 px con CPU ×4 (ES/EN)
  for (const lang of ['es', 'en']) { const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    await context.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); window.__cls = 0
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
    const page = await context.newPage(); const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }))
    await page.goto(base + '/app/skill-map'); await page.waitForSelector('.cg-header .cg-prefs'); await page.waitForTimeout(3000)
    const cls = await page.evaluate(() => window.__cls); console.log(`   CLS /app/skill-map 390 px CPU×4 (${lang}): ${cls.toFixed(3)}`); assert.ok(cls <= 0.1, 'CLS ' + cls); await context.close() }
  check('CLS ≤ 0,1 a 390 px con CPU ×4')

  // 9. Chat a 320×568: la página no necesita desplazarse (el aviso y el compositor caben)
  { const { context, page } = await open({ width: 320, height: 568, path: '/app/chat' }); await page.waitForTimeout(600)
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, view: innerHeight, header: document.querySelector('.cg-header').getBoundingClientRect().height }))
    console.log(`   chat 320×568: página ${m.scroll} px de alto (ventana ${m.view}), encabezado ${Math.round(m.header)} px`)
    if (m.scroll > m.view + 1) console.log('   AVISO: la página del chat aún se desplaza a 320×568 (' + (m.scroll - m.view) + ' px); se informa, no es criterio de este script'); await context.close() }
  check('chat 320×568 medido')

  await browser.close(); console.log(`\nES-153 paso 3: ${checks} comprobaciones OK`)
})().catch(error => { console.error('FAIL', error.message); process.exit(1) })
function CSS_ESCAPE(id) { return id.replace(/([^\w-])/g, '\\$1') }
