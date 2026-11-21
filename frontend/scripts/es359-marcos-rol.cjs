// ES-359 (PR5): marcos de profesional, administración, superadministración y junta sobre la barra lateral por grupos y SU cajón móvil. Chromium, API simulada, DATOS SINTÉTICOS. Evidencia (no corre en CI).
// Por rol × ES/EN × claro/oscuro × 1360/390/320: en escritorio la barra lateral lleva los grupos del rol (títulos y enlaces en orden) y el encabezado no repite enlaces; en ≤ 900 px la barra se oculta, la cabecera es
// marca + «☰ Menú» y el cajón trae los grupos del ROL + «Menú de usuario» (nunca los enlaces de persona); sin desborde; axe wcag2a/2aa/21a/21aa/22aa = 0 con el cajón cerrado y abierto.
// «Mis datos» (/app/data) y «Revisiones profesionales» (/app/professional-reviews) se dibujan en el marco del ROL (profesional, administración, junta); persona y superadministración conservan el de persona.
// Uso: npx vite build --outDir dist-roles && npx vite preview --outDir dist-roles --host 127.0.0.1 --port 4309 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4309 node scripts/es359-marcos-rol.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4309'
let failures = 0, total = 0
const check = (ok, label) => { total++; if (!ok) { failures++; console.log('FALLA ' + label) } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const TITLES = { es: { main: 'Principal', overview: 'Resumen', people: 'Personas', content: 'Contenido', board: 'Junta', user: 'Menú de usuario', prefs: 'Preferencias' }, en: { main: 'Main', overview: 'Overview', people: 'People', content: 'Content', board: 'Board', user: 'User menu', prefs: 'Preferences' } }
const ADMIN_LINKS = ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest']
const ROLES = {
  therapist: { home: '/therapist/dashboard', side: ['/therapist/dashboard', '/facilitation', '/app/professional-reviews'], menu: ['/app/data', '/manifiesto'], heads: t => [t.main], roleFrame: true },
  admin: { home: '/admin/users', side: ADMIN_LINKS, menu: ['/app/data', '/manifiesto'], heads: t => [t.overview, t.people, t.content, t.board], roleFrame: true },
  superadmin: { home: '/admin/users', side: ADMIN_LINKS, menu: ['/app/data', '/manifiesto'], heads: t => [t.overview, t.people, t.content, t.board], roleFrame: false }, // en /app, la superadministración usa el marco de persona
  board: { home: '/app/data', side: ['/manifiesto'], menu: ['/app/data'], heads: () => [], roleFrame: true },
}
async function open(browser, { role, lang, width, scheme, path }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(([l, s, r]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elevation_name', 'Persona Sintética'); localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s) }, [lang, scheme, role])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
    if (p === '/api/session') return r.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    if (p === '/api/therapist/alerts') return r.fulfill({ json: { inactivePatients: [], notableProgress: [] } })
    if (p === '/api/therapist/prompt') return r.fulfill({ json: { hasPrompt: false, content: '', active: null, pending: null, rejected: null } })
    return r.fulfill({ json: [] }) })
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.locator('header.cg-header').waitFor({ timeout: 10000 }).catch(async () => { console.log(`SIN MARCO ${role} ${path} ${width}px: ${page.url()} :: ${(await page.locator('body').innerText()).slice(0, 120).split('\n').join(' | ')}`); errors.push('sin marco') }); await page.waitForTimeout(400)
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length)) }
const side = page => page.evaluate(() => { const nav = document.querySelector('nav.cg-side--groups'); const visible = !!nav && getComputedStyle(nav).display !== 'none'
  return { visible, heads: nav ? [...nav.querySelectorAll('.cg-side__group')].map(e => e.textContent.trim()) : [], links: nav ? [...nav.querySelectorAll('a')].map(a => a.getAttribute('href')) : [], current: nav ? nav.querySelectorAll('[aria-current=page]').length : 0, label: nav?.getAttribute('aria-label') ?? '',
    headerLinks: [...document.querySelectorAll('header.cg-header > nav a')].length, overX: document.documentElement.scrollWidth - document.documentElement.clientWidth } })
;(async () => {
  const browser = await chromium.launch()
  for (const [role, spec] of Object.entries(ROLES)) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) {
    const t = TITLES[lang]; const tag = `${role} ${lang} ${scheme} ${width}px`; const { ctx, page, errors } = await open(browser, { role, lang, width, scheme, path: spec.home })
    if (errors.includes('sin marco')) { check(false, `${tag}: el marco no se dibuja`); await ctx.close(); continue }
    const s = await side(page)
    if (width > 900) {
      check(s.visible, `${tag}: barra lateral visible`); check(same(s.heads, spec.heads(t)), `${tag}: títulos de grupo (${s.heads})`); check(same(s.links, spec.side), `${tag}: enlaces de la barra (${s.links})`)
      check(s.headerLinks === 0, `${tag}: el encabezado no repite enlaces (${s.headerLinks})`); check(await page.locator('.cg-menubtn').count() === 0, `${tag}: sin botón «Menú» en escritorio`); check(await page.locator('.cg-usermenu').count() === 1, `${tag}: menú de cuenta`)
      const v0 = await axe(page); check(v0.length === 0, `${tag}: axe 0 ${v0}`)
      if (spec.home !== '/app/data') check(s.current === 1, `${tag}: la pantalla actual lleva aria-current (${s.current})`)
    } else {
      check(!s.visible, `${tag}: la barra lateral se oculta`); check(await page.locator('.cg-menubtn').count() === 1, `${tag}: botón «Menú»`)
      const h = await page.evaluate(() => { const hd = document.querySelector('header.cg-header'); return { height: Math.round(hd.getBoundingClientRect().height), compact: hd.hasAttribute('data-compact') } })
      check(h.compact && h.height <= 60, `${tag}: cabecera de una fila ≤ 60 px (${h.height})`); check(s.overX <= 0, `${tag}: sin desborde (${s.overX})`)
      let v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón cerrado ${v}`)
      await page.locator('.cg-menubtn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); await page.waitForTimeout(200)
      const d = await page.evaluate(() => { const dl = document.querySelector('dialog.cg-drawer[open]'); return { heads: [...dl.querySelectorAll('.cg-drawer__h')].map(e => e.textContent.trim()), links: [...dl.querySelectorAll('nav.cg-drawer__list a')].map(a => a.getAttribute('href')), role: dl.querySelector('.cg-drawer__head')?.textContent ?? '', overX: document.documentElement.scrollWidth - innerWidth } })
      check(same(d.heads, [...spec.heads(t), t.user, t.prefs]), `${tag}: títulos del cajón (${d.heads})`); check(same(d.links, [...spec.side, ...spec.menu]), `${tag}: enlaces del cajón (${d.links})`)
      check(!d.links.includes('/app/skill-map') && !d.links.includes('/app/chat'), `${tag}: el cajón no trae enlaces de persona`); check(d.overX <= 0, `${tag}: sin desborde con el cajón abierto`)
      v = await axe(page); check(v.length === 0, `${tag}: axe 0 con el cajón abierto ${v}`)
      await page.keyboard.press('Escape')
    }
    check(errors.length === 0, `${tag}: sin errores de JavaScript ${errors.slice(0, 2)}`)
    await ctx.close()
  }
  // «Mis datos» y «Revisiones profesionales» dentro del marco del rol (o del de persona para persona y superadministración)
  for (const [role, spec] of Object.entries(ROLES)) for (const path of ['/app/data', '/app/professional-reviews']) for (const width of [1360, 390]) {
    const tag = `${role} ${path} ${width}px`; const { ctx, page } = await open(browser, { role, lang: 'es', width, scheme: 'light', path })
    const where = await page.evaluate(() => { const hrefs = [...document.querySelectorAll('nav.cg-side--groups a, dialog.cg-drawer a, header a')].map(a => a.getAttribute('href')); return { person: hrefs.includes('/app/skill-map'), pro: hrefs.includes('/therapist/dashboard'), admin: hrefs.includes('/admin/dashboard'), board: hrefs.includes('/manifiesto') } })
    // en móvil los enlaces del cajón solo existen con el cajón abierto: se abre antes de leer
    if (width <= 900) { await page.locator('.cg-menubtn').click(); await page.locator('dialog.cg-drawer[open]').waitFor(); Object.assign(where, await page.evaluate(() => { const hrefs = [...document.querySelectorAll('dialog.cg-drawer a')].map(a => a.getAttribute('href')); return { person: hrefs.includes('/app/skill-map'), pro: hrefs.includes('/therapist/dashboard'), admin: hrefs.includes('/admin/dashboard'), board: hrefs.includes('/manifiesto') } })) }
    const expectPerson = role === 'superadmin' || !spec.roleFrame
    check(where.person === expectPerson, `${tag}: marco de ${expectPerson ? 'persona' : 'rol'} (enlaces de persona=${where.person})`)
    if (role === 'therapist') check(where.pro && !where.person, `${tag}: marco de profesional`)
    if (role === 'admin') check(where.admin && !where.person, `${tag}: marco de administración`)
    await ctx.close()
  }
  console.log(failures === 0 ? `TODO OK (${total} comprobaciones)` : `${failures} FALLA(S) de ${total}`); await browser.close(); process.exit(failures ? 1 : 0)
})()
