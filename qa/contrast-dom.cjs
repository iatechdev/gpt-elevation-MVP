// QA-Claude-2 — barrido de contraste de TEXTO renderizado (colores computados reales, fondo = primer ancestro opaco).
// Uso: URL=http://localhost:5173/app/skill-map WIDTHS=375,1280 SCHEME=light|dark LANG=es [CLICK=selector] node qa/contrast-dom.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
;(async () => {
  const b = await chromium.launch()
  for (const w of (process.env.WIDTHS || '375,1280').split(',').map(Number)) {
    const c = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: process.env.SCHEME || 'light' })
    await c.addInitScript(([l, t, r]) => { localStorage.setItem('elevation_token', t); if (r) localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l) }, [process.env.LANG || 'es', process.env.TOKEN || 'sintetico', process.env.ROLE || ''])
    const p = await c.newPage(); await p.goto(process.env.URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
    if (process.env.CLICK) { for (const sel of process.env.CLICK.split(' >> ')) { await p.locator(sel).first().click(); await p.waitForTimeout(500) } }
    const res = await p.evaluate(() => {
      const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a } }
      const lum = ({ r, g, b }) => [r, g, b].map(v => v / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0)
      const ratio = (f, g) => { const [x, y] = [lum(f), lum(g)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
      const bgOf = el => { let e = el; while (e) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (c && c.a > .95) return c; e = e.parentElement } return { r: 255, g: 255, b: 255, a: 1 } }
      const out = new Map()
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n; (n = walker.nextNode());) {
        const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || !el.getClientRects().length) continue
        const isSvg = el instanceof SVGElement; const fg = parse(isSvg ? cs.fill : cs.color); if (!fg) continue
        let bg = bgOf(isSvg ? (el.closest('svg').parentElement) : el)
        if (isSvg) { const g = el.closest('g'); const rect = g && g.querySelector('rect'); if (rect) { const f = parse(getComputedStyle(rect).fill); if (f && f.a > .95) bg = f } }
        const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700, large = size >= 24 || (size >= 18.66 && bold)
        const r = ratio(fg, bg), min = large ? 3 : 4.5
        if (r < min) out.set(t.slice(0, 40) + '|' + r.toFixed(2), { t: t.slice(0, 40), ratio: +r.toFixed(2), min, size, fg: `${fg.r},${fg.g},${fg.b}`, bg: `${bg.r},${bg.g},${bg.b}`, cls: (el.getAttribute('class') || el.tagName) })
      }
      return [...out.values()]
    })
    console.log(`ancho ${w}: ${res.length} textos bajo AA`); res.slice(0, 12).forEach(r => console.log('  ', JSON.stringify(r)))
    await c.close()
  }
  await b.close()
})()
