// ES-319 (E289-1): comprobación en Chromium con API simulada del foco de «Retirar todo» en El Puente. Mismo arnés que es307d-check.cjs.
// Uso: VITE_BRIDGE_INSIGHTS_FIXTURES=true npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4111 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4111 node scripts/es319-check.cjs
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4111 node scripts/es307d-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4111'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const field = { key: 'values', text: 'Valoro la autonomía sintética', origin: { type: 'direct' } }
const version = (extra = {}) => ({ version: 1, status: 'active', approvedAt: '2026-11-05T12:00:00.000Z', revokedAt: null, fields: [field], needsReview: false, ...extra })

async function open(browser, { width, lang, scheme, perms, active, delay = 0, cpu = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { perms: { ...perms }, active, revokes: 0, putCalls: [], pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) state.pageErrors.push(m.text()) })
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (delay) await new Promise(r => setTimeout(r, delay))
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/consents' && method === 'GET') return route.fulfill({ json: { consents: Object.entries(state.perms).map(([source, on]) => ({ purpose: 'insights_' + source, status: on ? 'granted' : 'revoked' })) } })
    const put = p.match(/^\/api\/consents\/insights_(chat|diary|resume)$/)
    if (put && method === 'PUT') { const status = req.postDataJSON().status; state.putCalls.push([put[1], status]); state.perms[put[1]] = status === 'granted'; return route.fulfill({ json: { status } }) }
    if (p === '/api/career-context' && method === 'GET') return route.fulfill({ json: { active: state.active, versions: state.active ? [state.active] : [] } })
    if (p === '/api/career-context/revoke') { state.revokes++; state.active = null; return route.fulfill({ json: { revoked: true } }) }
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, lang)
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/app/bridge', { waitUntil: 'networkidle' })
  await page.locator('.br-cols').waitFor()
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main a[href], main button, dialog[open] button, main select')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => el.tagName.toLowerCase() + ':' + (el.textContent || '').trim().slice(0, 20)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)

}
// ES-319 (E289-1): durante y después de «Retirar todo» el foco nunca cae a body.
const onBody = page => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body })
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${lang} ${scheme}`
    const { ctx, page, state } = await open(browser, { width: 1360, lang, scheme, perms: { chat: true, diary: true, resume: false }, active: version(), delay: 250 })
    const samples = []
    await page.exposeFunction('__sample', s => samples.push(s))
    await page.evaluate(() => { window.__watch = setInterval(() => { const a = document.activeElement; window.__sample(!a || a === document.body ? 'body' : (a.getAttribute('data-withdraw-all') !== null ? 'abridor' : (a.closest('dialog') ? 'dialogo' : (a.id || a.tagName)))) }, 20) })
    await page.locator('[data-withdraw-all]').focus(); await page.keyboard.press('Enter')
    await page.locator('dialog[open]').waitFor()
    await page.locator('dialog[open] .cg-btn:not(.cg-btn--ghost)').click()
    await page.locator('dialog[open]').waitFor({ state: 'detached' }).catch(() => undefined)
    await page.waitForTimeout(900)
    await page.evaluate(() => clearInterval(window.__watch))
    const firstBody = samples.indexOf('body')
    report(state.revokes === 1 && state.putCalls.length === 2, `«Retirar todo» retira lo cruzado y los dos permisos ${tag}`, JSON.stringify({ revokes: state.revokes, puts: state.putCalls }))
    report(!await onBody(page), `el foco final no está en body ${tag}`, samples.slice(-3).join(','))
    report(firstBody === -1, `el foco nunca cae a body durante «Retirar todo» ${tag}`, 'muestras=' + [...new Set(samples)].join(','))
    const finalFocus = await page.evaluate(() => document.activeElement?.id)
    report(finalFocus === 'bridge-pro', `el foco termina en el título «Tu perfil profesional» ${tag}`, String(finalFocus))
    report(state.pageErrors.length === 0, `sin errores de consola ${tag}`, state.pageErrors.join('|').slice(0, 120))
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTodo OK'); process.exit(failures ? 1 : 0)
})()
