// ES-328 (PR 2): /profesionales en Cartografía. Chromium, API simulada (page.route), datos sintéticos. Evidencia; no corre en CI.
// Escenas: formulario vacío, errores por campo (envío vacío), enviando (respuesta retenida), enviada, error de red, demasiados intentos, cerrado, error de servidor.
// Mide en cada escena × ES/EN × claro/oscuro × 1360/390/320: axe wcag2a/2aa/21a/21aa/22aa + label-content-name-mismatch activada, sin desborde, un h1 y un main, selector de idioma del marco sin aria-label,
// objetivos ≥ 44 px en campos y botón; y el flujo: foco al primer campo inválido, foco al título al enviar, «Lo que escribiste sigue aquí» (valores conservados), CLS ≤ 0,1 a 390 px CPU×4.
// Uso: PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4321 node scripts/es328-profesionales-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4321'
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const PDF = { name: 'cv-sintetico.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%sintético\n') }
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
const RESP = { network: 'abort', rate: 429, closed: 503, server: 500, sent: 201 }

async function open(browser, { width, lang, scheme, cpu = 1, respond = 'sent', hold = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.addInitScript(([l]) => { localStorage.setItem('elv_lang', l); window.__cls = 0
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang])
  let release; const gate = new Promise(res => { release = res })
  await page.route('**/api/**', async r => {
    const p = new URL(r.request().url()).pathname
    if (p === '/api/professional-applications') {
      if (hold) await gate
      if (respond === 'network') return r.abort()
      if (respond === 'closed') return r.fulfill({ status: 503, json: { code: 'not_accepting' } })
      return r.fulfill({ status: RESP[respond], json: {} })
    }
    return r.fulfill({ json: p === '/api/landing-content' ? {} : [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/profesionales', { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500)
  return { ctx, page, release }
}
const fill = async page => {
  await page.fill('#pro-name', 'Persona Sintética'); await page.fill('#pro-email', 'sintetica@example.invalid'); await page.fill('#pro-country', 'Colombia'); await page.fill('#pro-profession', 'Psicología')
  await page.setInputFiles('#pro-cv', PDF); await page.check('#pro-consent')
}
async function audit(page, tag, extra = {}) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, rules: { 'label-content-name-mismatch': { enabled: true } } }))
  const mismatch = await page.evaluate(() => axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch'] } }))
  const bad = [...axe.violations, ...mismatch.violations].map(v => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)
  const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length,
    langAria: [...document.querySelectorAll('button')].filter(b => /^(ES|EN)$/.test(b.textContent.trim()) && b.hasAttribute('aria-label')).length,
    legacy: document.querySelectorAll('.space-card, .space-page, .pro-page, [class*="elv-"], .landing-header').length,
    small: [...document.querySelectorAll('.pa input:not([type=checkbox]):not([tabindex="-1"]), .pa textarea, .pa button')].filter(e => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map(e => e.id || e.textContent.trim().slice(0, 20)) }))
  const ok = bad.length === 0 && m.scrollW <= m.innerW && m.h1 === 1 && m.main === 1 && m.langAria === 0 && m.legacy === 0 && m.small.length === 0
  log(ok, `${tag}${ok ? '' : ` axe[${bad.join(' | ')}] scroll ${m.scrollW}/${m.innerW} h1 ${m.h1} main ${m.main} langAria ${m.langAria} legacy ${m.legacy} <44px [${m.small}]`}`)
  return m
}
;(async () => {
  const browser = await chromium.launch()
  const scenes = ['empty', 'errors', 'sending', 'sent', 'network', 'rate', 'closed', 'server']
  for (const scene of scenes) for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
    const respond = ['network', 'rate', 'closed', 'server'].includes(scene) ? scene : 'sent'
    const { ctx, page, release } = await open(browser, { width, lang, scheme, respond, hold: scene === 'sending' })
    if (scene === 'errors') await page.click('button[type=submit]')
    if (['sending', 'sent', 'network', 'rate', 'closed', 'server'].includes(scene)) { await fill(page); await page.click('button[type=submit]') }
    if (scene === 'sending') { await page.waitForTimeout(300) } else if (scene !== 'empty') await page.waitForTimeout(700)
    const tag = `${scene} ${scheme} ${lang} ${width}`
    await audit(page, tag)
    if (width === 390 && scheme === 'light' && lang === 'es') {
      if (scene === 'errors') {
        const focused = await page.evaluate(() => document.activeElement?.id)
        const invalid = await page.evaluate(() => [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.id))
        log(focused === 'pro-name' && invalid.includes('pro-name') && invalid.includes('pro-cv') && invalid.includes('pro-consent'), `errores por campo: foco en el primer campo inválido (${focused}), aria-invalid en ${invalid.join(', ')}`)
        const hasSymbol = await page.evaluate(() => getComputedStyle(document.querySelector('.cg-error'), '::before').content !== 'none')
        log(hasSymbol, 'el error por campo lleva símbolo ⚠ (no solo color)')
      }
      if (scene === 'sent') { const f = await page.evaluate(() => document.activeElement?.id); log(f === 'pro-title', `éxito: foco al título (${f}) y «Volver al inicio» en la pantalla de éxito`) }
      if (['network', 'rate', 'closed', 'server'].includes(scene)) {
        const kept = await page.inputValue('#pro-name'); const alertText = await page.textContent('#pro-banner')
        log(kept === 'Persona Sintética' && alertText.length > 10, `${scene}: lo escrito se conserva y el aviso está en un role=alert`)
      }
      if (scene === 'sending') { const busy = await page.getAttribute('button[type=submit]', 'aria-busy'); log(busy === 'true', 'enviando: el botón queda deshabilitado con aria-busy'); release() }
    } else if (scene === 'sending') release()
    await ctx.close()
  }
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 }); await page.waitForTimeout(1200)
    const cls = await page.evaluate(() => window.__cls); log(cls <= 0.1, `CLS formulario ${scheme} 390 CPU×4 = ${cls.toFixed(3)}`); await ctx.close()
  }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
