// F404-1 (ES-286): tras source_consent_revoked / source_consent_required el interruptor de la fuente refleja «Retirado» SIN cambiar de pestaña.
// Chromium, API simulada, datos sintéticos. Evidencia; no corre en CI. Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… BASE=http://127.0.0.1:4344 node scripts/f404-1-permiso-retirado-check.cjs
// Escenario: el chat está autorizado y analizado; la persona intenta cruzar un insight; el servidor responde con el código y el permiso ya está retirado en la base (otra pestaña/dispositivo).
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4344'; const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
let failures = 0; const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
const T = { es: { analyze: 'Analizar mi chat', authorize: /Autorizar cruce/, confirm: 'Confirmar', changed: 'Los permisos cambiaron en otra pestaña o dispositivo. Los actualizamos.', code: { source_consent_revoked: 'permiso', source_consent_required: 'permiso' } },
  en: { analyze: 'Analyze my chat', authorize: /Authorize crossing/, confirm: 'Confirm', changed: 'The permissions changed in another tab or device. We updated them.' } }
async function run(browser, { lang, code, scheme = 'light', width = 1100, stillGranted = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const st = { consentReads: 0, revokedInDb: false, confirms: 0 }
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'tok'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.route('**/api/**', async route => { const req = route.request(); const p = new URL(req.url()).pathname; const m = req.method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/career-context' && m === 'GET') return route.fulfill({ json: { active: null, versions: [] } })
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } })
    if (p === '/api/consents' && m === 'GET') { st.consentReads++; const granted = !st.revokedInDb || stillGranted; return route.fulfill({ json: { consents: [{ purpose: 'insights_chat', status: granted ? 'granted' : 'revoked' }, { purpose: 'insights_diary', status: 'revoked' }, { purpose: 'insights_resume', status: 'revoked' }] } }) }
    if (p === '/api/insights/proposals') return route.fulfill({ json: { insights: [{ key: 'energy_gives', text: 'Disfruto coordinar equipos pequeños', origins: [{ type: 'chat_turn', id: 7, quote: 'coordiné al equipo y salió bien' }] }] } })
    if (p === '/api/career-context/preview') return route.fulfill({ json: { token: `${Date.now() + 600000}.${'a'.repeat(64)}`, expiresAt: new Date(Date.now() + 600000).toISOString(), representation: req.postDataJSON().fields.map(({ key, text }) => ({ key, text })) } })
    if (p === '/api/career-context/confirm') { st.confirms++; st.revokedInDb = true; return route.fulfill({ status: 403, json: { code } }) }
    return route.fulfill({ json: {} }) })
  await page.goto(BASE + '/app/bridge', { waitUntil: 'networkidle' }); await page.locator('[data-source="chat"]').waitFor()
  const sw = page.locator('[role="switch"][data-source="chat"]')
  const before = await sw.getAttribute('aria-checked')
  await page.getByRole('button', { name: T[lang].analyze }).click(); await page.locator('.br-card').first().waitFor()
  await page.locator('.br-card').first().getByRole('button', { name: T[lang].authorize }).click(); await page.locator('.br-card').first().getByRole('button', { name: T[lang].confirm }).click()
  await page.waitForTimeout(900)
  const after = await sw.getAttribute('aria-checked'); const body = await page.evaluate(() => document.body.innerText)
  const axe = await (async () => { await page.addScriptTag({ content: axeSource }); const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })); return r.violations.map(v => `${v.id} x${v.nodes.length}`) })()
  const scrollOk = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  await ctx.close(); return { before, after, body, st, axe, scrollOk } }
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const code of ['source_consent_revoked', 'source_consent_required']) for (const [scheme, width] of [['light', 1100], ['dark', 390]]) {
    const r = await run(browser, { lang, code, scheme, width })
    const ok = r.before === 'true' && r.after === 'false' && r.st.confirms === 1 && r.st.consentReads >= 2 && r.body.includes(T[lang].changed) && r.axe.length === 0 && r.scrollOk
    log(ok, `${lang} ${code} ${scheme} ${width}: interruptor ${r.before}→${r.after}, lecturas de permisos=${r.st.consentReads}, aviso «permisos cambiaron»=${r.body.includes(T[lang].changed)}, confirms=${r.st.confirms}, axe[${r.axe}]`) }
  { // el permiso NO cambió en la base (código llegó pero el permiso sigue concedido): el interruptor no se toca y no hay aviso falso
    const r = await run(browser, { lang: 'es', code: 'source_consent_revoked', stillGranted: true })
    log(r.after === 'true' && !r.body.includes(T.es.changed), `permiso sigue concedido en la base: el interruptor queda «${r.after}» y no se afirma un cambio que no ocurrió`) }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
