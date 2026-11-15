// ES-307 (PR 4): El Puente (/app/bridge) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe WCAG 2.x A/AA (wcag2a/2aa/21a/21aa/22aa) = 0 en claro y oscuro, ES/EN × 1360/390/320 px, h1 único, sin desborde, objetivos >= 24 px, texto de la persona en Spectral,
// chips con palabra, interruptores role="switch", ojo con aria-pressed, confirmación en la tarjeta, diálogos (foco, Tab/Shift+Tab atrapado, Esc, foco devuelto) y CLS <= 0,1 a 390 px con CPU×4.
// Uso: VITE_BRIDGE_INSIGHTS_FIXTURES=true npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4111 --strictPort
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
const focusedIn = page => page.evaluate(() => { const d = document.querySelector('dialog[open]'); return !!d && d.contains(document.activeElement) })

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
    const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme, perms: { chat: true, diary: true, resume: false }, active: version() })
    await axeAndLayout(page, `El Puente ${tag}`)
    // confirmación dentro de la tarjeta y pantalla con el fragmento visible
    await page.locator('[data-authorize]').first().click()
    await page.locator('.br-ask').waitFor()
    await page.locator('.br-eye').first().click()
    await axeAndLayout(page, `El Puente con confirmación y fragmento visible ${tag}`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(150)
    report(await page.locator('.br-ask').count() === 0, `Esc cancela la confirmación de la tarjeta ${tag}`)
    // Spectral en el fragmento de la persona, chips con palabra, interruptores
    const facts = await page.evaluate(() => ({
      frag: getComputedStyle(document.querySelector('.br-frag')).fontFamily, chips: [...document.querySelectorAll('.cg-chip')].map(c => (c.textContent || '').trim()).filter(Boolean).length,
      switches: [...document.querySelectorAll('[role=switch]')].map(s => s.getAttribute('aria-checked')), pressed: document.querySelector('.br-eye').getAttribute('aria-pressed'),
    }))
    report(/Spectral/i.test(facts.frag), `el fragmento va en Spectral ${tag}`, facts.frag.slice(0, 40))
    report(facts.chips >= 4 && facts.switches.length === 3 && facts.switches.join() === 'true,true,false' && facts.pressed === 'true', `chips con palabra, 3 interruptores role=switch y ojo aria-pressed ${tag}`, JSON.stringify(facts.switches))
    // diálogo «Retirar todo»: foco en el primer botón, Tab y Shift+Tab dan la vuelta, Esc cierra y el foco vuelve
    await page.locator('[data-withdraw-all]').focus(); await page.keyboard.press('Enter')
    await page.locator('dialog[open]').waitFor()
    report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === (lang === 'es' ? 'Cancelar' : 'Cancel'), `el foco inicial de «Retirar todo» está en «Cancelar» ${tag}`)
    await axeAndLayout(page, `Diálogo «Retirar todo» ${tag}`)
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
    let inside = await focusedIn(page)
    for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+Tab')
    inside = inside && await focusedIn(page)
    report(inside, `Tab y Shift+Tab quedan dentro del diálogo ${tag}`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(150)
    report(await page.locator('dialog[open]').count() === 0 && await page.evaluate(() => document.activeElement?.hasAttribute('data-withdraw-all')), `Esc cierra sin retirar y devuelve el foco al botón que lo abrió ${tag}`, `revokes=${state.revokes}`)
    // diálogo de activar la fuente del chat (apagada) con foco en «Cancelar» y retorno al interruptor
    await page.locator('[data-source="resume"]').click(); await page.locator('dialog[open]').waitFor()
    report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === (lang === 'es' ? 'Cancelar' : 'Cancel'), `el foco inicial del diálogo de fuentes está en «Cancelar» ${tag}`)
    await axeAndLayout(page, `Diálogo de fuentes ${tag}`)
    await page.keyboard.press('Escape'); await page.waitForTimeout(150)
    report(await page.evaluate(() => document.activeElement?.getAttribute('data-source')) === 'resume' && state.putCalls.length === 0, `Esc cierra sin conceder y el foco vuelve al interruptor ${tag}`, JSON.stringify(state.putCalls))
    report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join('|').slice(0, 120))
    await ctx.close()
  }
  // CLS a 390 px con CPU×4 y 80 ms de latencia (con tarjetas, columna profesional y permisos)
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, perms: { chat: true, diary: true, resume: false }, active: version(), delay: 80, cpu: 4 })
    await page.waitForTimeout(1500)
    const cls = await page.evaluate(() => window.__cls)
    report(cls <= 0.1, `CLS /app/bridge 390 px CPU×4 ${scheme}`, cls.toFixed(3)); await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
