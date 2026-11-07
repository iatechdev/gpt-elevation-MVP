// ES-153: verificación en navegador real de los marcos por rol y la compuerta de acceso (no corre en CI; evidencia del PR).
// El servidor se simula con page.route: /api/session devuelve el rol de la prueba y el resto de /api responde 404 (se mira el marco, no el contenido).
// Uso: `npx vite preview --port 5299` y luego
//   PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<ruta a axe.min.js> BASE=http://localhost:5299 SHOTS=<carpeta> node scripts/es153-browser-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const SHOTS = process.env.SHOTS
let failures = 0
const log = (name, ok, extra = '') => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${name} ${extra}`) }

async function open(browser, { role, lang = 'es', width = 1360, session = 'ok' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  const calls = []
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    calls.push(`${route.request().method()} ${url.pathname}`)
    if (url.pathname === '/api/session') {
      if (session === 'invalid') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"session_invalid"}' })
      if (session === 'down') return route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"session_unavailable"}' })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role, onboardingCompleted: true }) })
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"synthetic"}' })
  })
  await page.addInitScript(([r, l]) => {
    localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789')
    // El rol guardado en el navegador puede estar manipulado: la compuerta no debe fiarse de él.
    localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elevation_name', 'Synthetic QA')
  }, [role, lang])
  return { ctx, page, calls }
}

// El marco (encabezado, barra lateral, pie, saltar al contenido, compuerta) debe pasar axe sin violaciones. El contenido de las pantallas antiguas
// (dentro de #main en páginas aún no migradas) está fuera de alcance: sus hallazgos se informan como INFO y no fallan el chequeo.
async function axeCheck(page, tag) {
  await page.addScriptTag({ content: axeSource })
  const result = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }).then(r => r.violations.map(v => ({
    id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target.join(' '), content: !!document.querySelector(n.target.join(' '))?.closest('main.cg-main:not(.cg-gate)') && !document.querySelector('.cg-gate') })),
  }))))
  const frame = [], content = []
  for (const v of result) for (const n of v.nodes) (n.content ? content : frame).push(`${v.id}(${v.impact}): ${n.target}`)
  log(`${tag} axe WCAG 2 A/AA en el marco sin violaciones`, frame.length === 0, frame.join(' || ').slice(0, 300))
  if (content.length) console.log(`INFO  ${tag} contenido antiguo (fuera de alcance): ${content.length} hallazgo(s) p. ej. ${content[0].slice(0, 120)}`)
}

const noAccessVisible = page => page.getByText(/Tu rol no tiene acceso a esta pantalla\.|Your role does not have access to this screen\./).count().then(n => n > 0)

;(async () => {
  const browser = await chromium.launch()

  // 1. Matriz rol × URL (el rol guardado en el navegador es «superadmin» a propósito en todas)
  const cases = [
    ['user', '/app/chat', true], ['user', '/admin/dashboard', false], ['user', '/therapist/dashboard', false], ['user', '/board/manifest', false],
    ['therapist', '/therapist/dashboard', true], ['therapist', '/admin/dashboard', false], ['therapist', '/app/chat', false],
    ['admin', '/admin/dashboard', true], ['admin', '/admin/users', false], ['admin', '/admin/manifest', false], ['admin', '/therapist/dashboard', false], ['admin', '/board/manifest', false],
    ['superadmin', '/admin/users', true], ['superadmin', '/admin/manifest', true], ['superadmin', '/board/manifest', true], ['superadmin', '/app/chat', false],
    ['board', '/board/manifest', true], ['board', '/admin/dashboard', false], ['board', '/admin/manifest', false],
    ['user', '/app/data', true], ['admin', '/app/data', true],
  ]
  for (const [role, path, allowed] of cases) {
    const { ctx, page } = await open(browser, { role })
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(250)
    const denied = await noAccessVisible(page)
    log(`matriz ${role} → ${path}`, allowed ? !denied && !page.url().includes('/login') : denied && page.url().endsWith(path), `url=${new URL(page.url()).pathname}`)
    await ctx.close()
  }

  // 2. Sesión vencida y servidor caído
  { const { ctx, page } = await open(browser, { role: 'admin', session: 'invalid' })
    await page.goto(BASE + '/admin/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
    log('sesión vencida (401) → /login y token borrado', page.url().includes('/login') && (await page.evaluate(() => localStorage.getItem('elevation_token'))) === null)
    await ctx.close() }
  { const { ctx, page } = await open(browser, { role: 'admin', session: 'down' })
    await page.goto(BASE + '/admin/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
    log('servidor caído (503) → aviso con «Reintentar», sin contenido', (await page.getByRole('button', { name: 'Reintentar' }).count()) === 1 && (await page.locator('.cg-sidenav').count()) === 0)
    await axeCheck(page, 'servidor caído')
    await ctx.close() }

  // 3. Marcos: estructura, teclado, 390 px y axe en ES/EN
  const frames = [
    ['admin', '/admin/dashboard', { 'Panel': 1, 'Guías de la IA': 1, 'Personas usuarias': 0, 'Manifiesto ético': 0 }],
    ['superadmin', '/admin/dashboard', { 'Personas usuarias': 1, 'Manifiesto ético': 1 }],
    ['board', '/board/manifest', { 'Manifiesto ético': 1, 'Guías de la IA': 0 }],
    ['therapist', '/therapist/dashboard', { 'Panel': 1, 'Personas en facilitación': 1, 'Guías de la IA': 0 }],
  ]
  for (const [role, path, expected] of frames) {
    for (const lang of ['es', 'en']) {
      for (const width of [1360, 390]) {
        const tag = `${role}/${lang}/${width}px`
        const { ctx, page } = await open(browser, { role, lang, width })
        await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForSelector('.cg-frame')
        if (lang === 'es') for (const [label, count] of Object.entries(expected)) log(`${tag} enlace «${label}» ×${count}`, (await page.locator('.cg-frame a', { hasText: new RegExp(`^${label}$`) }).count()) === count)
        log(`${tag} un solo main y enlace «Saltar al contenido»`, (await page.locator('main').count()) === 1 && (await page.locator('a.cg-skip[href="#main"]').count()) === 1)
        log(`${tag} ruta activa con aria-current`, (await page.locator('.cg-frame a[aria-current="page"]').count()) >= 1)
        log(`${tag} pie con aviso`, /terapia|therapy/.test(await page.locator('footer.cg-footer').innerText()))
        log(`${tag} sin desplazamiento horizontal`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= width)
        const small = await page.evaluate(() => [...document.querySelectorAll('.cg-header a, .cg-header button, .cg-sidenav a')].filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 43.5 }).map(el => el.textContent.trim() + ' h=' + Math.round(el.getBoundingClientRect().height)))
        log(`${tag} objetivos táctiles ≥ 44 px`, small.length === 0, small.slice(0, 3).join(' | '))
        await axeCheck(page, tag)
        if (SHOTS && lang === 'es') await page.screenshot({ path: `${SHOTS}/es153-${role}-${width}.png`, fullPage: true })
        await ctx.close()
      }
    }
  }

  // 4. Foco al cambiar de ruta y menú de usuario con teclado
  { const { ctx, page } = await open(browser, { role: 'superadmin' })
    await page.goto(BASE + '/admin/dashboard', { waitUntil: 'networkidle' }); await page.waitForSelector('.cg-sidenav')
    await page.locator('.cg-sidenav a', { hasText: 'Métricas' }).click(); await page.waitForURL('**/admin/metrics')
    await page.waitForTimeout(150)
    log('foco al <main> al cambiar de ruta', await page.evaluate(() => document.activeElement?.id === 'main'))
    await page.locator('a.cg-skip').focus(); await page.keyboard.press('Enter')
    log('«Saltar al contenido» lleva el foco al main', await page.evaluate(() => document.activeElement?.id === 'main'))
    await ctx.close() }
  { const { ctx, page } = await open(browser, { role: 'therapist' })
    await page.goto(BASE + '/therapist/dashboard', { waitUntil: 'networkidle' }); await page.waitForSelector('.cg-usermenu')
    const button = page.locator('.cg-usermenu__button')
    log('menú de usuario: cerrado al inicio', (await button.getAttribute('aria-expanded')) === 'false' && !(await page.locator('.cg-usermenu__list').isVisible()))
    await button.focus(); await page.keyboard.press('Enter')
    log('menú de usuario: Enter lo abre', (await button.getAttribute('aria-expanded')) === 'true' && (await page.locator('.cg-usermenu__list').isVisible()))
    await page.keyboard.press('Tab')
    log('menú de usuario: Tab entra a sus opciones', await page.evaluate(() => !!document.activeElement?.closest('.cg-usermenu__list')))
    await page.keyboard.press('Escape')
    log('menú de usuario: Escape lo cierra y devuelve el foco al botón', (await button.getAttribute('aria-expanded')) === 'false' && await page.evaluate(() => document.activeElement?.classList.contains('cg-usermenu__button')))
    await button.click()
    log('menú de usuario: «Revisiones profesionales» y «Salir»', (await page.locator('.cg-usermenu__list', { hasText: 'Revisiones profesionales' }).count()) === 1 && (await page.locator('.cg-usermenu__out').count()) === 1)
    await axeCheck(page, 'menú abierto (profesional)')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/es153-menu-profesional.png` })
    let loggedOut = false
    await page.route('**/api/logout', route => { loggedOut = true; return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) })
    await page.locator('.cg-usermenu__out').click(); await page.waitForURL(u => u.pathname === '/'); await page.waitForTimeout(150)
    log('Salir: pide revocar el token, borra la sesión y va a «/»', loggedOut && (await page.evaluate(() => localStorage.getItem('elevation_token'))) === null)
    await ctx.close() }

  // 5. Pantalla «sin acceso»: foco, enlace al inicio del rol, axe
  for (const lang of ['es', 'en']) {
    const { ctx, page } = await open(browser, { role: 'admin', lang })
    await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' }); await page.waitForSelector('.cg-gate')
    log(`sin acceso/${lang}: enlace al inicio de su rol`, (await page.locator('.cg-gate a').getAttribute('href')) === '/admin/dashboard')
    log(`sin acceso/${lang}: el foco va al título`, await page.evaluate(() => document.activeElement?.tagName === 'H1'))
    log(`sin acceso/${lang}: un solo h1 y un solo main`, (await page.locator('h1').count()) === 1 && (await page.locator('main').count()) === 1)
    await axeCheck(page, `sin acceso/${lang}`)
    if (SHOTS && lang === 'es') await page.screenshot({ path: `${SHOTS}/es153-sin-acceso.png` })
    await ctx.close()
  }

  await browser.close()
  console.log(failures ? `FALLAS: ${failures}` : 'TODO OK')
  process.exit(failures ? 1 : 0)
})().catch(error => { console.error('ERROR', error.message); process.exit(1) })
