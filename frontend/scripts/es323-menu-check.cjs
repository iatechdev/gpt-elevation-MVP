// ES-323 (E300-1): menú de usuario abierto en móvil. Chromium (y Firefox/WebKit si BROWSERS=all), API simulada (page.route), datos sintéticos.
// Con el menú abierto a 320/390/600/900 px, ES y EN: 0 controles del encabezado cubiertos por el panel, scrollWidth = ancho, axe wcag2a/2aa/21aa/22aa + target-size + label-content-name-mismatch = 0,
// el panel cabe en la pantalla, el orden de Tab (botón → entradas → idioma → tema → navegación) y el alto cerrado (202 px a ≤ 900). A ≥ 901 px el panel sigue flotante (sin cambio).
// Degradación sin :has(): se quitan del CSS las reglas con :has() y se comprueba que el panel sigue dentro de la pantalla (sin desplazamiento horizontal).
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4323 --strictPort   y luego
//   ES323_URL=http://127.0.0.1:4323 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> [BROWSERS=all] node scripts/es323-menu-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const pw = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES323_URL ?? 'http://127.0.0.1:4323'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const kinds = process.env.BROWSERS === 'all' ? ['chromium', 'firefox', 'webkit'] : ['chromium']
  let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  for (const kind of kinds) {
    const browser = await pw[kind].launch()
    const open = async (width, lang, { noHas = false } = {}) => {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage()
      await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
      await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
        if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
        if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
        if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: [] } })
        return route.fulfill({ json: [] }) })
      if (noHas) await page.route('**/*.css', async route => { const res = await route.fetch(); let css = await res.text()
        // Simula un navegador sin :has(): el CSS deja de aplicar toda regla que lo use (los navegadores descartan la regla entera cuando no entienden el selector).
        css = css.replace(/[^{}]*:has\([^{}]*\{[^{}]*\}/g, ''); await route.fulfill({ response: res, body: css }) })
      await page.goto(base + '/app/skill-map', { waitUntil: 'networkidle' }); await page.locator('.cg-header').waitFor()
      return { context, page }
    }
    const closedHeight = page => page.evaluate(() => Math.round(document.querySelector('.cg-header').getBoundingClientRect().height))
    const covered = page => page.evaluate(() => {
      const list = document.querySelector('.cg-usermenu__list').getBoundingClientRect()
      const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const hit = [...document.querySelectorAll('.cg-header button, .cg-header a')].filter(el => !el.closest('.cg-usermenu')).filter(el => area(el.getBoundingClientRect(), list) > 0).map(el => (el.textContent || '').trim().slice(0, 16))
      return { hit, left: Math.round(list.left), right: Math.round(list.right), vw: innerWidth, sw: document.documentElement.scrollWidth }
    })
    const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => {
      const tags = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })
      const rules = await window.axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'target-size'] } })
      return [...tags.violations, ...rules.violations].map(v => v.id + ':' + v.nodes.length) }) }
    for (const lang of ['es', 'en']) for (const width of [320, 390, 600, 900]) {
      const tag = `${kind} ${lang} ${width}px`; const { context, page } = await open(width, lang)
      const before = await closedHeight(page); assert.equal(before, 202, `alto cerrado (${tag}) = ${before}`)
      await page.locator('.cg-usermenu__button').click(); await page.waitForTimeout(80)
      const c = await covered(page)
      assert.deepEqual(c.hit, [], `controles cubiertos (${tag}): ${c.hit}`); assert.ok(c.left >= 0 && c.right <= c.vw, `panel dentro de la pantalla (${tag}): ${c.left}–${c.right} de ${c.vw}`); assert.equal(c.sw, c.vw, `scrollWidth ${c.sw} = ${c.vw} (${tag})`)
      assert.deepEqual(await axe(page), [], `axe 0 con el menú abierto (${tag})`)
      // Orden de Tab con el menú abierto: botón → entradas → idioma → tema → navegación (WebKit no pone los enlaces en el orden de Tab por defecto: ahí se omite «nav»)
      await page.locator('.cg-usermenu__button').focus(); const order = []
      for (let i = 0; i < 40; i++) { const k = await page.evaluate(() => { const el = document.activeElement; if (!el || !document.querySelector('.cg-header').contains(el)) return null
        return el.closest('.cg-usermenu__list') ? 'entry' : el.closest('.cg-usermenu') ? 'button' : el.closest('.cg-prefs') ? (el.closest('.cg-lang') ? 'lang' : 'theme') : el.closest('.cg-nav') ? 'nav' : 'other' })
        if (!k) break; if (order[order.length - 1] !== k) order.push(k); await page.keyboard.press('Tab') }
      assert.deepEqual(order, kind === 'webkit' ? ['button', 'entry', 'lang', 'theme'] : ['button', 'entry', 'lang', 'theme', 'nav'], `orden de Tab con el menú abierto (${tag}): ${order}`)
      await page.keyboard.press('Shift+Tab'); await page.locator('.cg-usermenu__button').focus(); await page.keyboard.press('Escape'); await page.waitForTimeout(60)
      assert.equal(await page.locator('.cg-usermenu__list').isHidden(), true, `Escape cierra (${tag})`)
      assert.equal(await page.evaluate(() => document.activeElement?.className), 'cg-usermenu__button', `Escape devuelve el foco al botón (${tag})`)
      assert.equal(await closedHeight(page), 202, `alto tras cerrar (${tag})`)
      await context.close()
    }
    check(`${kind}: menú abierto a 320/390/600/900 px (ES/EN): 0 cubiertos, sin desborde, axe 0, orden de Tab, Escape, alto 202`)
    for (const lang of ['es', 'en']) { // ≥ 901 px: el panel sigue flotante y no cubre nada
      const { context, page } = await open(901, lang); await page.locator('.cg-usermenu__button').click()
      const pos = await page.evaluate(() => getComputedStyle(document.querySelector('.cg-usermenu__list')).position); assert.equal(pos, 'absolute', `a 901 px el panel flota (${lang})`)
      const c = await covered(page); assert.deepEqual(c.hit, [], `0 cubiertos a 901 (${lang})`); assert.equal(c.sw, c.vw, 'sin desborde a 901'); await context.close()
    }
    check(`${kind}: ≥ 901 px sin cambio (panel flotante, 0 cubiertos)`)
    if (kind === 'chromium') for (const width of [320, 390]) { // degradación sin :has()
      const { context, page } = await open(width, 'es', { noHas: true }); await page.locator('.cg-usermenu__button').click(); await page.waitForTimeout(80)
      const c = await covered(page); const gridApplied = await page.evaluate(() => getComputedStyle(document.querySelector('.cg-header')).display)
      console.log(`   sin :has() a ${width} px: encabezado display=${gridApplied}; panel ${c.left}–${c.right} de ${c.vw}; scrollWidth ${c.sw}; cubiertos: ${c.hit.length}`)
      assert.ok(c.left >= 0 && c.right <= c.vw && c.sw === c.vw, `sin :has() el panel no sale de la pantalla (${width})`); await context.close()
    }
    if (kind === 'chromium') check('degradación sin :has() simulada (CSS sin las reglas con :has()): el panel no sale de la pantalla')
    await browser.close()
  }
  console.log(`\nES-323: ${checks} comprobaciones OK`)
})().catch(error => { console.error(error); process.exit(1) })
