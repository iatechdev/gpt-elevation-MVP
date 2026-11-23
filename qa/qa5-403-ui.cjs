// [QA-Claude-5] PR #403 (ES-359 PR5), SUPERADMINISTRACIÓN contra backend real + build fresco (qa5-402-serve.cjs). Datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4402 API=http://127.0.0.1:8402 CRED=<cred403.json> [PART=ui|axe] node qa/qa5-403-ui.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const BASE = process.env.BASE, API = process.env.API, CRED = JSON.parse(fs.readFileSync(process.env.CRED, 'utf8')); const PART = process.env.PART || 'all'
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const ADMIN = ['/admin/dashboard', '/admin/metrics', '/admin/pilot-metrics', '/admin/users', '/admin/prompts', '/admin/content', '/admin/route-catalog', '/admin/skill-catalog', '/admin/manifest']
const PERSON_ONLY = ['/app/dashboard', '/app/checkin', '/app/chat', '/app/diary', '/app/bridge', '/app/exercises', '/app/skill-map', '/app/evidence', '/app/next-step', '/app/compass', '/app/progress', '/app/plan', '/app/my-therapist']
let SESSION = null // una sola sesión por ejecución: el servidor revoca las más antiguas al iniciar varias (artefacto de entorno, no del PR)
const open = async (br, { lang = 'es', width = 1360, height = 900, scheme = 'light' } = {}) => {
  const s = SESSION || (SESSION = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: CRED.super, password: CRED.pass }) })).json())
  const ctx = await br.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([tk, role, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', role); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Super Sintetica') }, [s.token, s.role || 'superadmin', lang])
  return { ctx, page, errs }
}
const settle = (page) => page.waitForSelector('main', { timeout: 20000 }).then(() => page.waitForTimeout(900))
const snap = (page) => page.evaluate(() => {
  const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const side = [...document.querySelectorAll('nav.cg-side')].filter(vis)[0] || null
  return { path: location.pathname, ox: document.documentElement.scrollWidth > innerWidth + 1, mainW: Math.round(document.querySelector('main').getBoundingClientRect().width),
    side: side && { label: side.getAttribute('aria-label'), links: [...side.querySelectorAll('a')].filter(vis).map((a) => ({ href: new URL(a.href).pathname, cur: a.getAttribute('aria-current'), h: Math.round(a.getBoundingClientRect().height) })), lists: [...side.querySelectorAll('ul')].map((u) => u.getAttribute('aria-label') || (u.getAttribute('aria-labelledby') && document.getElementById(u.getAttribute('aria-labelledby')) && document.getElementById(u.getAttribute('aria-labelledby')).textContent.trim()) || null) } }
})
const drawer = async (page, lang) => {
  await page.getByRole('button', { name: lang === 'es' ? /Menú/ : /Menu/ }).first().click({ timeout: 8000 }); await page.waitForSelector('dialog.cg-drawer[open] .cg-drawer__panel', { timeout: 8000 }); await page.waitForTimeout(400)
  return page.evaluate(() => { const d = document.querySelector('dialog.cg-drawer[open]'); return { who: d.querySelector('.cg-drawer__who').textContent.trim(), heads: [...d.querySelectorAll('.cg-drawer__h')].map((h) => h.textContent.trim()), links: [...d.querySelectorAll('a')].map((a) => new URL(a.href).pathname) } })
}
;(async () => {
  const br = await chromium.launch()
  if (PART !== 'axe') for (const lang of (process.env.LANGS || 'es,en').split(',')) {
    const T = lang === 'es' ? { grp: ['Resumen', 'Personas', 'Contenido', 'Junta'], who: 'Superadministración', menu: 'Menú de usuario' } : { grp: null, who: 'Superadministration', menu: 'User menu' }
    { const { ctx, page, errs } = await open(br, { lang }); await page.goto(BASE + '/admin/dashboard'); await settle(page); const s = await snap(page)
      check(`[${lang}] /admin 1360px: UNA barra lateral con nombre accesible y 9 enlaces de administración, en orden`, !!s.side && !!s.side.label && JSON.stringify(s.side.links.map((l) => l.href)) === JSON.stringify(ADMIN), s.side && s.side.links.map((l) => l.href).join(','))
      check(`[${lang}] /admin 1360px: 4 listas con título${T.grp ? ' (' + T.grp.join('/') + ')' : ''}`, !!s.side && s.side.lists.length === 4 && s.side.lists.every(Boolean) && (!T.grp || JSON.stringify(s.side.lists) === JSON.stringify(T.grp)), s.side && JSON.stringify(s.side.lists))
      check(`[${lang}] /admin 1360px: sin enlaces de persona en la barra, sin desborde, alto táctil ≥ 40 px`, !!s.side && !s.side.links.some((l) => l.href.startsWith('/app/')) && !s.ox && s.side.links.every((l) => l.h >= 40), s.side && s.side.links.filter((l) => l.h < 40).map((l) => l.href + ':' + l.h).join(','))
      check(`[${lang}] /admin 1360px: «Panel» lleva aria-current=page y es el único`, !!s.side && s.side.links.filter((l) => l.cur === 'page').map((l) => l.href).join() === '/admin/dashboard')
      check(`[${lang}] sin errores de JavaScript (/admin/dashboard)`, errs.length === 0, errs.join('|')); await ctx.close() }
    { const { ctx, page, errs } = await open(br, { lang }); const bad2 = []
      for (const to of ADMIN) { await page.goto(BASE + '/admin/dashboard'); await settle(page); const l = page.locator(`nav.cg-side a[href="${to}"]:visible`).first(); if (!(await l.count())) { bad2.push(to + ': sin enlace'); continue }
        await l.click(); await page.waitForTimeout(1000); const s = await snap(page); const cur = s.side ? s.side.links.filter((x) => x.cur === 'page').map((x) => x.href) : []
        if (!(s.path === to || s.path.startsWith(to + '/'))) bad2.push(`${to}: terminó en ${s.path}`); else if (cur.length !== 1 || cur[0] !== to) bad2.push(`${to}: aria-current=${cur.join(',') || 'ninguno'}`) }
      check(`[${lang}] los 9 enlaces de la barra de administración llegan a su ruta y marcan solo la actual`, bad2.length === 0, bad2.join(' | ')); check(`[${lang}] sin errores de JavaScript en el recorrido`, errs.length === 0, errs.slice(0, 3).join('|')); await ctx.close() }
    for (const width of [390, 320]) { const { ctx, page } = await open(br, { lang, width, height: 800 }); await page.goto(BASE + '/admin/dashboard'); await settle(page); const s = await snap(page)
      check(`[${lang}] /admin ${width}px: sin barra lateral y sin desborde horizontal`, !s.side && !s.ox, JSON.stringify({ side: !!s.side, ox: s.ox }))
      const d = await drawer(page, lang)
      check(`[${lang}] /admin ${width}px: cajón de ${T.who} (rótulo), con los 9 enlaces de administración y «${T.menu}»`, d.who.includes(T.who) && ADMIN.every((h) => d.links.includes(h)) && d.heads.includes(T.menu), JSON.stringify(d).slice(0, 300))
      check(`[${lang}] /admin ${width}px: el cajón (Menú de usuario) trae «Manifiesto» público (/manifiesto) y «Mis datos» (/app/data)`, d.links.includes('/manifiesto') && d.links.includes('/app/data'), d.links.join(','))
      check(`[${lang}] /admin ${width}px: el cajón NO trae enlaces de persona (QA-400-03)`, !PERSON_ONLY.some((h) => d.links.includes(h)), d.links.filter((h) => PERSON_ONLY.includes(h)).join(','))
      if (width === 390) { const t = await page.evaluate(() => [...document.querySelectorAll('dialog.cg-drawer[open] a')].map((a) => Math.round(a.getBoundingClientRect().height))); check(`[${lang}] cajón 390px: enlaces con alto táctil ≥ 40 px`, t.every((h) => h >= 40), Math.min(...t)) }
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); check(`[${lang}] ${width}px: Escape cierra el cajón`, await page.evaluate(() => !document.querySelector('dialog.cg-drawer[open]'))); await ctx.close() }
    for (const route of ['/app/data', '/app/professional-reviews']) {
      { const { ctx, page, errs } = await open(br, { lang }); await page.goto(BASE + route); await settle(page); const s = await snap(page); const hrefs = s.side ? s.side.links.map((l) => l.href) : []
        check(`[${lang}] ${route} 1360px: marco de PERSONA (17 enlaces de persona, ninguno de /admin en la barra) y sin desborde`, hrefs.length === 17 && hrefs.includes('/app/dashboard') && !hrefs.some((h) => h.startsWith('/admin')) && !s.ox, hrefs.length + ' ' + hrefs.slice(0, 3).join(','))
        check(`[${lang}] ${route}: sin errores de JavaScript`, errs.length === 0, errs.join('|')); await ctx.close() }
      { const { ctx, page } = await open(br, { lang, width: 390, height: 800 }); await page.goto(BASE + route); await settle(page); const d = await drawer(page, lang)
        check(`[${lang}] ${route} 390px: cajón de persona (enlaces de persona; sin /admin en la lista)`, PERSON_ONLY.slice(0, 5).every((h) => d.links.includes(h)) && !d.links.some((h) => h.startsWith('/admin/')), JSON.stringify(d).slice(0, 260)); await ctx.close() } }
    { const { ctx, page } = await open(br, { lang }); await page.goto(BASE + '/admin/dashboard'); await settle(page); await page.locator('.cg-usermenu__button').click(); await page.waitForTimeout(300)
      const link = page.locator('.cg-usermenu__list a[href="/app/data"]:visible').first(); check(`[${lang}] desde /admin, «Mis datos» está en el menú de cuenta (2 acciones)`, (await link.count()) === 1)
      if (await link.count()) { await link.click(); await page.waitForTimeout(1200); const s = await snap(page); check(`[${lang}] tras «Mis datos» se llega a /app/data`, s.path === '/app/data', s.path) } await ctx.close() }
  }
  if (PART !== 'ui') for (const scheme of ['light', 'dark']) for (const width of [1360, 390]) for (const lang of ['es', 'en']) for (const route of ['/admin/dashboard', '/admin/users', '/app/data']) {
    const { ctx, page } = await open(br, { width, scheme, lang }); await page.goto(BASE + route); await settle(page); await page.addScriptTag({ content: axeSource })
    const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' ')))))
    check(`axe = 0 en ${route} ${scheme} ${width}px ${lang}`, v.length === 0, v.join(' ; ')); await ctx.close() }
  console.log(`UI #403 superadmin: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
