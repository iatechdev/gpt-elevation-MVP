// ES-164: /app/evidence en navegador real (Chromium), API simulada, datos sintéticos.
// Filtro por ESTADO (radios nativos, fieldset/legend, conteo en aria-live, vacío del filtro + «Ver todas», teclado), diálogo de borrar con el texto nuevo,
// línea de revisión «queda como respaldo de tu nivel» y texto de resultado incierto «Tu texto sigue aquí…» (ACK perdido en el guardado).
// Matriz ES/EN × 390/1360 px × claro/oscuro del sistema (la pantalla es clara por diseño: se mide y se declara): axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es164-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { all: 'Todas', draft: 'Borrador', confirmed: 'Confirmada', status: 'Estado', none: 'No hay evidencias con este estado.', showAll: 'Ver todas', count: n => n === 1 ? '1 evidencia' : `${n} evidencias`,
    del: 'Borrar', delBody: 'Se borra con todas sus versiones. Los niveles que registraste sobre ella quedan sin respaldo. No se puede deshacer.', review: 'Revisar para confirmar', effect: 'Al confirmar, esta versión queda como respaldo de tu nivel.',
    saveDraft: 'Guardar borrador', uncertain: 'Tu texto sigue aquí. Reintenta y no se duplica.', retry: 'Reintentar' },
  en: { all: 'All', draft: 'Draft', confirmed: 'Confirmed', status: 'Status', none: 'No entries with this status.', showAll: 'Show all', count: n => n === 1 ? '1 entry' : `${n} entries`,
    del: 'Delete', delBody: 'It is deleted with all its versions. Any levels you recorded on it are left without support. This cannot be undone.', review: 'Review before confirming', effect: 'Once confirmed, this version supports your level.',
    saveDraft: 'Save draft', uncertain: 'Your text is still here. Retry and it will not be duplicated.', retry: 'Retry' },
}
const seed = () => [
  { id: 1, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-10-01T12:00:00.000Z', payload: { title: 'Rediseño del onboarding', goal: 'Reducir abandono', delivered: { text: 'Flujo nuevo', source: 'self_report' }, observedEffect: { known: false } } },
  { id: 2, version: 1, status: 'draft', authoring: 'person', createdAt: '2026-10-02T12:00:00.000Z', payload: { title: 'Taller con el equipo de datos', goal: 'Alinear criterios' } },
  { id: 3, version: 2, status: 'confirmed', authoring: 'person', createdAt: '2026-10-03T12:00:00.000Z', payload: { title: 'Migración del tablero', goal: 'Pasar al nuevo tablero' } },
]

async function open(browser, { width, lang, scheme, path = '/app/evidence', rows = seed(), loseAck = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { rows, writes: [], deleted: [], pageErrors: [], loseAck }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/user/resume-skills') return route.fulfill({ json: { skills: [] } })
    if (p === '/api/evidence' && method === 'GET') return route.fulfill({ json: { evidence: state.rows } })
    if (p === '/api/evidence' && method === 'POST') {
      state.writes.push(route.request().postDataJSON())
      if (state.loseAck) { state.loseAck = false; return route.abort('connectionreset') }
      return route.fulfill({ status: 201, json: { id: 9, version: 1, status: 'draft', created: true } })
    }
    const one = p.match(/^\/api\/evidence\/(\d+)$/)
    if (one && method === 'DELETE') { state.deleted.push(Number(one[1])); state.rows = state.rows.filter(r => r.id !== Number(one[1])); return route.fulfill({ json: { deleted: true } }) }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main a[href], main button, main input:not([type=checkbox]):not([type=radio]), main textarea')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 24)),
    radios: [...document.querySelectorAll('input[type=radio]')].filter(el => { const b = el.getBoundingClientRect(); return b.width < 24 && b.height < 24 }).length,
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const titles = page => page.locator('article h2').allInnerTexts()

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme })
    await page.locator('article h2').first().waitFor()
    await axeAndLayout(page, `lista de evidencias ${tag}`)
    const group = page.getByRole('group', { name: t.status })
    report(await group.count() === 1 && await group.getByRole('radio').count() === 3, `grupo «${t.status}» con 3 radios nativos (fieldset/legend) ${tag}`)
    report(await page.getByRole('radio', { name: t.all }).isChecked() && (await titles(page)).length === 3, `por defecto «${t.all}»: 3 evidencias ${tag}`)
    report(await page.getByRole('status').filter({ hasText: t.count(3) }).count() === 1, `conteo anunciado «${t.count(3)}» en región aria-live ${tag}`)
    await page.getByRole('radio', { name: t.draft, exact: true }).check()
    report((await titles(page)).join('|') === 'Taller con el equipo de datos' && await page.getByRole('status').filter({ hasText: t.count(1) }).count() === 1, `«${t.draft}»: solo el borrador y conteo «${t.count(1)}» ${tag}`)
    await page.getByRole('radio', { name: t.confirmed, exact: true }).check()
    report((await titles(page)).length === 2 && await page.getByRole('status').filter({ hasText: t.count(2) }).count() === 1, `«${t.confirmed}»: dos evidencias y conteo «${t.count(2)}» ${tag}`)
    await axeAndLayout(page, `lista filtrada ${tag}`)
    report(state.writes.length === 0 && state.deleted.length === 0, `filtrar no escribe ni borra nada ${tag}`)
    await ctx.close()
  }

  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    // 1) Teclado en los radios y vacío del filtro con «Ver todas».
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, rows: seed().filter(r => r.status === 'confirmed') })
      await page.locator('article h2').first().waitFor()
      await page.getByRole('radio', { name: t.all, exact: true }).focus(); await page.keyboard.press('ArrowRight')
      report(await page.getByRole('radio', { name: t.draft, exact: true }).isChecked(), `flecha → mueve la selección al siguiente radio ${tag}`)
      report(await page.getByText(t.none).isVisible() && await page.locator('article').count() === 0 && await page.getByRole('status').filter({ hasText: t.count(0) }).count() === 1, `sin resultados: «${t.none}» y conteo ${tag}`)
      await axeAndLayout(page, `lista sin resultados del filtro ${tag}`)
      await page.getByRole('button', { name: t.showAll, exact: true }).click()
      report(await page.getByRole('radio', { name: t.all, exact: true }).isChecked() && await page.locator('article').count() === 2, `«${t.showAll}» vuelve a ver todas ${tag}`)
      report(await page.getByRole('radio', { name: t.all, exact: true }).evaluate(el => el === document.activeElement), `ES-235: tras «${t.showAll}» el foco queda en el radio «${t.all}» (no en body) ${tag}`)
      await ctx.close()
    }
    // 2) Diálogo de borrar con el texto nuevo; foco devuelto al cancelar.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme })
      await page.locator('article h2').first().waitFor()
      const del = page.getByRole('button', { name: new RegExp('^' + t.del + ': Taller') }); await del.click()
      const dialog = page.getByRole('alertdialog'); await dialog.waitFor()
      report((await dialog.innerText()).includes(t.delBody) && await dialog.evaluate(el => el === document.activeElement), `el diálogo de borrar dice el texto del criterio y recibe el foco ${tag}`)
      await axeAndLayout(page, `diálogo de borrar ${tag}`)
      await dialog.getByRole('button', { name: lang === 'es' ? 'Cancelar' : 'Cancel' }).click()
      await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'))
      report(await del.evaluate(el => el === document.activeElement) && state.deleted.length === 0, `cancelar devuelve el foco y no borra ${tag}`)
      await del.click(); await dialog.waitFor(); await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'), null, { timeout: 5000 }).catch(() => {})
      report(await dialog.count() === 0 && await del.evaluate(el => el === document.activeElement) && state.deleted.length === 0, `ES-235: Esc cierra el diálogo de borrar, devuelve el foco y no borra ${tag}`)
      await ctx.close()
    }
    // 3) Revisión («queda como respaldo de tu nivel») e incierto («Tu texto sigue aquí…»).
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, path: '/app/evidence/new', loseAck: true })
      await page.locator('#title').fill('Evidencia sintética'); await page.locator('#situation').fill('Situación sintética'); await page.locator('#responsibility').fill('Mi parte sintética')
      await page.locator('#actions-0').fill('Acción sintética'); await page.locator('#goal').fill('Meta sintética'); await page.locator('#delivered').fill('Entrega sintética')
      await page.getByRole('radio', { name: lang === 'es' ? 'No lo conozco' : 'I do not know it' }).first().check()
      await page.getByRole('button', { name: t.review, exact: true }).click()
      await page.getByText(t.effect).waitFor()
      const effect = await page.getByText(t.effect).evaluate(el => el.getBoundingClientRect().top); const warn = await page.locator('.evidence-warning').evaluate(el => el.getBoundingClientRect().top)
      report(effect < warn, `la revisión dice «${t.effect}» sobre el aviso ${tag}`)
      await axeAndLayout(page, `revisión de la evidencia ${tag}`)
      await page.getByRole('checkbox').check(); await page.getByRole('button', { name: lang === 'es' ? 'Confirmar evidencia' : 'Confirm evidence', exact: true }).click()
      await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      report(await page.getByText(t.uncertain).count() === 1 && await page.getByRole('alert').filter({ hasText: t.uncertain }).count() === 1 && await page.getByRole('status').filter({ hasText: t.uncertain }).count() === 0, `el mensaje de incierto se anuncia una sola vez (role=alert) ${tag}`)
      report(await page.getByRole('button', { name: t.retry, exact: true }).isVisible(), `resultado incierto: «${t.uncertain}» con «${t.retry}» ${tag}`)
      await axeAndLayout(page, `resultado incierto ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.waitForFunction(() => !document.body.innerText.includes('Reintentar') && !document.body.innerText.includes('Retry the'), null, { timeout: 8000 }).catch(() => {})
      const bodies = state.writes.map(b => JSON.stringify(b)); const ids = new Set(state.writes.map(b => b.requestId))
      report(state.writes.length === 2 && ids.size === 1 && [...ids][0], `reintentar envía el MISMO requestId (no duplica) ${tag}`, `POST=${state.writes.length} ids=${ids.size} iguales=${new Set(bodies).size === 1}`)
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
