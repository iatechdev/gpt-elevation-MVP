// ES-359 (PR 1): menú de cuenta del marco global. Chromium, API simulada con DATOS SINTÉTICOS (sin datos reales ni IA).
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4118 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4118 node scripts/es359-menu-cuenta.cjs
// Por idioma (ES/EN) × 390/1360 × claro/oscuro: botón con etiqueta visible «Menú de usuario»; idioma y tema SOLO dentro del panel (no sueltos en el encabezado);
// Enter abre, Escape cierra y devuelve el foco, Tab fuera y clic fuera cierran; el panel trae nombre, rol, «Mis datos», Preferencias y «Cerrar sesión»; cambiar idioma y tema desde
// el panel funciona; «Cerrar sesión» revoca y vuelve al inicio; axe wcag2a/2aa/21a/21aa/22aa = 0 con el panel cerrado y abierto; sin desborde horizontal; CLS a 390 px con CPU ×4.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4118'
const QUICK = process.env.QUICK === '1'
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const T = { es: { menu: 'Menú de usuario', data: 'Mis datos', out: 'Cerrar sesión', prefs: 'Preferencias', role: 'Persona', lang: 'Idioma', theme: 'Tema' }, en: { menu: 'User menu', data: 'My data', out: 'Sign out', prefs: 'Preferences', role: 'Person', lang: 'Language', theme: 'Theme' } }

async function setup(browser, { lang, width, scheme, role = 'user' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const calls = []
  await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/user/progress') return route.fulfill({ json: { moodLogs: [] } })
    if (p === '/api/sessions/user/upcoming') return route.fulfill({ json: { session: null } })
    if (p === '/api/sessions/user/my-therapist') return route.fulfill({ json: { therapist: null } })
    if (p === '/api/recommendations') return route.fulfill({ json: [] })
    if (p === '/api/user/plan/me') return route.fulfill({ json: { plan: null, limits: null } })
    if (/logout/.test(p)) { calls.push(route.request().method() + ' ' + p); return route.fulfill({ json: { ok: true } }) }
    return route.fulfill({ json: [] }) })
  await page.addInitScript(([l, r]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'Ana Ejemplo (sintética)'); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_checkin_date', new Date().toDateString()) }, [lang, role])
  return { ctx, page, calls }
}
const axeRun = async (page, exclude) => { await page.addScriptTag({ content: axeSource }); return page.evaluate(ex => axe.run(ex ? { exclude: [[ex]] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes[0].target.join(' '))), exclude) }
const panelOpen = page => page.evaluate(() => { const l = document.querySelector('.cg-usermenu__list'); return !!l && !l.hidden })
const activeIs = (page, sel) => page.evaluate(s => document.activeElement === document.querySelector(s), sel)

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of QUICK ? [390] : [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang], tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, calls } = await setup(browser, { lang, width, scheme })
    await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
    // Botón con etiqueta visible; idioma y tema no sueltos en el encabezado.
    const btn = page.locator('.cg-usermenu__button')
    check((await btn.innerText()).trim().toLowerCase().startsWith(t.menu.toLowerCase()), `${tag}: el botón dice «${t.menu}»`)
    const header = await page.evaluate(() => ({ looseLang: [...document.querySelectorAll('.cg-header .cg-lang, .cg-header .cg-seg')].filter(e => !e.closest('.cg-usermenu__list') && e.offsetParent !== null).length, nameInButton: /Ana/.test(document.querySelector('.cg-usermenu__button').textContent) }))
    check(header.looseLang === 0 && !header.nameInButton, `${tag}: idioma y tema no van sueltos y el nombre no es el botón (${JSON.stringify(header)})`)
    check(!(await panelOpen(page)), `${tag}: el panel empieza cerrado`)
    const axeClosed = await axeRun(page); check(axeClosed.length === 0, `${tag}: axe cerrado = [${axeClosed}]`)
    // Enter abre.
    await btn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    check(await panelOpen(page), `${tag}: Enter abre`)
    const panel = await page.evaluate(() => { const l = document.querySelector('.cg-usermenu__list'); return { text: l.innerText, links: [...l.querySelectorAll('a')].map(a => a.textContent.trim()), buttons: [...l.querySelectorAll('button')].map(b => b.textContent.trim()), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, rect: (() => { const b = l.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)] })() } })
    check(/Ana Ejemplo/i.test(panel.text) && panel.text.toLowerCase().includes(t.role.toLowerCase()), `${tag}: nombre y rol «${t.role}» en el panel`)
    check(panel.links.includes(t.data) && panel.buttons.includes(t.out), `${tag}: «${t.data}» y «${t.out}» a la vista (${panel.links.length} enlaces)`)
    const low = panel.text.toLowerCase(); check(low.includes(t.prefs.toLowerCase()) && low.includes(t.lang.toLowerCase()) && low.includes(t.theme.toLowerCase()), `${tag}: Preferencias con idioma y tema`)
    check(panel.overflow <= 0 && panel.rect[0] >= 0 && panel.rect[1] <= width, `${tag}: el panel cabe en la pantalla (${panel.rect})`)
    const axeOpen = await axeRun(page); check(axeOpen.length === 0, `${tag}: axe abierto = [${axeOpen}]`)
    // Escape cierra y devuelve el foco.
    await page.keyboard.press('Escape'); await page.waitForTimeout(100)
    check(!(await panelOpen(page)) && await activeIs(page, '.cg-usermenu__button'), `${tag}: Escape cierra y devuelve el foco al botón`)
    // Tab fuera cierra.
    await btn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(100)
    await page.locator('.cg-usermenu__out').focus(); await page.keyboard.press('Tab'); await page.waitForTimeout(150)
    check(!(await panelOpen(page)), `${tag}: Tab fuera del panel lo cierra`)
    // Clic fuera cierra.
    await btn.click(); await page.waitForTimeout(100); await page.mouse.click(5, 400); await page.waitForTimeout(150)
    check(!(await panelOpen(page)), `${tag}: un clic fuera lo cierra`)
    // Cambiar idioma y tema desde el panel.
    await btn.click(); await page.waitForTimeout(100)
    const other = lang === 'es' ? 'en' : 'es'
    await page.locator(`.cg-usermenu__list .cg-lang__btn[lang="${other}"]`).click(); await page.waitForTimeout(300)
    check(await page.evaluate(o => document.documentElement.lang === o, other), `${tag}: el idioma cambia desde el panel`)
    await page.locator(`.cg-usermenu__list .cg-lang__btn[lang="${lang}"]`).click(); await page.waitForTimeout(200)
    const themeBefore = await page.evaluate(() => [...document.querySelectorAll('.cg-usermenu__list .cg-seg__btn')].map(b => b.getAttribute('aria-pressed') + (b.getAttribute('aria-disabled') ? 'd' : '')))
    check(themeBefore.length === 3 && themeBefore.filter(x => x.startsWith('true')).length === 1, `${tag}: tema con una opción activa (${themeBefore})`)
    // Cerrar sesión: en «Mi panel» abre primero la despedida (guardia del panel, ES-329) y no cierra directo; en otra pantalla sin borradores revoca y vuelve al inicio.
    await page.locator('.cg-usermenu__out').click(); await page.waitForTimeout(500)
    check(await page.evaluate(() => !!document.querySelector('dialog[open]')) && new URL(page.url()).pathname === '/app/dashboard', `${tag}: en Mi panel «${t.out}» abre la despedida y no cierra directo`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    await page.goto(BASE + '/app/plan', { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
    await page.locator('.cg-usermenu__button').click(); await page.locator('.cg-usermenu__out').click(); await page.waitForTimeout(900)
    check(new URL(page.url()).pathname === '/' && calls.length >= 1, `${tag}: «${t.out}» cierra la sesión y vuelve al inicio (${new URL(page.url()).pathname}; ${calls})`)
    await ctx.close()
  }
  // Los otros tres marcos usan el MISMO componente: el menú abre, trae el rol y no rompe axe ni el ancho (ES/EN × 390/1360).
  for (const [role, route] of [['admin', '/admin/users'], ['superadmin', '/admin/users'], ['therapist', '/therapist/patient/1'], ['board', '/manifiesto']]) for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const tag = `${role} ${lang} ${width}px`
    const { ctx, page } = await setup(browser, { lang, width, scheme: 'light', role })
    await page.goto(BASE + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(500)
    const btn = page.locator('.cg-usermenu__button')
    check(await btn.count() === 1, `${tag}: un solo botón de menú de cuenta`)
    await btn.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150)
    const info = await page.evaluate(() => { const l = document.querySelector('.cg-usermenu__list'); return { open: !!l && !l.hidden, text: l ? l.innerText.toLowerCase() : '', overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, oldOut: document.querySelectorAll('.cg-signout').length } })
    check(info.open && info.oldOut === 0 && info.overflow <= 0, `${tag}: abre, sin el botón de salir antiguo y sin desborde (abierto=${info.open}, antiguo=${info.oldOut}, desborde=${info.overflow})`)
    check(/cerrar sesión|sign out/.test(info.text) && /preferencias|preferences/.test(info.text), `${tag}: Preferencias y «Cerrar sesión» dentro`)
    check(/mis datos|my data/.test(info.text), `${tag}: «Mis datos» en el menú de cuenta (≤ 2 acciones para todos los roles)`)
    // El panel es flotante y tapa parte del contenido (axe lo cuenta como «objetivo parcialmente cubierto» de lo que queda debajo): con el panel abierto se mide el marco sin <main>; la página completa se mide con el panel cerrado.
    const axeRoles = await axeRun(page, 'main'); await btn.focus(); await page.keyboard.press('Escape'); const axePage = await axeRun(page); check(axeRoles.length === 0 && axePage.length === 0, `${tag}: axe = [${axeRoles}]`)
    await ctx.close()
  }
  // CLS a 390 px con CPU ×4 (10 corridas) del Inicio con el nuevo encabezado.
  if (!QUICK) {
    const values = []
    for (let i = 0; i < 10; i++) {
      const { ctx, page } = await setup(browser, { lang: 'es', width: 390, scheme: 'light' })
      const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
      await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000)
      values.push(await page.evaluate(() => window.__cls)); await ctx.close()
    }
    values.sort((a, b) => a - b)
    console.log(`CLS 390px CPU×4: mediana=${values[5].toFixed(4)} máx=${values[9].toFixed(4)}`)
  }
  await browser.close()
  console.log(`${total - failures}/${total} comprobaciones OK`)
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
