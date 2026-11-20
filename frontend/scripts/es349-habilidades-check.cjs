// ES-349 (parte 1): /admin/skill-catalog dentro del marco de Administración, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe wcag2a/2aa/21a/21aa/22aa = 0 en 7 escenas (versiones, borrador, habilidad con faltantes, nueva con errores, publicada, panel de publicar, diálogo de quitar) × ES/EN × 1360/390/320 × claro/oscuro;
// un solo h1, un solo main, un solo «Saltar al contenido», un solo selector ES/EN (el del marco), sin clases propias antiguas (skcat-*), sin estilos en línea, sin desborde, objetivos >= 24 px,
// la tabla pasa a tarjetas en móvil, y el diálogo de quitar: foco inicial en Cancelar, Tab atrapado, Esc cierra y devuelve el foco. Con CLS=1: CLS a 390 px con CPU×4.
// Uso: npx vite build --outDir <dist> --emptyOutDir && npx vite preview --outDir <dist> --host 127.0.0.1 --port 4349 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4349 node scripts/es349-habilidades-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4349'
let failures = 0, total = 0
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡]/u
const level = n => ({ es: n < 3 ? `Criterio ${n} sintético` : '', en: n < 3 ? `Synthetic criterion ${n}` : '' })
const skill = (key, over = {}) => ({ skillKey: key, type: 'transversal', labels: { es: `Habilidad ${key}`, en: `Skill ${key}` }, rubric: { levels: { 1: level(1), 2: level(2), 3: level(3), 4: level(4) }, source: 'Fuente sintética', verifiedBy: 'Persona sintética', verifiedAt: '2026-11-01' }, territories: ['t1'], missing: [], updatedAt: '2026-11-17T10:00:00.000Z', ...over })
const catalogs = [{ id: 3, version: 3, status: 'draft', publishedAt: null, skillCount: 2 }, { id: 2, version: 2, status: 'published', publishedAt: '2026-10-20T12:00:00.000Z', skillCount: 2 }]
const skills = [skill('comunicacion'), skill('analisis_de_datos_con_clave_larga_desborde', { type: 'domain', missing: ['rubric.levels.2.en', 'rubric.source'], territories: [] })]
async function open(browser, { width, lang, scheme, path, cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'admin'); localStorage.setItem('elv_lang', l); window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang])
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'admin', onboardingCompleted: true } })
    if (p === '/api/admin/skill-catalog') return route.fulfill({ json: { catalogs } })
    const m = /^\/api\/admin\/skill-catalog\/(\d+)$/.exec(p); if (m) return route.fulfill({ json: { ...catalogs.find(c => c.id === Number(m[1])), skills } })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.locator('h1').first().waitFor({ timeout: 8000 }); await page.waitForTimeout(300)
  return { ctx, page, errors }
}
const SCENES = { versiones: '/admin/skill-catalog', borrador: '/admin/skill-catalog/3', habilidad: '/admin/skill-catalog/3/skills/analisis_de_datos_con_clave_larga_desborde', nueva: '/admin/skill-catalog/3/skills/new', publicada: '/admin/skill-catalog/2', publicar: '/admin/skill-catalog/3', quitar: '/admin/skill-catalog/3/skills/comunicacion' }
;(async () => {
  const browser = await chromium.launch()
  for (const name of (process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(SCENES))) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
    total++; let ctx, page, errors
    try {
      ({ ctx, page, errors } = await open(browser, { width, lang, scheme, path: SCENES[name] }))
      if (name === 'nueva') { await page.locator('form button[type=submit]').click({ timeout: 5000 }); await page.waitForTimeout(300) }
      if (name === 'publicar') { await page.getByRole('button', { name: /Publicar…|Publish…/ }).click(); await page.waitForTimeout(300) }
      if (name === 'quitar') { await page.getByRole('button', { name: /^(Quitar|Remove)/ }).first().click(); await page.waitForTimeout(300) }
    } catch (e) { failures++; console.log(`FALLA ${name} ${lang} ${width}px ${scheme}: escena no alcanzada: ${String(e.message).split('\n').slice(0, 9).join(' | ')}`); continue }
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const m = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, mains: document.querySelectorAll('main').length, skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      langGroups: document.querySelectorAll('[role=group][aria-label*="dioma"], [role=group][aria-label*="anguage"]').length, old: document.querySelectorAll('[class*="skcat-"], .elv-btn').length, inline: document.querySelectorAll('main [style]').length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText,
      small: [...document.querySelectorAll('main button, main a[href], main input, main select, main textarea, dialog[open] button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) }).length,
      cards: getComputedStyle(document.querySelector('.cg-cards') ?? document.body).display, dialog: !!document.querySelector('dialog[open]') }))
    const extra = []
    if (name === 'versiones' && width <= 640) extra.push(['la tabla pasa a tarjetas', m.cards !== 'none'])
    if (name === 'quitar') {
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim()); extra.push(['diálogo abierto con foco inicial en Cancelar', m.dialog && /Cancelar|Cancel/.test(first || '')])
      await page.keyboard.press('Shift+Tab'); extra.push(['Tab atrapado dentro del diálogo', await page.evaluate(() => document.activeElement?.closest('dialog') !== null)])
      await page.keyboard.press('Escape'); await page.waitForTimeout(200)
      extra.push(['Esc cierra y devuelve el foco al botón «Quitar»', await page.evaluate(() => !document.querySelector('dialog[open]') && /Quitar|Remove/.test(document.activeElement?.textContent || ''))])
    }
    if (name === 'nueva') extra.push(['errores de campo con palabras', await page.getByText(/obligatori|required|clave|key/i).count() > 0])
    if (name === 'publicar') extra.push(['panel «para publicar falta» con enlaces a los campos', await page.locator('a.cg-linkbtn').count() > 0])
    const bad = extra.filter(([, ok]) => !ok).map(([label]) => label)
    const ok = axe.length === 0 && m.h1 === 1 && m.mains === 1 && m.skips === 1 && m.langGroups <= 1 && m.old === 0 && m.inline === 0 && m.overflow <= 0 && m.small === 0 && !EMOJI.test(m.text) && errors.length === 0 && bad.length === 0
    if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${name} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${m.h1} main=${m.mains} saltar=${m.skips} selectorIdioma=${m.langGroups} clasesAntiguas=${m.old} inline=${m.inline} desborde=${m.overflow} objetivos<24=${m.small} errores=${errors.length}` + (bad.length ? ` | NO CUMPLE: ${bad.join('; ')}` : ''))
    await ctx.close()
  }
  console.log(`${total - failures}/${total} combinaciones OK`)
  if (process.env.CLS === '1') for (const name of ['versiones', 'borrador', 'habilidad']) {
    const values = [], sizes = []
    for (let i = 0; i < 6; i++) { const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme: 'light', path: SCENES[name], cpu: 4 }); await page.waitForTimeout(1500); values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close() }
    values.sort((a, b) => a - b); sizes.sort((a, b) => a - b)
    console.log(`CLS 390px CPU×4 ${name}: mediana=${values[3].toFixed(4)} máx=${values[5].toFixed(4)} | texto útil de <main> mediana=${sizes[3]}`); if (values[5] > 0.1) failures++
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
