// E409-1: /admin/manifest con el marcador de altura (estado de carga) y con datos: axe wcag2a/2aa/21a/21aa/22aa, sin desborde, el marcador no se lee (aria-hidden) y desaparece al cargar.
// Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… BASE=http://127.0.0.1:4351 node scripts/e409-1-axe-check.cjs
const fs = require('node:fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); let failures = 0
const log = (ok, m) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${m}`) }
const txt = 'Texto sintético. '.repeat(30)
const versions = [2, 1].map(n => ({ id: n, version: `v${n}`, isActive: n === 2, note: null, content: txt, contentEn: null, createdAt: '2026-11-0' + n + 'T00:00:00Z', uploader: { id: 1, name: 'Alejo', email: 'a@x.test' } }))
const run = async page => { await page.addScriptTag({ content: axeSource }); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => `${v.id} x${v.nodes.length}`) }
;(async () => { const b = await chromium.launch()
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) for (const state of ['cargando', 'cargado']) {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(l => { localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elevation_name', 'Admin') }, lang)
    let release; const gate = new Promise(r => { release = r })
    await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'superadmin', onboardingCompleted: true } })
      if (p === '/api/board/manifest') { if (state === 'cargando') await gate; return route.fulfill({ json: versions }) }
      return route.fulfill({ json: {} }) })
    await page.goto(BASE + '/admin/manifest', { waitUntil: 'domcontentloaded' }); await page.waitForSelector(state === 'cargando' ? '.bm-skel' : '.bm-active', { timeout: 8000 }); await page.waitForTimeout(300)
    const m = await page.evaluate(() => ({ skel: document.querySelectorAll('.bm-skel').length, hidden: document.querySelector('.bm-skel')?.getAttribute('aria-hidden'), scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }))
    const bad = await run(page)
    const ok = bad.length === 0 && m.scrollW <= m.innerW && (state === 'cargando' ? m.skel === 1 && m.hidden === 'true' : m.skel === 0)
    log(ok, `${lang} ${scheme} ${width} ${state}${ok ? '' : ` skel=${m.skel} scroll=${m.scrollW}/${m.innerW} axe[${bad}]`}`); release(); await ctx.close() }
  await b.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0) })()
