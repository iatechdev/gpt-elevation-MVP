// ES-236: teclado de los diálogos modales con contenedor, en navegador real (Chromium), API simulada, datos sintéticos.
// En CADA diálogo cubierto (evidencias: borrar; hojas de vida: borrar versión y retirar autorización): Tab y Shift+Tab nunca sacan el foco del diálogo (12 pulsaciones cada uno),
// Esc lo cierra sin borrar ni retirar nada y devuelve el foco al botón que lo abrió, y axe WCAG 2.x A/AA da 0 con el diálogo abierto. ES y EN, 390 y 1360 px.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es236-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const evidenceRows = () => [
  { id: 1, version: 1, status: 'confirmed', authoring: 'person', createdAt: '2026-10-01T12:00:00.000Z', payload: { title: 'Rediseño del onboarding', goal: 'Reducir abandono' } },
  { id: 2, version: 1, status: 'draft', authoring: 'person', createdAt: '2026-10-02T12:00:00.000Z', payload: { title: 'Taller con datos', goal: 'Alinear criterios' } },
]
const resumeRows = () => [{ id: 3, version: 3, size: 420000, createdAt: '2026-10-12T12:00:00Z' }, { id: 2, version: 2, size: 400000, createdAt: '2026-09-02T12:00:00Z' }]
const L = {
  es: { del: 'Borrar', delVersion: 'Borrar', withdraw: 'Retirar mi autorización', cancel: 'Cancelar' },
  en: { del: 'Delete', delVersion: 'Delete', withdraw: 'Withdraw my permission', cancel: 'Cancel' },
}

async function open(browser, { width, lang, path }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { writes: [] }
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (method !== 'GET') state.writes.push(method + ' ' + p)
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/evidence') return route.fulfill({ json: { evidence: evidenceRows() } })
    if (p === '/api/user/resume-skills') return route.fulfill({ json: { skills: [] } })
    if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'resume_ai_reading', status: 'granted' }] } })
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: resumeRows(), maxVersions: 5 } })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor()
  return { ctx, page, state }
}
const inside = page => page.evaluate(() => { const d = document.querySelector('[role=alertdialog]'); return !!d && (d === document.activeElement || d.contains(document.activeElement)) })
async function exercise(page, state, opener, label) {
  await opener.click(); await page.getByRole('alertdialog').waitFor()
  await page.waitForFunction(() => { const d = document.querySelector('[role=alertdialog]'); return d && (d === document.activeElement || d.contains(document.activeElement)) })
  let stayed = true
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); stayed = stayed && await inside(page) }
  report(stayed, `${label}: Tab nunca saca el foco del diálogo (12 pulsaciones)`)
  stayed = true
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Shift+Tab'); stayed = stayed && await inside(page) }
  report(stayed, `${label}: Shift+Tab nunca saca el foco del diálogo (12 pulsaciones)`)
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  report(axe.length === 0, `${label}: axe con el diálogo abierto`, `axe=[${axe}]`)
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'), null, { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(100)
  report(await page.getByRole('alertdialog').count() === 0 && state.writes.length === 0, `${label}: Esc cierra sin borrar ni retirar nada`, state.writes.join(','))
  report(await opener.evaluate(el => el === document.activeElement), `${label}: Esc devuelve el foco al botón que abrió el diálogo`)
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const t = L[lang]; const tag = `${lang} ${width}px`
    { const { ctx, page, state } = await open(browser, { width, lang, path: '/app/evidence' }); await page.locator('article h2').first().waitFor()
      await exercise(page, state, page.getByRole('button', { name: new RegExp('^' + t.del + ': Taller') }), `evidencias · borrar ${tag}`); await ctx.close() }
    { const { ctx, page, state } = await open(browser, { width, lang, path: '/app/context/resumes' }); await page.getByRole('button', { name: new RegExp('^' + t.delVersion + ': ') }).first().waitFor()
      await exercise(page, state, page.getByRole('button', { name: new RegExp('^' + t.delVersion + ': ') }).first(), `hojas de vida · borrar versión ${tag}`); await ctx.close() }
    { const { ctx, page, state } = await open(browser, { width, lang, path: '/app/context/resumes' }); await page.getByRole('button', { name: t.withdraw, exact: true }).waitFor()
      await exercise(page, state, page.getByRole('button', { name: t.withdraw, exact: true }), `hojas de vida · retirar autorización ${tag}`); await ctx.close() }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
