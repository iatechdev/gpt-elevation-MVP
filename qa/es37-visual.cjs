// QA-Claude-2 — ES-37: revisión visual con mock sintético. Requiere mock-es37.mjs (:8099) y vite (:5173).
// PLAYWRIGHT_MODULE y PLAYWRIGHT_BROWSERS_PATH según memoria de herramientas. Salida: capturas en OUT y JSON de métricas.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const fs = require('fs'), path = require('path')
const OUT = process.env.OUT, BASE = process.env.BASE || 'http://localhost:5173'
fs.mkdirSync(OUT, { recursive: true })
const routes = ['/app/skill-map', '/app/compass', '/app/next-step']
const widths = [320, 375, 768, 1024, 1280]
;(async () => {
  const browser = await chromium.launch(), rows = []
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) {
    const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'sintetico'); localStorage.setItem('elv_lang', l) }, [lang])
    const page = await ctx.newPage(), errs = []
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) }); page.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 160)))
    for (const r of routes) for (const w of widths) {
      await page.setViewportSize({ width: w, height: 900 }); await page.goto(BASE + r, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(500)
      const m = await page.evaluate(() => {
        const cs = (el) => el ? getComputedStyle(el) : null
        const scope = document.querySelector('.skill-map-scope,.career-scope,.compass-scope')
        const btn = [...document.querySelectorAll('button,a[role=button],a.btn')].filter(b => b.offsetParent)
        const small = btn.filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44 }).map(b => (b.textContent || '').trim().slice(0, 30))
        return { url: location.pathname, scrollW: document.documentElement.scrollWidth, innerW: innerWidth, scopeClass: scope?.className?.slice(0, 60), bg: cs(document.body).backgroundColor, scopeBg: cs(scope)?.backgroundColor, scopeColor: cs(scope)?.color, h1: document.querySelector('h1')?.textContent?.slice(0, 60), small, dark: !!document.querySelector('.elv-dark'), text: document.body.innerText.length }
      })
      rows.push({ scheme, lang, route: r, width: w, errs: errs.length, ...m })
      if ([320, 1280].includes(w) || w === 375) await page.screenshot({ path: path.join(OUT, `${scheme}-${lang}${r.replace(/\//g, '_')}-${w}.png`), fullPage: true })
    }
    await ctx.close()
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(rows, null, 1))
  const bad = rows.filter(r => r.scrollW > r.innerW)
  console.log('filas', rows.length, 'con desborde horizontal', bad.length, JSON.stringify(bad.map(b => [b.scheme, b.lang, b.route, b.width, b.scrollW])))
  console.log('con errores de consola', rows.filter(r => r.errs).length)
  await browser.close()
})()
