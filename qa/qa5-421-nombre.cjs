// [QA-Claude-5] #421 cabeza 46c4814f: «Mis autorizaciones» con el nombre de la persona revisora (campo reviewerName que aún no envía el servidor: se simula SOLO esa respuesta). Nombre hostil y largo como TEXTO, sin desborde, axe 0; sin nombre → «Persona revisora».
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const BASE = process.env.BASE; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', 'utf8')).users; let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const NAME = '<img src=x onerror="window.__xss=1"> Ana de las Nieves Fernández-Villaverde y Montenegro-Echeverría de la Santísima Trinidad'
const share = (id, rv, name, st) => ({ id, reviewerId: rv, reviewerName: name, materialVersion: 1, evidenceCount: 2, status: st, createdAt: '2026-11-20T10:00:00Z', revokedAt: st === 'revoked' ? '2026-11-21T10:00:00Z' : null })
;(async () => {
  const br = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const ctx = await br.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message)); const u = U.pA
    await page.addInitScript(([tk, rl, nm, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', nm); localStorage.setItem('elv_lang', l) }, [u.token, u.role, u.name, lang])
    await page.route('**/api/me/review-shares', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { shares: [share(9, 3, NAME, 'granted'), share(8, 4, null, 'granted'), share(7, 5, '   ', 'revoked'), share(6, 6, 'Beto Revisor', 'revoked')] } }) : r.continue()))
    await page.goto(BASE + '/app/professional-reviews'); await page.waitForSelector('.rv-row'); await page.waitForTimeout(600)
    const d = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.rv-row strong')].map((s) => s.textContent), img: document.querySelectorAll('.rv-row img').length, xss: window.__xss === 1, ox: document.documentElement.scrollWidth > innerWidth + 1, wide: [...document.querySelectorAll('.rv-row, .rv-row__top, .rv-row strong')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length }))
    await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length)))
    const fb = lang === 'es' ? 'Persona revisora' : 'Reviewer'
    check(`[${lang} ${width}px ${scheme}] nombre como TEXTO (sin crear elementos ni ejecutar nada), sin nombre/vacío → «${fb}», sin desborde, axe 0, sin errores de JS`, d.rows[0] === NAME && d.rows[1] === fb && d.rows[2] === fb && d.rows[3] === 'Beto Revisor' && d.img === 0 && !d.xss && !d.ox && d.wide === 0 && v.length === 0 && errs.length === 0, JSON.stringify({ d, v, errs })); await ctx.close() }
  console.log(`NOMBRE #421: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
