// ES-359 (PR3): cabecera móvil de 56 px y cajón de navegación. Chromium, API simulada, DATOS SINTÉTICOS. Evidencia (no corre en CI).
// Por ES/EN × claro/oscuro × 390/320 (persona): cabecera ≤ 60 px con marca y «☰ Menú» (≥ 46×46, aria-haspopup, aria-expanded); sin idioma/tema/nombre sueltos; el cajón abre (role dialog modal),
// el foco entra, Tab queda atrapado, Esc cierra y el foco vuelve al botón, el velo cierra, el fondo no se desplaza; trae Principal (5), «Menú de usuario» (11), Preferencias (idioma y tema con ✓) y «Cerrar sesión» fijo;
// sin desborde; axe wcag2a/2aa/21a/21aa/22aa = 0 cerrado y abierto. A 1360 px no hay botón «Menú» y sigue el encabezado con el menú de cuenta. CLS a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-cj && npx vite preview --outDir dist-cj --host 127.0.0.1 --port 4360 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4360 node scripts/es359-cajon.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4360'
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const T = { es: { menu: 'Menú', close: 'Cerrar', out: 'Cerrar sesión', prefs: 'Preferencias', main: 'Principal', user: 'Menú de usuario' }, en: { menu: 'Menu', close: 'Close', out: 'Sign out', prefs: 'Preferences', main: 'Main', user: 'User menu' } }
async function setup(browser, { lang, width, scheme, cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(([l, s]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Ana Ejemplo (sintética)'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang, scheme])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
    if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    return r.fulfill({ json: [] }) })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/app/feedback', { waitUntil: 'networkidle' }); await page.locator('h1').first().waitFor({ timeout: 10000 }); await page.waitForTimeout(400)
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length)) }
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [390, 320]) {
    const t = T[lang]; const tag = `${lang} ${scheme} ${width}px`; const { ctx, page, errors } = await setup(browser, { lang, width, scheme })
    const h = await page.evaluate(() => { const hd = document.querySelector('header.cg-header'), b = document.querySelector('.cg-menubtn'), r = b.getBoundingClientRect()
      return { height: Math.round(hd.getBoundingClientRect().height), btn: [Math.round(r.width), Math.round(r.height)], popup: b.getAttribute('aria-haspopup'), expanded: b.getAttribute('aria-expanded'), text: b.textContent.replace(/\s+/g, ' ').trim(), loose: hd.querySelectorAll('.cg-lang, .cg-seg, .cg-usermenu, .cg-name').length, overX: document.documentElement.scrollWidth - innerWidth } })
    check(h.height <= 60, `${tag}: cabecera ≤ 60 px (${h.height})`); check(h.btn[0] >= 46 && h.btn[1] >= 46, `${tag}: botón ≥ 46×46 (${h.btn})`); check(h.popup === 'dialog' && h.expanded === 'false', `${tag}: aria-haspopup/aria-expanded`)
    const icon = await page.evaluate(() => getComputedStyle(document.querySelector('.cg-menubtn__icon'), '::before').content)
    check(icon === '"' + String.fromCharCode(0x2630) + '"', `${tag}: el icono dibuja ☰ (contenido calculado ${icon})`)
    check(h.text.endsWith(t.menu), `${tag}: «☰ ${t.menu}» (${h.text})`); check(h.loose === 0, `${tag}: sin idioma, tema ni nombre sueltos en la cabecera`); check(h.overX <= 0, `${tag}: sin desborde`)
    let v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón cerrado ${v}`)
    await page.locator('.cg-menubtn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.waitForTimeout(200)
    const d = await page.evaluate(() => { const dl = document.querySelector('dialog.cg-drawer[open]'), body = dl.querySelector('.cg-drawer__body'), foot = dl.querySelector('.cg-drawer__foot').getBoundingClientRect()
      return { focusIn: dl.contains(document.activeElement), heads: [...dl.querySelectorAll('.cg-drawer__h')].map(e => e.textContent.trim()), groups: [...dl.querySelectorAll('nav.cg-drawer__list')].map(n => n.querySelectorAll('a').length), current: dl.querySelectorAll('[aria-current=page]').length,
        pressed: dl.querySelectorAll('.cg-lang__btn[aria-pressed=true], .cg-seg__btn[aria-pressed=true]').length, outText: dl.querySelector('.cg-drawer__foot button').textContent.trim(), footBottom: Math.round(foot.bottom), lock: document.documentElement.classList.contains('cg-scroll-lock'),
        expanded: document.querySelector('.cg-menubtn').getAttribute('aria-expanded'), overX: document.documentElement.scrollWidth - innerWidth, bodyX: body.scrollWidth - body.clientWidth, width: Math.round(dl.getBoundingClientRect().width) } })
    check(d.focusIn, `${tag}: el foco entra al cajón`); check(d.groups[0] === 5 && d.groups[1] === 11, `${tag}: Principal 5 y Menú de usuario 11 enlaces (${d.groups})`); check(d.heads.includes(t.user) && d.heads.includes(t.prefs), `${tag}: títulos de grupo (${d.heads})`)
    check(d.pressed === 2, `${tag}: idioma y tema con selección (${d.pressed})`); check(d.outText === t.out, `${tag}: pie «${t.out}»`); check(d.footBottom <= 800, `${tag}: el pie queda a la vista`); check(d.lock, `${tag}: el fondo no se desplaza`)
    check(d.overX <= 0 && d.bodyX <= 0, `${tag}: sin desborde con el cajón abierto`); check(d.width <= Math.round(width * 0.92) + 1, `${tag}: ancho del cajón ${d.width}`)
    v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón abierto ${v}`)
    // Tab atrapado: desde «Cerrar» hacia atrás cae dentro del cajón y no sale a la página
    await page.locator('.cg-drawer__head button').focus(); for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
    check(await page.evaluate(() => document.querySelector('dialog.cg-drawer[open]').contains(document.activeElement)), `${tag}: Tab queda atrapado`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    check(await page.locator('dialog.cg-drawer[open]').count() === 0, `${tag}: Esc cierra`); check(await page.evaluate(() => document.activeElement.className === 'cg-menubtn'), `${tag}: el foco vuelve a «${t.menu}»`)
    check(await page.evaluate(() => !document.documentElement.classList.contains('cg-scroll-lock')), `${tag}: el fondo vuelve a desplazarse`)
    await page.locator('.cg-menubtn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.mouse.click(width - 4, 400); await page.waitForTimeout(200)
    check(await page.locator('dialog.cg-drawer[open]').count() === 0, `${tag}: clic en el velo cierra`)
    await page.locator('.cg-menubtn').click(); await page.locator('.cg-drawer__list a').nth(1).click(); await page.waitForTimeout(500)
    check(await page.locator('dialog.cg-drawer[open]').count() === 0, `${tag}: elegir un enlace cierra el cajón`)
    check(errors.length === 0, `${tag}: sin errores de JS ${errors.slice(0, 1)}`); await ctx.close()
  }
  { const { ctx, page } = await setup(browser, { lang: 'es', width: 1360, scheme: 'light' })
    check(await page.locator('.cg-menubtn').count() === 0, '1360: no hay botón «Menú» (escritorio)'); check(await page.locator('.cg-usermenu__button').count() === 1, '1360: sigue el menú de cuenta'); await ctx.close() }
  const values = []
  for (let i = 0; i < 6; i++) { const { ctx, page } = await setup(browser, { lang: 'es', width: 390, scheme: 'light', cpu: 4 }); await page.waitForTimeout(500); values.push(await page.evaluate(() => window.__cls)); await ctx.close() }
  values.sort((a, b) => a - b); console.log(`CLS 390px CPU×4 (6 corridas): mediana=${values[3].toFixed(4)} máx=${values[5].toFixed(4)}`)
  await browser.close(); console.log(failures ? `\n${failures} FALLAS de ${total}` : `\n${total}/${total} comprobaciones OK`); process.exit(failures ? 1 : 0)
})()
