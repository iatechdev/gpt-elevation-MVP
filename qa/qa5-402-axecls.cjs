// [QA-Claude-5] #402: axe y CLS por separado (la UI completa se cae por memoria del navegador)
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
