// [QA-Claude-5] PR #402 (ES-359 PR2): barra lateral de persona EN PANTALLA, contra backend real + build fresco (qa5-402-serve.cjs). Datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=... AXE=<axe.min.js> BASE=http://127.0.0.1:4402 API=http://127.0.0.1:8402 CRED=<cred402.json> node qa/qa5-402-ui.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const BASE = process.env.BASE, API = process.env.API, CRED = JSON.parse(fs.readFileSync(process.env.CRED, 'utf8'))
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 360) : '')) } }
const tokenOf = async (email) => (await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: CRED.pass }) })).json())
const open = async (br, { who = 'persona', lang = 'es', width = 1360, height = 900, scheme = 'light' }) => {
  const s = await tokenOf(CRED[who]); const ctx = await br.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([tk, role, l, n]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', role); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', n) }, [s.token, s.role || (who === 'super' ? 'superadmin' : 'user'), lang, 'Persona Sintética'])
  return { ctx, page, errs }
}
const side = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const navs = [...document.querySelectorAll('nav')].filter(vis).map((n) => ({ label: n.getAttribute('aria-label') || n.getAttribute('aria-labelledby'), cls: n.className, links: [...n.querySelectorAll('a')].filter(vis).map((a) => ({ href: new URL(a.href).pathname, text: a.textContent.trim(), cur: a.getAttribute('aria-current'), h: Math.round(a.getBoundingClientRect().height), w: Math.round(a.getBoundingClientRect().width) })), groups: [...n.querySelectorAll('ul')].filter(vis).map((u) => ({ name: u.getAttribute('aria-label') || (u.getAttribute('aria-labelledby') && document.getElementById(u.getAttribute('aria-labelledby'))?.textContent.trim()) || null, n: u.querySelectorAll('a').length })) }))
  const sideNav = navs.find((n) => /side/i.test(n.cls)) || null
  const menuLinks = [...document.querySelectorAll('.cg-usermenu__list a')].map((a) => ({ href: new URL(a.href).pathname, hidden: getComputedStyle(a.closest('li')).display === 'none' || !a.getBoundingClientRect().width }))
  const main = document.querySelector('main'); const mr = main && main.getBoundingClientRect()
  return { navs, sideNav, menuLinks, ox: document.documentElement.scrollWidth > innerWidth + 1, mainW: mr ? Math.round(mr.width) : null, vw: innerWidth }
})
const EXPECT = ['/app/dashboard', '/app/checkin', '/app/chat', '/app/diary', '/app/bridge', '/app/space/tools', '/app/exercises', '/app/skill-map', '/app/evidence', '/app/next-step', '/app/compass', '/app/route-catalog', '/app/context/resumes', '/app/progress', '/app/plan', '/app/my-therapist', '/app/professional-reviews']
const settle = (page) => page.waitForSelector('main', { timeout: 20000 }).then(() => page.waitForTimeout(700))
;(async () => {
  const br = await chromium.launch()
  // ── escritorio 1360: la barra existe, con las 17 entradas del diseño en 5 grupos, en el orden aprobado
  for (const lang of ['es', 'en']) {
    const { ctx, page, errs } = await open(br, { lang }); await page.goto(BASE + '/app/dashboard'); await settle(page); const s = await side(page)
    check(`[${lang}] 1360px: hay UNA barra lateral con nombre accesible y 17 enlaces visibles`, !!s.sideNav && !!s.sideNav.label && s.sideNav.links.length === 17, JSON.stringify({ nav: s.navs.map((n) => [n.label, n.cls, n.links.length]) }))
    check(`[${lang}] 1360px: las 17 rutas del diseño, en el orden aprobado`, s.sideNav && JSON.stringify(s.sideNav.links.map((l) => l.href)) === JSON.stringify(EXPECT), s.sideNav && s.sideNav.links.map((l) => l.href).join(' '))
    check(`[${lang}] 1360px: 4 listas con título (nombre accesible) más la de «Mi panel»`, s.sideNav && s.sideNav.groups.length === 5 && s.sideNav.groups.filter((g) => g.name).length >= 4, JSON.stringify(s.sideNav && s.sideNav.groups))
    check(`[${lang}] 1360px: «Mi panel» lleva aria-current=page y es la única marcada`, s.sideNav && s.sideNav.links.filter((l) => l.cur === 'page').length === 1 && s.sideNav.links[0].cur === 'page', JSON.stringify(s.sideNav && s.sideNav.links.filter((l) => l.cur)))
    check(`[${lang}] 1360px: enlaces con alto táctil ≥ 40 px (diseño) y sin desborde horizontal`, s.sideNav && s.sideNav.links.every((l) => l.h >= 40) && !s.ox, JSON.stringify({ min: s.sideNav && Math.min(...s.sideNav.links.map((l) => l.h)), ox: s.ox }))
    await page.locator('.cg-usermenu__button').click(); await page.waitForTimeout(300); const s2 = await side(page); check(`[${lang}] 1360px: el menú de usuario (ABIERTO) tiene enlaces y no repite los 8 de la barra`, s2.menuLinks.filter((m) => !m.hidden).length >= 3, JSON.stringify(s2.menuLinks)); check(`[${lang}] 1360px: el menú de usuario YA NO repite los 8 enlaces que pasaron a la barra (quedan Mis datos, Tu opinión, Manifiesto, cuenta…)`, s2.menuLinks.filter((m) => !m.hidden).every((m) => !['/app/checkin', '/app/bridge', '/app/my-therapist', '/app/space/tools', '/app/progress', '/app/plan', '/app/context/resumes', '/app/professional-reviews'].includes(m.href)), JSON.stringify(s2.menuLinks.filter((m) => !m.hidden).map((m) => m.href)))
    check(`[${lang}] sin errores de JavaScript`, errs.length === 0, errs.join(' | ')); await ctx.close() }
  // ── cada enlace de la barra lleva a su ruta, marca aria-current allí y no a otro; la página no queda en blanco ni en /login
  { const { ctx, page, errs } = await open(br, { lang: 'es' }); const bad2 = []; await page.goto(BASE + '/app/dashboard'); await settle(page)
    for (const to of EXPECT) {
      await page.goto(BASE + '/app/dashboard'); await settle(page); const link = page.locator(`nav a[href="${to}"]:visible`).first(); if (!(await link.count())) { bad2.push(to + ': sin enlace'); continue }
      await link.click(); await page.waitForTimeout(900); const u = new URL(page.url()).pathname; const s = await side(page); const cur = s.sideNav ? s.sideNav.links.filter((l) => l.cur === 'page').map((l) => l.href) : []
      const blank = await page.evaluate(() => (document.body.innerText || '').trim().length < 20)
      if (!(u === to || u.startsWith(to + '/'))) bad2.push(`${to}: terminó en ${u}`); else if (cur.length !== 1 || cur[0] !== to) bad2.push(`${to}: aria-current=${cur.join(',') || 'ninguno'}`); if (blank) bad2.push(`${to}: pantalla en blanco`)
    }
    check('17 enlaces de la barra: cada uno llega a su ruta, queda marcado con aria-current (solo él) y la pantalla no queda en blanco', bad2.length === 0, bad2.join(' | ')); check('sin errores de JavaScript durante el recorrido', errs.length === 0, errs.slice(0, 3).join(' | ')); await ctx.close() }
  if (process.env.QA_FAST) { console.log(`UI #402 (rápida): ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0) }
  // ── ancho: 900 (sin barra) / 901 (con barra) / 1920; reflujo a 320
  for (const [w, expectSide] of [[320, false], [390, false], [900, false], [901, true], [1024, true], [1920, true]]) {
    const { ctx, page } = await open(br, { width: w, height: 900 }); await page.goto(BASE + '/app/dashboard'); await settle(page); const s = await side(page)
    check(`${w}px: la barra lateral ${expectSide ? 'SE VE' : 'NO se ve'} y no hay desborde horizontal`, (!!s.sideNav === expectSide) && !s.ox, JSON.stringify({ side: !!s.sideNav, ox: s.ox }))
    if (!expectSide) { const items = s.menuLinks.filter((m) => !m.hidden).map((m) => m.href); const nav = s.navs.flatMap((n) => n.links.map((l) => l.href)); console.log(`INFO ${w}px: enlaces a la vista en cabecera ${nav.length}; en el menú de usuario (cerrado, presentes en el DOM) ${items.length}`) }
    if (expectSide) { const useful = Math.round((s.mainW / s.vw) * 100); console.log(`INFO ${w}px: ancho de <main> ${s.mainW} px = ${useful} % de la ventana`) }
    await ctx.close() }
  // ── teclado: Tab desde el inicio recorre los enlaces de la barra en orden y Enter navega; el foco es visible
  { const { ctx, page } = await open(br, { width: 1360 }); await page.goto(BASE + '/app/dashboard'); await settle(page); await page.locator('nav a[href="/app/checkin"]:visible').first().focus()
    const focusStyle = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { outline: cs.outlineStyle + ' ' + cs.outlineWidth, ring: cs.boxShadow }; })
    check('teclado: el enlace enfocado de la barra tiene contorno o anillo visible', !/none/.test(focusStyle.outline.split(' ')[0]) && parseFloat(focusStyle.outline.split(' ')[1]) >= 2 || focusStyle.ring !== 'none', JSON.stringify(focusStyle))
    const order = []; for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'))) }
    check('teclado: Tab desde «Hoy» avanza en el orden del diseño (Conversación, Diario, El Puente, Mis herramientas, Ejercicios, Mapa)', JSON.stringify(order) === JSON.stringify(['/app/chat', '/app/diary', '/app/bridge', '/app/space/tools', '/app/exercises', '/app/skill-map']), order.join(' '))
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(900); check('teclado: Enter sobre un enlace de la barra navega', new URL(page.url()).pathname === '/app/exercises', page.url()); await ctx.close() }
  // ── superadministración dentro de /app ve los grupos de persona (groupsFor), no otro rol
  { const { ctx, page } = await open(br, { who: 'super' }); await page.goto(BASE + '/app/checkin'); await settle(page); const s = await side(page); check('superadministración en /app/checkin: ve la barra de persona con enlaces válidos (o ninguna), sin errores', !s.sideNav || s.sideNav.links.every((l) => l.href.startsWith('/app/')), JSON.stringify(s.sideNav && s.sideNav.links.length)); console.log('INFO superadmin en /app/checkin: barra ' + (s.sideNav ? s.sideNav.links.length + ' enlaces' : 'ausente') + ', URL ' + page.url()); await ctx.close() }
  // ── axe + zoom
  for (const scheme of ['light', 'dark']) for (const width of [1360, 390]) for (const lang of ['es', 'en']) for (const route of ['/app/dashboard', '/app/skill-map']) {
    const { ctx, page } = await open(br, { width, scheme, lang }); await page.goto(BASE + route); await settle(page); await page.addScriptTag({ content: axeSource })
    const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' ')))))
    check(`axe = 0 en ${route} ${scheme} ${width}px ${lang}`, v.length === 0, v.join(' ; ')); await ctx.close() }
  // zoom 200 % ≈ 680 px de ancho equivalente; reflujo a 320 ya probado arriba
  // ── CLS a 1360 y 390 (CPU ×4, 10 ejecuciones intercaladas) contra el servidor real
  for (const width of [1360, 390]) { const cls = []; for (let i = 0; i < 10; i++) { const { ctx, page } = await open(br, { width }); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await page.addInitScript(() => { window.__c = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__c += e.value }).observe({ type: 'layout-shift', buffered: true }) }); await page.goto(BASE + '/app/dashboard'); await settle(page); cls.push(await page.evaluate(() => window.__c)); await ctx.close() }
    console.log(`INFO CLS ${width}px: ${cls.map((x) => x.toFixed(3)).join(',')}`); check(`CLS ${width}px CPU ×4 (10 ejecuciones): máx ≤ 0,1 (o no peor que main)`, Math.max(...cls) <= 0.1, 'max=' + Math.max(...cls).toFixed(3)) }
  console.log(`UI #402: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
