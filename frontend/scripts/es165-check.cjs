// ES-165: /app/context/resumes («Mis hojas de vida») en navegador real (Chromium), API simulada, datos sintéticos.
// Mide: axe WCAG 2.x A/AA, un h1, sin desborde y objetivos tamaño >= 24 px (incluidos los enlaces «Subir una nueva versión» y «Volver») en la lista, el diálogo de borrar una versión
// y el de retirar la autorización; textos nuevos de ambos diálogos; foco inicial/Esc. Matriz ES/EN × 390/1360 px × claro/oscuro del sistema (la pantalla es clara por diseño: se mide y se declara).
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es165-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { del: 'Borrar', delBody: 'Se elimina de verdad, sin copias. No se puede deshacer. Las evidencias que ya creaste desde ella se conservan con su origen; lo derivado queda «para revisión».',
    withdraw: 'Retirar mi autorización', withdrawBody: 'Borraremos las hojas de vida guardadas, sin copias, y lo derivado de ellas quedará «para revisión». Tu contexto y tus evidencias ya guardados no se borran.', cancel: 'Cancelar' },
  en: { del: 'Delete', delBody: 'It is deleted for good, with no copies. This cannot be undone. Evidence you already created from it is kept with its source; anything derived is marked “for review”.',
    withdraw: 'Withdraw my permission', withdrawBody: 'We will delete the saved résumés, with no copies, and anything derived from them will be marked “for review”. Your saved context and evidence are not deleted.', cancel: 'Cancel' },
}
const seed = () => [{ id: 3, version: 3, size: 420000, createdAt: '2026-10-12T12:00:00Z' }, { id: 2, version: 2, size: 400000, createdAt: '2026-09-02T12:00:00Z' }, { id: 1, version: 1, size: 370000, createdAt: '2026-07-18T12:00:00Z' }]

async function open(browser, { width, lang, scheme }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { resumes: seed(), deleted: [], consentCalls: [], consent: true, pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'necessary', status: 'granted' }, { purpose: 'resume_ai_reading', status: state.consent ? 'granted' : 'undecided' }] } })
    if (p === '/api/consents/resume_ai_reading' && method === 'PUT') { const status = req.postDataJSON().status; state.consentCalls.push(status); state.consent = status === 'granted'; if (!state.consent) state.resumes = []; return route.fulfill({ json: { status } }) }
    const del = p.match(/^\/api\/user\/resumes\/(\d+)$/)
    if (del && method === 'DELETE') { state.deleted.push(Number(del[1])); state.resumes = state.resumes.filter(r => r.id !== Number(del[1])); return route.fulfill({ json: { deleted: true } }) }
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: state.resumes, maxVersions: 5 } })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/context/resumes', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor()
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => ((el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 28) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height))),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme })
    await axeAndLayout(page, `mis hojas de vida ${tag}`)
    await page.getByRole('button', { name: new RegExp('^' + t.del + ': ') }).first().click(); await page.getByRole('alertdialog').waitFor()
    report((await page.getByRole('alertdialog').innerText()).includes(t.delBody), `el diálogo de borrar una versión dice el texto nuevo ${tag}`)
    await axeAndLayout(page, `diálogo de borrar una versión ${tag}`)
    await page.getByRole('button', { name: t.cancel, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[role=alertdialog]'))
    await page.getByRole('button', { name: t.withdraw, exact: true }).click(); await page.getByRole('alertdialog').waitFor()
    report((await page.getByRole('alertdialog').innerText()).includes(t.withdrawBody), `el diálogo de retirar la autorización dice el texto nuevo (menciona el borrado y que contexto y evidencias no se borran) ${tag}`)
    await axeAndLayout(page, `diálogo de retirar la autorización ${tag}`)
    report(state.deleted.length === 0 && state.consentCalls.length === 0, `abrir y cancelar los diálogos no borra ni retira nada ${tag}`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
