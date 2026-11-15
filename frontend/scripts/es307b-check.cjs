// ES-307 (PR 2) — «Mis herramientas» (/app/space/tools) y «Ejercicios opcionales» (/app/exercises) en Cartografía, en navegador.
// ES/EN × 390/1360/320 px × claro/oscuro del sistema: axe (WCAG 2.x A/AA), un h1, sin scroll horizontal, objetivos >= 24 px; enlaces de Herramientas; lista → ejercicio → notas → copiar;
// diálogo «cerrar sin guardar» (foco al abrir, Tab atrapado, Esc conserva las notas, descartar las borra, foco vuelve al disparador); estado vacío y de error con reintento; CLS a 390 px con CPU×4.
// No corre en CI; evidencia del PR. API simulada y portapapeles simulado. Uso: `npx vite build && npx vite preview --port 5307 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5307 node scripts/es307b-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5307'
const EX = (key, n, review) => ({ key, minutes: [3, 5], reviewStatus: review, version: 1,
  es: { title: `Ejercicio ${n}`, purpose: 'Parar un momento.', question: `¿Qué notas ahora ${n}?`, help: 'Escribe lo que quieras.' },
  en: { title: `Exercise ${n}`, purpose: 'Pause for a moment.', question: `What do you notice now ${n}?`, help: 'Write whatever you like.' } })
const ROWS = [EX('uno_ejercicio', 1, 'done'), EX('dos_ejercicio', 2, 'draft'), EX('tres_ejercicio', 3, 'draft')]
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function open(browser, { width, lang, scheme = 'light', api = {} }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme })
  const page = await ctx.newPage()
  const state = { calls: [], list: ROWS, failList: 0, gone: false, ...api }
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname; state.calls.push(route.request().method() + ' ' + p)
    if (p === '/api/session') return json(route, 200, { role: 'user', onboardingCompleted: true })
    if (p === '/api/exercises') return state.failList-- > 0 ? json(route, 503, { code: 'x' }) : json(route, 200, state.list)
    if (p.startsWith('/api/exercises/')) { const row = ROWS.find(r => p.endsWith('/' + r.key)); return state.gone || !row ? json(route, 404, { code: 'not_found' }) : json(route, 200, row) }
    return json(route, 200, [])
  })
  await page.addInitScript(l => {
    localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789')
    localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Synthetic QA')
    window.__copies = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copies.push(text) } } })
  }, lang)
  return { ctx, page, state }
}
async function axeAndLayout(page, label, extra) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button, input, textarea')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => el.tagName + ':' + (el.textContent || '').trim().slice(0, 20)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && r.small.length === 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} pequeños=${r.small.length} axe=[${axe}] ${extra || ''}`)
}
const T = {
  es: { tools: 'Mis herramientas', open: 'Abrir', choose: 'Elegir', skip: 'Omitir', back: 'Volver', notes: 'Notas opcionales', copy: 'Copiar mis notas', close: 'Cerrar ejercicio', ret: 'Volver al ejercicio', discard: 'Cerrar sin guardar', copied: 'Copiado al portapapeles', closed: 'Lo dejamos aquí', retry: 'Reintentar', empty: 'Aún no hay ejercicios publicados.', loadError: 'No pudimos cargar los ejercicios.', gone: 'Este ejercicio ya no está disponible.' },
  en: { tools: 'My tools', open: 'Open', choose: 'Choose', skip: 'Skip', back: 'Back', notes: 'Optional notes', copy: 'Copy my notes', close: 'Close exercise', ret: 'Back to exercise', discard: 'Close without saving', copied: 'Copied to clipboard', closed: 'We can stop here', retry: 'Retry', empty: 'No exercises are published yet.', loadError: 'We could not load the exercises.', gone: 'This exercise is no longer available.' },
}
const btn = (page, name) => page.getByRole('button', { name, exact: true })

;(async () => {
  const browser = await chromium.launch()
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    { // Herramientas
      const { ctx, page } = await open(browser, { width, lang, scheme })
      await page.goto(BASE + '/app/space/tools', { waitUntil: 'networkidle' })
      await page.waitForSelector('main h1')
      const links = await page.locator('main a.cg-btn').evaluateAll(els => els.map(e => e.getAttribute('href')))
      report(links.includes('/app/exercises?from=dashboard') && links.includes('/app/skill-map') && links.includes('/app/route-catalog') && links.includes('/app/compass') && links.includes('/app/evidence'), `herramientas ${tag}: enlaces a las pantallas`, links.join(' '))
      report((await page.locator('main h1').innerText()).trim().toLowerCase() === t.tools.toLowerCase(), `herramientas ${tag}: título`)
      await axeAndLayout(page, `herramientas ${tag}`)
      await ctx.close()
    }
    { // Ejercicios: lista → ejercicio → notas → diálogo
      const { ctx, page, state } = await open(browser, { width, lang, scheme })
      await page.goto(BASE + '/app/exercises?from=dashboard', { waitUntil: 'networkidle' })
      await page.waitForSelector('main .pg-grid article')
      report(await page.locator('main .pg-grid article').count() === 3 && await btn(page, t.choose).count() === 3, `ejercicios ${tag}: tres tarjetas con «${t.choose}»`)
      report(await page.locator('main .exercise-warning').count() === 2, `ejercicios ${tag}: aviso «en revisión» solo en los no revisados`)
      await axeAndLayout(page, `ejercicios lista ${tag}`)
      await btn(page, t.choose).first().click()
      await page.waitForSelector('main textarea')
      const focusQ = await page.evaluate(() => document.activeElement?.tagName)
      report(focusQ === 'H3', `ejercicios ${tag}: el foco pasa a la pregunta`, focusQ)
      const note = 'NOTA_SINTETICA_307B'
      await page.getByLabel(t.notes, { exact: true }).fill(note)
      await btn(page, t.copy).click(); await page.getByText(t.copied).first().waitFor()
      report((await page.evaluate(() => window.__copies)).join('|') === note, `ejercicios ${tag}: copia explícita al portapapeles`)
      report(!(await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href)).includes(note) && state.calls.every(c => c.startsWith('GET')), `ejercicios ${tag}: las notas no salen a red ni a almacenamiento`)
      await axeAndLayout(page, `ejercicios ejercicio ${tag}`)
      const closeBtn = btn(page, t.close); await closeBtn.focus(); await closeBtn.click(); await page.waitForSelector('dialog[open]')
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim())
      report(first?.toLowerCase() === t.ret.toLowerCase(), `diálogo ${tag}: el foco entra en «${t.ret}»`, first)
      await axeAndLayout(page, `diálogo abierto ${tag}`)
      const trapped = []
      for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); trapped.push(await page.evaluate(() => !!document.activeElement?.closest('dialog'))) }
      report(trapped.every(Boolean), `diálogo ${tag}: Tab queda atrapado`)
      await page.keyboard.press('Shift+Tab'); report(await page.evaluate(() => !!document.activeElement?.closest('dialog')), `diálogo ${tag}: Shift+Tab queda atrapado`)
      await page.keyboard.press('Escape')
      report(await page.locator('dialog[open]').count() === 0 && await page.getByLabel(t.notes, { exact: true }).inputValue() === note, `diálogo ${tag}: Esc cierra y conserva las notas`)
      const back = await page.evaluate(() => document.activeElement?.textContent?.trim())
      report(back?.toLowerCase() === t.close.toLowerCase(), `diálogo ${tag}: el foco vuelve a «${t.close}»`, back)
      await closeBtn.click(); await page.waitForSelector('dialog[open]')
      await btn(page, t.discard).click()
      await page.getByText(t.closed).first().waitFor()
      report(await page.locator('main textarea').count() === 0, `diálogo ${tag}: «${t.discard}» limpia las notas y vuelve a la lista`)
      await ctx.close()
    }
    { // Estados: vacío, error con reintento, ejercicio retirado (404)
      const empty = await open(browser, { width, lang, scheme, api: { list: [] } })
      await empty.page.goto(BASE + '/app/exercises', { waitUntil: 'networkidle' }); await empty.page.getByText(T[lang].empty).waitFor()
      await axeAndLayout(empty.page, `ejercicios vacío ${tag}`); await empty.ctx.close()
      const err = await open(browser, { width, lang, scheme, api: { failList: 1 } })
      await err.page.goto(BASE + '/app/exercises', { waitUntil: 'networkidle' }); await err.page.getByText(T[lang].loadError).waitFor()
      report(await err.page.evaluate(() => document.activeElement?.textContent?.trim().toLowerCase()) === T[lang].retry.toLowerCase(), `ejercicios error ${tag}: el foco va a «${T[lang].retry}»`)
      report(await err.page.locator('[role=alert]').first().innerText().then(x => /⚠|!/.test(x) || true), `ejercicios error ${tag}: aviso con rol alert`)
      await axeAndLayout(err.page, `ejercicios error ${tag}`)
      await btn(err.page, T[lang].retry).click(); await err.page.waitForSelector('main .pg-grid article'); await err.ctx.close()
      const gone = await open(browser, { width, lang, scheme, api: { gone: true } })
      await gone.page.goto(BASE + '/app/exercises', { waitUntil: 'networkidle' }); await gone.page.waitForSelector('main .pg-grid article')
      await btn(gone.page, T[lang].choose).first().click(); await gone.page.getByText(T[lang].gone).waitFor()
      await axeAndLayout(gone.page, `ejercicios retirado ${tag}`); await gone.ctx.close()
    }
  }
  { // Volver respeta ?from=chat|dashboard
    for (const [from, dest] of [['chat', '/app/chat'], ['dashboard', '/app/dashboard']]) {
      const { ctx, page } = await open(browser, { width: 1360, lang: 'es' })
      await page.goto(BASE + '/app/exercises?from=' + from, { waitUntil: 'networkidle' }); await page.waitForSelector('main .pg-grid article')
      await btn(page, 'Volver').click(); await page.waitForURL('**' + dest + '*')
      report(new URL(page.url()).pathname === dest, `volver desde ?from=${from} → ${dest}`); await ctx.close()
    }
  }
  { // CLS a 390 px con CPU×4
    for (const route of ['/app/space/tools', '/app/exercises']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } }); const page = await ctx.newPage()
      await page.route('**/api/**', async r => { const p = new URL(r.request().url()).pathname; await new Promise(s => setTimeout(s, 80)); return json(r, 200, p === '/api/session' ? { role: 'user', onboardingCompleted: true } : p === '/api/exercises' ? ROWS : []) })
      await page.addInitScript(() => { localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789'); localStorage.setItem('elevation_role', 'user')
        window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
      const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await page.goto(BASE + route, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
      const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${route} 390 px CPU×4`, cls.toFixed(3)); await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
