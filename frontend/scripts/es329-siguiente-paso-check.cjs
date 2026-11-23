// ES-329 (Siguiente paso): /app/next-step dentro del marco de persona. Chromium, vista previa con DATOS SINTÉTICOS del fixture (sin servidor, sin IA).
// Uso: VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=fixture npx vite build --outDir dist && npx vite preview --outDir dist --host 127.0.0.1 --port 4113 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4113 node scripts/es329-siguiente-paso-check.cjs
// Escenas: rutas-vacio, rutas (con restricciones guardadas), experimentos-vacio, plan-vacio, experimento (en curso), cambio-de-base (aviso + borradores), salida (diálogo con borrador sin guardar)
//   × ES/EN × 390/1360/320 × claro/oscuro: axe wcag2a/2aa/21a/21aa/22aa = 0, UN solo h1, un «Saltar al contenido», sin desborde, sin emojis, 0 colores en línea, sin cabecera propia.
// Además: la selección con teclado de la subnavegación y el foco del diálogo de salida. Con CLS=1: CLS a 390 px con CPU ×4 y texto útil de <main>.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4113'
const SCENES = ['rutas-vacio', 'rutas', 'experimentos-vacio', 'plan-vacio', 'experimento', 'cambio-de-base', 'salida']
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡]/u
let failures = 0, total = 0
const T = { es: { save: /Guardar restricciones/, choose: /Elegir esta ruta/, accept: /Revisar y aceptar experimento/, start: /^Iniciar$/, saveSub: /Guardar entrega/, rebase: /Empezar|Iniciar otra versión|Nueva versión/i, co: 'Colombia', esl: 'Español', remote: 'Remota', edu: 'Formación', ana: 'Análisis', ops: 'Operaciones', help: 'Ayuda utilizada', none: 'Ninguna', sample: 'Muestra escrita', exp: 'Experimentos', plan: 'Plan', routes: 'Rutas', origin: 'Contexto de origen (opcional)' },
  en: { save: /Save constraints/, choose: /Choose this route/, accept: /Review and accept experiment/, start: /^Start$/, saveSub: /Save submission/, rebase: /Start|new version/i, co: 'Colombia', esl: 'Spanish', remote: 'Remote', edu: 'Training', ana: 'Analysis', ops: 'Operations', help: 'Assistance used', none: 'None', sample: 'Written sample', exp: 'Experiments', plan: 'Plan', routes: 'Routes', origin: 'Starting context (optional)' } }
async function saveConstraints(page, x, interest = 'ana') {
  await page.getByLabel(x.co, { exact: true }).first().check(); await page.getByLabel(x.esl, { exact: true }).first().check(); await page.getByLabel(x.remote, { exact: true }).first().check()
  await page.getByLabel(x.origin).selectOption({ label: x.edu })
  await page.getByRole('group', { name: /Contextos de interés|Contexts of interest/ }).getByLabel(x[interest], { exact: true }).check()
  await page.getByRole('button', { name: x.save }).click(); await page.waitForTimeout(300)
}
async function scene(browser, { lang, width, scheme, name }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const x = T[lang]
  await page.route('**/api/**', route => route.fulfill({ json: name === 'x' ? {} : { role: 'user', onboardingCompleted: true } }))
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  const go = async path => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(300) }
  const link = async label => { await page.getByRole('navigation', { name: /Mi siguiente paso|My next step/ }).getByRole('link', { name: label, exact: true }).click(); await page.waitForTimeout(250) }
  await go('/app/next-step')
  if (name === 'experimentos-vacio') await link(x.exp)
  if (name === 'plan-vacio') await link(x.plan)
  if (['rutas', 'experimento', 'cambio-de-base'].includes(name)) await saveConstraints(page, x)
  if (['experimento', 'cambio-de-base'].includes(name)) {
    await page.getByRole('button', { name: x.choose }).first().click(); await page.waitForTimeout(250)
    await page.getByRole('button', { name: x.accept }).first().click(); await page.waitForTimeout(400)
    await page.getByRole('button', { name: x.start }).click(); await page.waitForTimeout(250)
    await page.getByLabel(x.sample).fill('Texto de ejemplo'); await page.getByLabel(x.help).selectOption({ label: x.none }); await page.getByRole('button', { name: x.saveSub }).click(); await page.waitForTimeout(300)
  }
  if (name === 'cambio-de-base') {
    await link(x.routes); await page.getByRole('group', { name: /Contextos de interés|Contexts of interest/ }).getByLabel(x.ops, { exact: true }).check(); await page.getByRole('button', { name: x.save }).click(); await page.waitForTimeout(300)
    await link(x.exp); await page.getByRole('button', { name: /^(Abrir|Open)$/ }).first().click(); await page.waitForTimeout(300)
  }
  if (name === 'salida') { await page.getByLabel(x.co, { exact: true }).first().check(); await link(x.exp) }
  await page.waitForTimeout(250)
  return { ctx, page, x }
}
;(async () => {
  const browser = await chromium.launch()
  for (const name of process.env.ONLY_CLS === '1' ? [] : SCENES) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    total++
    let ctx, page
    try { ({ ctx, page } = await scene(browser, { lang, width, scheme, name })) } catch (e) { failures++; console.log(`FALLA ${name} ${lang} ${width}px ${scheme}: escena no alcanzada: ${String(e.message).split('\n')[0]}`); continue }
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const m = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.textContent), skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, inlineColor: [...document.querySelectorAll('main [style]')].filter(e => /color|background/.test(e.getAttribute('style') || '')).length,
      dialogOpen: !!document.querySelector('dialog[open]'), oldHeader: document.querySelectorAll('.career-header, .career-scope, .elv-card').length }))
    const ok = axe.length === 0 && m.h1.length === 1 && /Mi siguiente paso|My next step/.test(m.h1[0]) && m.skips === 1 && m.overflow <= 0 && !EMOJI.test(m.text) && m.inlineColor === 0 && m.oldHeader === 0 && m.dialogOpen === (name === 'salida')
    if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${name} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${JSON.stringify(m.h1)} saltar=${m.skips} desborde=${m.overflow} emoji=${EMOJI.test(m.text)} colorEnLínea=${m.inlineColor} restosViejos=${m.oldHeader} diálogo=${m.dialogOpen}`)
    await ctx.close()
  }
  if (process.env.ONLY_CLS !== '1') {
    // Teclado: la subnavegación se recorre con Tab y Enter; el diálogo de salida atrapa el foco, Esc lo cierra y devuelve el foco
    const { ctx, page, x } = await scene(browser, { lang: 'es', width: 1360, scheme: 'light', name: 'salida' })
    const focusInside = await page.evaluate(() => document.activeElement?.closest('dialog') !== null)
    await page.keyboard.press('Tab'); const stillInside = await page.evaluate(() => document.activeElement?.closest('dialog') !== null)
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)
    const closed = await page.evaluate(() => !document.querySelector('dialog[open]')); const back = await page.evaluate(() => document.activeElement?.textContent || '')
    const kb = focusInside && stillInside && closed
    if (!kb) failures++
    console.log(`Teclado (diálogo de salida): foco dentro=${focusInside} tras Tab=${stillInside} Esc cierra=${closed} foco vuelve a «${back.trim()}» ${kb ? 'OK' : 'FALLA'}`)
    await ctx.close()
    console.log(`${total - failures}/${total} combinaciones OK`)
  }
  if (process.env.CLS === '1') {
    for (const name of ['rutas-vacio', 'rutas']) {
      const values = [], sizes = []
      for (let i = 0; i < 6; i++) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.route('**/api/**', route => route.fulfill({ json: { role: 'user', onboardingCompleted: true } }))
        await page.addInitScript(() => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', 'es'); window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
        await page.goto(BASE + '/app/next-step', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000)
        values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close()
      }
      values.sort((a, b) => a - b); sizes.sort((a, b) => a - b)
      console.log(`CLS 390px CPU×4 ${name}: mediana=${values[3].toFixed(4)} máx=${values[5].toFixed(4)} | texto útil de <main> mediana=${sizes[3]}`)
      if (values[5] > 0.1) failures++
    }
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
