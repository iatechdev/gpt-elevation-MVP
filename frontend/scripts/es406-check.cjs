// ES-406: contenedor único --cg-wrap (cabecera, cuerpo y pie con la barra lateral DENTRO) y barra lateral alcanzable en ventanas bajas. Chromium, API simulada, DATOS SINTÉTICOS.
// Uso: BASE=http://127.0.0.1:PUERTO PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> node scripts/es406-check.cjs   (EXPECT_FAIL=1 para documentar main)
const fs = require('node:fs')
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.BASE; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const ROLES = [['user', '/app/dashboard'], ['user', '/app/chat'], ['therapist', '/therapist/dashboard'], ['admin', '/admin/dashboard'], ['board', '/manifiesto']]
  const results = []; const fails = []; const rows = []
  for (const [role, path] of ROLES) for (const lang of (process.env.LANGS || 'es,en').split(',')) for (const scheme of (process.env.SCHEMES || 'light,dark').split(',')) for (const [w, h] of [[1440, 900], [1440, 700], [1024, 800], [390, 800]]) {
    const tag = `${role}${path} ${lang} ${scheme} ${w}x${h}`
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
    await page.addInitScript(([r, l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l) }, [role, lang])
    await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname
      if (p === '/api/session') return r.fulfill({ json: { role, onboardingCompleted: true } })
      return role === 'user' ? r.fulfill({ json: [] }) : r.fulfill({ status: 500, json: { error: 'x' } }) })
    try {
      await page.goto(base + path, { waitUntil: 'load' }); await page.waitForSelector('main'); await page.waitForTimeout(300)
      const m = await page.evaluate(() => {
        const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, t: r.top, b: r.bottom, w: r.width, h: r.height } }
        const side = document.querySelector('.cg-side--groups'); const sideShown = !!side && getComputedStyle(side).display !== 'none'
        let reach = null
        if (sideShown) { const links = [...side.querySelectorAll('a')]; window.scrollTo(0, document.documentElement.scrollHeight); side.scrollTop = side.scrollHeight; const last = links[links.length - 1]; const lr = last.getBoundingClientRect(); const sr = side.getBoundingClientRect(); reach = { scrolls: side.scrollHeight > side.clientHeight, lastVisible: lr.bottom <= sr.bottom + 1 && lr.bottom <= innerHeight + 1, sideBottom: Math.round(sr.bottom), vh: innerHeight } }
        return { header: box('.cg-header'), brand: box('.cg-brand'), body: box('.cg-body'), side: sideShown ? box('.cg-side--groups') : null, main: box('main'), footer: box('.cg-footer'), reach, overflowX: document.documentElement.scrollWidth > innerWidth }
      })
      const problems = []
      if (m.overflowX) problems.push('desborde horizontal')
      if (w >= 901 && m.header) {
        const edge = [m.header.l, m.body.l, m.footer ? m.footer.l : m.body.l]; const edgeR = [m.header.r, m.body.r, m.footer ? m.footer.r : m.body.r]
        if (Math.max(...edge) - Math.min(...edge) > 1) problems.push('borde izquierdo distinto ' + edge); if (Math.max(...edgeR) - Math.min(...edgeR) > 1) problems.push('borde derecho distinto ' + edgeR)
        if (m.body.w > 1241) problems.push('contenedor > 1240: ' + m.body.w)
        if (m.side && (m.side.l < m.body.l - 1 || m.main.r > m.body.r + 1)) problems.push('barra o contenido fuera del contenedor')
        if (m.side && !(m.reach && m.reach.lastVisible)) problems.push('último enlace de la barra inalcanzable')
        if (m.side && m.reach.sideBottom > m.reach.vh + 1) problems.push('la barra se sale de la ventana')
      }
      if (!problems.length) { await page.addScriptTag({ content: axeSource }); const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(x => x.id + ' ' + x.nodes.length)); if (v.length) problems.push('axe ' + v.join(',')) }
      rows.push({ tag, header: m.header && [m.header.l, m.header.r], body: [m.body.l, m.body.r], side: m.side && [m.side.l, m.side.r], main: [m.main.l, m.main.r], footer: m.footer && [m.footer.l, m.footer.r], reach: m.reach })
      if (problems.length) throw new Error(problems.join('; '))
      results.push('PASS ' + tag)
    } catch (e) { fails.push(tag); results.push('FAIL ' + tag + ' → ' + e.message.split('\n')[0]) }
    await ctx.close()
  }
  console.log(results.join('\n')); if (process.env.ROWS) console.log(rows.filter(r => /1440x900/.test(r.tag) && /es light/.test(r.tag)).map(r => JSON.stringify(r)).join('\n'))
  console.log(`\n${results.length - fails.length}/${results.length} OK`); await browser.close(); if (fails.length && !process.env.EXPECT_FAIL) process.exitCode = 1
})()
