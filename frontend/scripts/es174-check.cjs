// ES-174: «Mis datos» y «Mi plan» en navegador. ES/EN × 390/1360 px: axe (WCAG 2.x A/AA), un h1, sin scroll horizontal, objetivos >= 24 px, diálogo de eliminación
// (foco, Tab atrapado, Esc, palabra de confirmación, error que conserva lo escrito, reintento, éxito), estado caducado y Mi plan (con/sin plan, solicitud, envío).
// No corre en CI; evidencia del PR. API simulada. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es174-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const ID = '3f2b8c1e-4d5a-4b6c-9d7e-0123456789ab'
const PLANS = [
  { id: 1, slug: 'base', name_es: 'Base', name_en: 'Basic', description_es: 'Para empezar.', description_en: 'To get started.', price: '0.00', currency: 'COP', period: 'month', features_es: ['Conversación', 'Diario'], features_en: ['Conversation', 'Journal'], isHighlighted: false, order: 1 },
  { id: 2, slug: 'plus', name_es: 'Plus', name_en: 'Plus', description_es: '', description_en: '', price: '49000', currency: 'COP', period: 'month', features_es: ['Más IA'], features_en: ['More AI'], isHighlighted: true, order: 2 },
  { id: 3, slug: 'pro', name_es: 'Pro', name_en: 'Pro', description_es: '', description_en: '', price: '490000', currency: 'COP', period: 'year', features_es: ['Todo'], features_en: ['Everything'], isHighlighted: false, order: 3 },
]
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function open(browser, { width, lang, scheme = 'light', api = {} }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme })
  const page = await ctx.newPage()
  const state = { calls: [], deletions: 0, expiresIn: 600000, pending: null, currentPlan: null, requests: 0, ...api }
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname; const m = route.request().method()
    state.calls.push(m + ' ' + p)
    if (p === '/api/session' && state.deleted) return json(route, 401, { code: 'session_invalid' })
    if (p === '/api/session') return json(route, 200, { role: 'user', onboardingCompleted: true })
    if (p === '/api/exports/preview') return json(route, 201, { id: ID, expiresAt: new Date(Date.now() + state.expiresIn).toISOString(), data: { schemaVersion: 1, profile: {}, diary: [1, 2, 3], evidence: [] } })
    if (p === `/api/exports/${ID}/download`) return json(route, 200, { profile: { name: 'Synthetic' } })
    if (p === '/api/account/deletion-requests') { state.deletions++; return state.deletions <= (state.failDeletions ?? 0) ? json(route, 503, { code: 'data_rights_failed' }) : (state.deleted = true, json(route, 202, { id: 'abc', status: 'accepted', repeated: false })) }
    if (p === '/api/plans') return json(route, 200, PLANS)
    if (p === '/api/user/plan/me') return json(route, 200, { plan: state.currentPlan, limits: {} })
    if (p === '/api/plan-requests/me') return json(route, 200, { request: state.pending })
    if (p === '/api/plan-requests' && m === 'POST') { state.requests++; const body = JSON.parse(route.request().postData() || '{}'); state.pending = { id: 9, planId: body.planId, status: 'pending' }; return json(route, 201, { request: state.pending }) }
    return json(route, 200, [])
  })
  await page.addInitScript(l => {
    localStorage.setItem('elv_lang', l)
    localStorage.setItem('elevation_token', 'aaa.bbb.ccc-abcdefghijklmnopqrstuvwxyz0123456789')
    localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Synthetic QA')
  }, lang)
  return { ctx, page, state }
}
async function axeAndLayout(page, label, extra) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button, input')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) && el.type !== 'checkbox' }).map(el => (el.innerText || el.id).trim().slice(0, 20)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && r.small.length === 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} pequeños=${r.small.length} axe=[${axe}] ${extra || ''}`)
}
const T = {
  es: { prepare: 'Preparar mi archivo', download: 'Descargar archivo', start: 'Quiero eliminar mi cuenta', word: 'ELIMINAR', confirm: 'Eliminar mi cuenta', cancel: 'Cancelar', retry: 'Reintentar', again: 'Preparar de nuevo', expired: /El archivo venció/, done: /queda en proceso de eliminación/, planBtn: 'Solicitar este plan' },
  en: { prepare: 'Prepare my file', download: 'Download file', start: 'I want to delete my account', word: 'DELETE', confirm: 'Delete my account', cancel: 'Cancel', retry: 'Try again', again: 'Prepare again', expired: /The file expired/, done: /is being deleted/, planBtn: 'Request this plan' },
}
const btn = (page, name) => page.getByRole('button', { name, exact: true })

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) {
    const t = T[lang]; const tag = `${lang} ${width}px`
    { // Mis datos: estados vacío → listo, descarga, y diálogo con axe abierto
      const { ctx, page } = await open(browser, { width, lang })
      await page.goto(BASE + '/app/data', { waitUntil: 'networkidle' })
      await axeAndLayout(page, `datos vacío ${tag}`)
      await btn(page, t.prepare).click(); await page.waitForSelector('text=/Disponible hasta|Available until/')
      const incl = await page.locator('main').innerText()
      report(/Diario \(3\)|Journal \(3\)/.test(incl) && !/schemaVersion/.test(incl), `datos listo ${tag}: resumen de secciones sin metadatos`)
      await axeAndLayout(page, `datos listo ${tag}`)
      const [dl] = await Promise.all([page.waitForEvent('download'), btn(page, t.download).click()])
      report(dl.suggestedFilename() === 'elevation-personal.json', `descarga ${tag}`, dl.suggestedFilename())
      await btn(page, t.start).click(); await page.waitForSelector('dialog[open]')
      const first = await page.evaluate(() => ({ tag: document.activeElement.tagName, inDialog: !!document.activeElement.closest('dialog') }))
      report(first.inDialog, `diálogo ${tag}: el foco entra al abrir`, first.tag)
      const confirmBtn = btn(page, t.confirm).last()
      report(await confirmBtn.isDisabled(), `diálogo ${tag}: «${t.confirm}» inactivo sin palabra`)
      await page.keyboard.type(t.word.slice(0, -1)); report(await confirmBtn.isDisabled(), `diálogo ${tag}: palabra incompleta no habilita`)
      await page.keyboard.type(t.word.slice(-1).toLowerCase()); report(await confirmBtn.isEnabled(), `diálogo ${tag}: palabra completa (en minúscula) habilita`)
      await page.evaluate(() => { document.querySelector('dialog .space-actions')?.scrollIntoView() })
      await axeAndLayout(page, `diálogo ${tag}`)
      // Tab da la vuelta: input → Cancelar → Eliminar → input
      const order = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement.closest('dialog') ? (document.activeElement.innerText || document.activeElement.id).trim() : 'FUERA')) }
      report(!order.includes('FUERA'), `diálogo ${tag}: Tab no sale del diálogo`, order.join(' > '))
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      const back = await page.evaluate(() => document.activeElement.innerText.trim())
      report(back === t.start, `diálogo ${tag}: Esc cierra y el foco vuelve a «${t.start}»`, back)
      await btn(page, t.start).click(); await page.waitForSelector('dialog[open]')
      report(await page.locator('#data-confirm').inputValue() === '', `diálogo ${tag}: al reabrir la palabra empieza vacía`)
      await ctx.close()
    }
    { // Eliminación con un fallo del servidor: el diálogo sigue abierto, lo escrito se conserva y el reintento termina
      const { ctx, page, state } = await open(browser, { width, lang, api: { failDeletions: 1 } })
      await page.goto(BASE + '/app/data', { waitUntil: 'networkidle' })
      await btn(page, t.start).click(); await page.waitForSelector('dialog[open]')
      await page.locator('#data-confirm').fill(t.word)
      await btn(page, t.confirm).last().click()
      await page.waitForSelector('dialog [role=alert]')
      const kept = await page.locator('#data-confirm').inputValue()
      report(kept === t.word && await page.locator('dialog[open]').count() === 1, `eliminar con error ${tag}: diálogo abierto y palabra conservada`, kept)
      await axeAndLayout(page, `diálogo con error ${tag}`)
      await btn(page, t.retry).click(); await page.waitForSelector('main a.elv-btn-primary')
      const text = await page.locator('main').innerText()
      await page.waitForTimeout(800) // la compuerta de acceso no debe llevar a /login mientras se lee el resultado
      const stay = new URL(page.url()).pathname === '/app/data' && t.done.test(await page.locator('main').innerText())
      report(t.done.test(text) && stay && state.deletions === 2, `eliminar reintento ${tag}: la confirmación se queda en pantalla (no salta a /login), ${state.deletions} llamadas`, page.url())
      await axeAndLayout(page, `eliminada ${tag}`)
      await page.locator('main a.elv-btn-primary').click(); await page.waitForTimeout(600)
      const token = await page.evaluate(() => localStorage.getItem('elevation_token'))
      report(token === null && new URL(page.url()).pathname === '/', `volver al inicio ${tag}: sesión local cerrada y llega a la portada`, page.url() + ' token=' + token)
      await ctx.close()
    }
    { // Vista previa que caduca
      const { ctx, page } = await open(browser, { width, lang, api: { expiresIn: 1500 } })
      await page.goto(BASE + '/app/data', { waitUntil: 'networkidle' })
      await btn(page, t.prepare).click(); await page.waitForSelector('text=/Disponible hasta|Available until/')
      await page.waitForSelector('text=' + (lang === 'es' ? 'El archivo venció' : 'The file expired'), { timeout: 5000 })
      report(await btn(page, t.download).count() === 0 && await btn(page, t.again).count() === 1, `caducado ${tag}: se retira «${t.download}» y se ofrece «${t.again}»`)
      await axeAndLayout(page, `caducado ${tag}`)
      await ctx.close()
    }
    { // Mi plan: sin plan / con plan y solicitud / envío
      const { ctx, page, state } = await open(browser, { width, lang })
      await page.goto(BASE + '/app/plan', { waitUntil: 'networkidle' })
      await page.waitForSelector('.space-plan')
      const cols = await page.evaluate(() => new Set([...document.querySelectorAll('.space-plan')].map(el => Math.round(el.getBoundingClientRect().top))).size)
      report(await page.locator('.space-plan').count() === 3 && (width === 390 ? cols === 3 : cols === 1), `plan sin plan ${tag}: 3 tarjetas, ${width === 390 ? '1 columna' : '3 columnas'}`, 'filas=' + cols)
      report(/Aún no tienes un plan|don't have a plan/.test(await page.locator('main').innerText()), `plan sin plan ${tag}: estado vacío`)
      await axeAndLayout(page, `plan sin plan ${tag}`)
      await page.getByRole('button', { name: new RegExp(t.planBtn + ' · Plus') }).click()
      await page.waitForSelector('text=' + (lang === 'es' ? 'Registramos tu solicitud' : 'We registered your request'))
      const after = await page.evaluate(() => ({ pend: !!document.querySelector('#plan-pending'), enabled: [...document.querySelectorAll('.space-plan button')].filter(b => !b.disabled).length }))
      report(state.requests === 1 && after.pend && after.enabled === 0, `plan envío ${tag}: 1 solicitud, sección pendiente y botones inactivos`, JSON.stringify(after))
      await axeAndLayout(page, `plan con solicitud ${tag}`)
      await ctx.close()
    }
    { // Mi plan con plan actual
      const { ctx, page } = await open(browser, { width, lang, api: { currentPlan: { id: 1, name_es: 'Base', name_en: 'Basic' }, pending: null } })
      await page.goto(BASE + '/app/plan', { waitUntil: 'networkidle' }); await page.waitForSelector('.space-plan')
      const current = await page.getByRole('button', { name: new RegExp(t.planBtn + ' · ' + (lang === 'es' ? 'Base' : 'Basic')) }).isDisabled()
      const text = await page.locator('main').innerText()
      report(current && /Gratis|Free/.test(text) && /Es tu plan actual|This is your current plan/.test(text), `plan actual ${tag}: su botón inactivo con motivo y precio gratis`)
      await axeAndLayout(page, `plan actual ${tag}`)
      await ctx.close()
    }
  }
  { // Modo oscuro: este ámbito es claro por diseño; se mide y se declara (no se amplía el alcance)
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', scheme: 'dark' })
    await page.goto(BASE + '/app/data', { waitUntil: 'networkidle' })
    const bg = await page.evaluate(() => ({ page: getComputedStyle(document.querySelector('.space-page')).backgroundColor, body: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.querySelector('.space-page')).color }))
    console.log('INFO  modo oscuro del sistema: fondo del espacio ' + bg.page + ', body ' + bg.body + ', texto ' + bg.color + ' (el ámbito .space-scope no define reglas de modo oscuro: se mantiene claro y legible)')
    await axeAndLayout(page, 'datos con prefers-color-scheme: dark')
    await ctx.close()
  }
  await browser.close()
  process.exit(failures ? 1 : 0)
})()
