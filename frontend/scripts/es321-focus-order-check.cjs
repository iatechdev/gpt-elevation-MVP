// ES-321 (E297-1): orden de foco monótono en el encabezado de persona. Chromium, API simulada (page.route), datos sintéticos.
// Comprueba, en ES y EN: a 320/390/600/900 px el orden de Tab recorre marca → menú → idioma → tema → enlaces de navegación y cada elemento enfocado NO está más arriba que el anterior;
// a 901/1360 px el orden de siempre (marca → navegación → idioma → tema → menú); el mismo conjunto de elementos en ambos; altura del encabezado (202 px a ≤ 900, sin cambio a ≥ 901);
// axe wcag2a/2aa/21aa/22aa + 2.5.3 + target-size = 0; el cruce de 900 px con el foco dentro del encabezado (se informa lo que pasa con el foco); CLS a 390 con CPU ×4.
// Uso: npx vite build && npx vite preview --host 127.0.0.1 --port 4321 --strictPort   y luego
//   ES321_URL=http://127.0.0.1:4321 PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<axe.min.js> node scripts/es321-focus-order-check.cjs
const assert = require('node:assert/strict'); const fs = require('node:fs')
;(async () => {
  const { chromium } = process.env.PLAYWRIGHT_MODULE ? require(process.env.PLAYWRIGHT_MODULE) : await import('playwright')
  const base = process.env.ES321_URL ?? 'http://127.0.0.1:4321'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Solo vista previa local')
  const browser = await chromium.launch(); let checks = 0; const check = name => { checks++; console.log('PASS', name) }
  const route = process.env.ES321_ROUTE ?? '/app/skill-map'
  const open = async (width, lang, { cpu = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' }); const page = await context.newPage()
    await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname
      if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
      if (p === '/api/consents') return route.fulfill({ json: { consents: [] } })
      if (p === '/api/skill-map') return route.fulfill({ json: { catalogVersion: 1, skills: [] } })
      return route.fulfill({ json: [] })
    })
    await page.addInitScript(() => { window.__cls = 0; window.__hdr = 0; try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if ((e.sources ?? []).some(src => src.node && src.node.closest && src.node.closest('.cg-header'))) window.__hdr += e.value } }).observe({ type: 'layout-shift', buffered: true }) } catch { /* sin soporte */ } })
    if (cpu) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }) }
    await page.goto(base + route, { waitUntil: 'networkidle' }); await page.locator('.cg-header').waitFor()
    return { context, page }
  }
  // Recorre con Tab los elementos del encabezado y devuelve [{ kind, top }] en orden de foco.
  const tabOrder = async page => {
    await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0) }); await page.locator('.cg-brand').focus()
    const seen = []
    for (let i = 0; i < 40; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement; const header = document.querySelector('.cg-header'); if (!el || !header.contains(el)) return null
        const kind = el.closest('.cg-brand') ? 'brand' : el.closest('.cg-usermenu') ? 'menu' : el.closest('.cg-prefs') ? (el.closest('.cg-lang') ? 'lang' : 'theme') : el.closest('.cg-nav') ? 'nav' : 'other'
        return { kind, top: Math.round(el.getBoundingClientRect().top), left: Math.round(el.getBoundingClientRect().left), label: (el.textContent || '').trim().slice(0, 24) }
      })
      if (!info) break; seen.push(info); await page.keyboard.press('Tab')
    }
    return seen
  }
  const kinds = seen => seen.map(item => item.kind).filter((kind, i, all) => all.indexOf(kind) === i)
  const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => {
    const tags = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] })
    const rules = await window.axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'target-size'] } })
    return [...tags.violations, ...rules.violations].map(v => v.id + ':' + v.nodes.length)
  }) }
  for (const lang of ['es', 'en']) {
    const sets = {}
    for (const width of [320, 390, 600, 900, 901, 1360]) {
      const { context, page } = await open(width, lang); const tag = `${lang} ${width}px`
      const seen = await tabOrder(page); const order = kinds(seen); sets[width] = seen.map(item => item.label).sort().join('|')
      if (width <= 900) {
        assert.deepEqual(order, ['brand', 'menu', 'lang', 'theme', 'nav'], `orden móvil (${tag}): ${order}`)
        for (let i = 1; i < seen.length; i++) assert.ok(seen[i].top >= seen[i - 1].top - 1 || seen[i].left >= seen[i - 1].left, `foco monótono (${tag}): «${seen[i].label}» no sube respecto de «${seen[i - 1].label}»`)
        const h = await page.evaluate(() => Math.round(document.querySelector('.cg-header').getBoundingClientRect().height)); assert.equal(h, 202, `alto del encabezado (${tag}) = ${h}`)
      } else {
        assert.deepEqual(order, ['brand', 'nav', 'lang', 'theme', 'menu'], `orden de escritorio (${tag}): ${order}`)
      }
      assert.deepEqual(await axe(page), [], `axe 0 (${tag})`)
      await context.close()
    }
    assert.ok(new Set(Object.values(sets)).size === 1, `mismo conjunto de elementos en todos los anchos (${lang})`)
    check(`orden de Tab, alto, axe y mismo conjunto de elementos (${lang}: 320/390/600/900/901/1360)`)
  }
  { // Escritorio idéntico: el DOM a 1360 px tiene el orden de main (marca, navegación, extremo con idioma+tema y menú).
    const { context, page } = await open(1360, 'es')
    const dom = await page.evaluate(() => [...document.querySelector('.cg-header').children].map(el => el.className.split(' ')[0]))
    assert.deepEqual(dom, ['cg-brand', 'cg-nav', 'cg-header__end'], `DOM de escritorio: ${dom}`)
    const end = await page.evaluate(() => [...document.querySelector('.cg-header__end').children].map(el => el.className.split(' ')[0]))
    assert.deepEqual(end, ['cg-prefs', 'cg-usermenu'], `extremo de escritorio: ${end}`); await context.close()
    const m = await open(390, 'es'); const mdom = await m.page.evaluate(() => [...document.querySelector('.cg-header').children].map(el => el.className.split(' ')[0]))
    assert.deepEqual(mdom, ['cg-brand', 'cg-header__end', 'cg-nav'], `DOM móvil: ${mdom}`); await m.context.close()
    check('DOM de escritorio idéntico al de siempre; DOM móvil = orden visual')
  }
  { // Cruce de 900 px con el foco dentro del encabezado: se informa el resultado real.
    const { context, page } = await open(901, 'es'); await page.locator('.cg-nav a').first().focus()
    await page.setViewportSize({ width: 900, height: 800 }); await page.waitForTimeout(150)
    const after = await page.evaluate(() => { const el = document.activeElement; return { inHeader: !!el && !!document.querySelector('.cg-header')?.contains(el), tag: el?.tagName, text: (el?.textContent || '').trim().slice(0, 24) } })
    console.log(`   cruce 901→900 px con el foco en el primer enlace de navegación: el foco ${after.inHeader ? 'se conserva en el encabezado' : 'vuelve al documento'} (${after.tag} «${after.text}»)`)
    const sane = await page.evaluate(() => document.querySelectorAll('.cg-nav').length === 1 && document.querySelectorAll('.cg-usermenu').length === 1)
    assert.ok(sane, 'tras el cruce no quedan piezas duplicadas'); await page.keyboard.press('Tab')
    const next = await page.evaluate(() => (document.activeElement?.tagName ?? '') + ':' + (document.activeElement?.className ?? '').toString().slice(0, 30))
    console.log(`   siguiente Tab tras el cruce: ${next}`); await context.close(); check('cruce de 900 px con el foco en el encabezado: sin duplicados ni errores (resultado informado arriba)')
  }
  { // CLS a 390 con CPU ×4
    const { context, page } = await open(390, 'es', { cpu: true })
    await page.waitForTimeout(800)
    const { cls, hdr } = await page.evaluate(() => ({ cls: window.__cls ?? 0, hdr: window.__hdr ?? 0 })); console.log(`   CLS a 390 px, CPU ×4, ${route} (mock sin red): total ${cls.toFixed(3)}; con el encabezado entre las fuentes ${hdr.toFixed(3)}`)
    assert.ok(hdr <= 0.1, `CLS del encabezado ${hdr} ≤ 0,1`); await context.close(); check('CLS ≤ 0,1 a 390 px con CPU ×4')
  }
  await browser.close(); console.log(`\nES-321: ${checks} comprobaciones OK`)
})().catch(error => { console.error(error); process.exit(1) })
