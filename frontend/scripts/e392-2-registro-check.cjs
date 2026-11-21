// E392-2: /login y /login?mode=register con sesión guardada vencida (401): marcador de altura mientras se verifica, luego aviso «expiró» + formulario; sin sesión guardada no hay marcador.
// axe wcag2a/2aa/21a/21aa/22aa, sin desborde, marcador aria-hidden. Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… BASE=http://127.0.0.1:4351 node scripts/e392-2-registro-check.cjs
const fs = require('node:fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); let failures = 0
const log = (ok, m) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${m}`) }
const run = async page => { await page.addScriptTag({ content: axeSource }); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => `${v.id} x${v.nodes.length}`) }
;(async () => { const b = await chromium.launch()
  for (const route of ['/login?mode=register', '/login']) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) for (const state of ['verificando', 'vencida', 'sin-sesion']) {
    const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(([l, s]) => { localStorage.setItem('elv_lang', l); if (s !== 'sin-sesion') { localStorage.setItem('elevation_token', 'tok-vencido'); localStorage.setItem('elevation_role', 'user') } }, [lang, state])
    let release; const gate = new Promise(r => { release = r })
    await page.route('**/api/**', async r => { const p = new URL(r.request().url()).pathname
      if (p === '/api/session') { if (state === 'verificando') await gate; return r.fulfill({ status: 401, json: {} }) }
      return r.fulfill({ json: {} }) })
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
    if (state === 'verificando') await page.waitForSelector('.ac-hold', { timeout: 8000 }); else await page.waitForSelector('form', { timeout: 8000 })
    await page.waitForTimeout(300)
    const m = await page.evaluate(() => ({ hold: document.querySelectorAll('.ac-hold').length, hidden: document.querySelector('.ac-hold')?.getAttribute('aria-hidden'), forms: document.querySelectorAll('form').length, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth }))
    const bad = await run(page)
    const ok = bad.length === 0 && m.scrollW <= m.innerW && (state === 'verificando' ? m.hold === 1 && m.hidden === 'true' && m.forms === 0 : m.hold === 0 && m.forms === 1)
    log(ok, `${route} ${lang} ${scheme} ${width} ${state}${ok ? '' : ` hold=${m.hold} forms=${m.forms} scroll=${m.scrollW}/${m.innerW} axe[${bad}]`}`); release(); await ctx.close() }
  await b.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0) })()
