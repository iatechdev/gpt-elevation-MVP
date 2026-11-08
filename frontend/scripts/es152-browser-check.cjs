// ES-152: verificación en navegador real de la página /design-system (no corre en CI; evidencia del PR).
// Uso: levantar `npx vite preview --port 5299` y luego
//   PLAYWRIGHT_MODULE=<ruta a playwright> AXE_PATH=<ruta a axe.min.js> BASE=http://localhost:5299 SHOTS=<carpeta> node scripts/es152-browser-check.cjs
// Comprueba, en ES/EN × claro/oscuro × 390 y 1360 px: axe (WCAG 2 A/AA), sin desplazamiento horizontal, objetivos de 46 px, tipografías cargadas,
// diálogo (foco entra, queda atrapado, Escape cierra, vuelve al disparador), pestañas con flechas y relieve de espera sin animación con movimiento reducido.
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const SHOTS = process.env.SHOTS
let failures = 0
const log = (name, ok, extra = '') => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${name} ${extra}`) }

;(async () => {
  const browser = await chromium.launch()
  for (const [width, height] of [[1360, 900], [390, 844]]) {
    for (const lang of ['es', 'en']) {
      for (const theme of ['light', 'dark']) {
        const tag = `${width}px/${lang}/${theme}`
        const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' })
        const page = await ctx.newPage()
        const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
        await page.addInitScript(([l, t]) => { localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', t) }, [lang, theme])
        await page.goto(`${BASE}/design-system`, { waitUntil: 'networkidle' })
        await page.waitForSelector('h1')
        log(`${tag} un solo h1`, (await page.locator('h1').count()) === 1)
        log(`${tag} tema aplicado`, (await page.locator('.cg').first().getAttribute('data-theme')) === theme)
        log(`${tag} <html lang>`, (await page.evaluate(() => document.documentElement.lang)) === lang)
        const fonts = await page.evaluate(async () => { await document.fonts.ready; return ['700 1rem "Barlow Condensed"', '400 1rem "Barlow"', 'italic 500 1rem "Spectral"'].map(f => document.fonts.check(f)) })
        log(`${tag} tipografías cargadas`, fonts.every(Boolean), JSON.stringify(fonts))
        const sw = await page.evaluate(() => document.documentElement.scrollWidth)
        log(`${tag} sin desplazamiento horizontal`, sw <= width, `scrollWidth=${sw}`)
        const small = await page.evaluate(() => [...document.querySelectorAll('.cg-btn, .cg-input, .cg-select, .cg-tab, .cg-scale label')].filter(el => el.getBoundingClientRect().height < 45.5 && el.getBoundingClientRect().height > 0).map(el => el.className + ' h=' + Math.round(el.getBoundingClientRect().height)))
        log(`${tag} objetivos táctiles ≥ 46 px`, small.length === 0, small.slice(0, 3).join(' | '))
        // El selector de idioma y de tema de la barra mide 46 px porque es .cg-select.
        await page.addScriptTag({ content: axeSource })
        const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }))
        const bad = axe.violations.map(v => `${v.id}(${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)
        log(`${tag} axe WCAG 2 A/AA sin violaciones`, bad.length === 0, bad.join(' || '))
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/es152-${width}-${lang}-${theme}.png`, fullPage: true })

        if (width === 1360 && lang === 'es' && theme === 'light') {
          // Diálogo
          const open = page.getByRole('button', { name: 'Abrir diálogo', exact: true })
          await open.focus(); await page.keyboard.press('Enter')
          await page.waitForSelector('dialog[open]')
          const inside = () => page.evaluate(() => document.querySelector('dialog[open]')?.contains(document.activeElement) ?? false)
          log('diálogo: el foco entra al abrir', await inside())
          log('diálogo: aria-modal y título enlazado', await page.evaluate(() => { const d = document.querySelector('dialog[open]'); const id = d.getAttribute('aria-labelledby'); return d.getAttribute('aria-modal') === 'true' && !!document.getElementById(id) && document.getElementById(id).textContent.length > 0 }))
          let trapped = true
          for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); trapped = trapped && (await inside()) }
          for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); trapped = trapped && (await inside()) }
          log('diálogo: Tab y Shift+Tab quedan atrapados', trapped)
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/es152-dialogo-abierto.png` })
          await page.keyboard.press('Escape')
          await page.waitForFunction(() => !document.querySelector('dialog[open]'))
          log('diálogo: Escape cierra', true)
          log('diálogo: el foco vuelve al disparador', await page.evaluate(() => document.activeElement?.textContent === 'Abrir diálogo'))
          // Pestañas
          const tab1 = page.getByRole('tab', { name: 'Resumen' }); await tab1.focus()
          await page.keyboard.press('ArrowRight')
          log('pestañas: ArrowRight selecciona y enfoca la siguiente', (await page.getByRole('tab', { name: 'Detalle' }).getAttribute('aria-selected')) === 'true' && await page.evaluate(() => document.activeElement?.textContent === 'Detalle'))
          await page.keyboard.press('End')
          log('pestañas: End va a la última', (await page.getByRole('tab', { name: 'Historial' }).getAttribute('aria-selected')) === 'true')
          await page.keyboard.press('Home')
          log('pestañas: Home va a la primera', (await page.getByRole('tab', { name: 'Resumen' }).getAttribute('aria-selected')) === 'true')
          log('pestañas: una sola parada de Tab', (await page.locator('[role=tab][tabindex="0"]').count()) === 1)
          // Cambio de tema desde la barra
          await page.selectOption('#cg-theme', 'dark')
          log('tema: elegir oscuro fija data-theme y lo recuerda', (await page.locator('.cg').first().getAttribute('data-theme')) === 'dark' && (await page.evaluate(() => localStorage.getItem('elv_theme'))) === 'dark')
        }
        if (width === 390 && lang === 'es' && theme === 'light') {
          const tableVisible = await page.evaluate(() => [...document.querySelectorAll('.cg-tablewrap')].every(el => getComputedStyle(el).display === 'none'))
          const cardsVisible = await page.evaluate(() => [...document.querySelectorAll('.cg-cards')].every(el => getComputedStyle(el).display !== 'none'))
          log('390 px: la tabla pasa a tarjetas', tableVisible && cardsVisible)
        }
        log(`${tag} sin errores de consola`, errors.length === 0, errors.join(' | ').slice(0, 200))
        await ctx.close()
      }
    }
  }
  // Movimiento reducido
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/design-system`, { waitUntil: 'networkidle' })
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.cg-relief--loading')).animationName)
  log('movimiento reducido: el relieve de espera no se anima', anim === 'none', anim)
  await ctx.close()
  // Sistema oscuro sin elección guardada
  const dark = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark' })
  const dp = await dark.newPage()
  await dp.goto(`${BASE}/design-system`, { waitUntil: 'networkidle' })
  log('sin elección: respeta prefers-color-scheme oscuro', (await dp.evaluate(() => getComputedStyle(document.querySelector('.cg')).getPropertyValue('--cg-ground').trim())) === '#0e1613')
  await dark.close()
  await browser.close()
  console.log(failures ? `FALLAS: ${failures}` : 'TODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
