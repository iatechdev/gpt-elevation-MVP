// ES-156: «Nueva contraseña» (/reset-password) en navegador. ES/EN × 390/1360 px × claro/oscuro (sistema): axe WCAG A/AA, un h1, sin desborde,
// resumen «n de 5» visible (0–5) y único aria-live, foco al mensaje tras CADA rechazo (requisitos locales, política del servidor, 429, 500, red),
// contraseña conservada, «Mostrar» conserva valor, teclado, token fuera de la barra de direcciones, del almacenamiento y de toda URL.
// No corre en CI; evidencia del PR. API simulada. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es156-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE'
const STRONG = 'Valida-Segura-42'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function open(browser, { width, lang, scheme }) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme })
  const page = await ctx.newPage()
  const state = { urls: [], mode: 'ok', confirms: 0 }
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); state.urls.push(url.pathname + url.search)
    if (url.pathname === '/api/password-reset/confirm') {
      state.confirms++
      if (state.mode === 'policy') return json(route, 400, { code: 'password_policy', missing: ['upper', 'digit'] })
      if (state.mode === 'rate') return json(route, 429, { code: 'rate_limited' })
      if (state.mode === 'server') return json(route, 500, {})
      if (state.mode === 'network') return route.abort('failed')
      if (state.mode === 'invalid') return json(route, 400, { code: 'reset_invalid' })
      return json(route, 200, { ok: true })
    }
    return json(route, 200, [])
  })
  await page.addInitScript(l => localStorage.setItem('elv_lang', l), lang)
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button, input')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 24)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const focusInfo = page => page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), tag: document.activeElement?.tagName, text: (document.activeElement?.textContent || '').trim().slice(0, 60) }))
const SAVE = { es: 'Guardar contraseña', en: null }

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme })
    await page.goto(`${BASE}/reset-password#token=${TOKEN}`, { waitUntil: 'networkidle' })
    const pw = page.locator('input[autocomplete="new-password"]')
    const save = page.locator('form button[type="submit"]')
    report(!page.url().includes('token') && new URL(page.url()).hash === '', `token fuera de la barra de direcciones ${tag}`, page.url())
    await axeAndLayout(page, `formulario ${tag}`)

    // Resumen visible 0–5 y única región aria-live.
    const summary = page.locator('[aria-live="polite"]')
    report(await summary.count() === 1, `un solo aria-live ${tag}`)
    report((await summary.innerText()).trim() === '' , `resumen vacío sin escribir ${tag}`)
    const counts = []
    for (const [value, n] of [['a', 1], ['aA', 2], ['aA1', 3], ['aA1-', 4], ['aA1-bbbb', 5]]) {
      await pw.fill(value); const t = (await summary.innerText()).trim(); counts.push(t)
      const visible = await summary.evaluate(el => { const b = el.getBoundingClientRect(); return b.width > 20 && b.height > 8 })
      report(visible && new RegExp(`\\b${n}\\b.*\\b5\\b`).test(t), `resumen visible «${t}» ${tag}`)
    }
    await axeAndLayout(page, `con resumen ${tag}`)

    // «Mostrar» conserva valor y foco queda en el botón.
    await pw.fill(STRONG)
    const toggle = page.locator('form button[type="button"]')
    await toggle.focus(); await page.keyboard.press('Enter')
    report(await pw.getAttribute('type') === 'text' && await pw.inputValue() === STRONG && (await focusInfo(page)).tag === 'BUTTON', `Mostrar contraseña conserva valor ${tag}`)
    await page.keyboard.press('Enter')

    // Foco al mensaje en cada rechazo; contraseña conservada.
    const rejections = [
      ['requisitos locales', 'weak', null],
      ['política del servidor', STRONG, 'policy'],
      ['demasiados intentos', STRONG, 'rate'],
      ['error del servidor', STRONG, 'server'],
      ['error de red', STRONG, 'network'],
    ]
    for (const [name, value, mode] of rejections) {
      if (mode) state.mode = mode
      await pw.fill(value)
      const before = state.confirms
      await pw.focus(); await page.keyboard.press('Enter') // envío con teclado
      await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert', null, { timeout: 4000 }).catch(() => {})
      const f = await focusInfo(page)
      report(f.role === 'alert' && f.text.length > 0, `foco al mensaje: ${name} ${tag}`, `${f.tag} «${f.text}»`)
      report(await pw.inputValue() === value, `contraseña conservada tras ${name} ${tag}`)
      if (!mode) report(state.confirms === before, `${name}: no llama al servidor ${tag}`)
      // teclear de nuevo no roba el foco
      await pw.focus(); await page.keyboard.type('x')
      report((await focusInfo(page)).tag === 'INPUT', `teclear no roba el foco tras ${name} ${tag}`)
      if (name === 'política del servidor') await axeAndLayout(page, `rechazo de política ${tag}`)
    }

    // Éxito, y token fuera de almacenamiento y de toda URL.
    state.mode = 'ok'; await pw.fill(STRONG); await save.click()
    await page.waitForSelector('[role="status"]')
    report(/Valida/.test(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage, document.cookie]))) === false, `contraseña no queda en almacenamiento ${tag}`)
    const stored = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie }))
    report(!stored.includes(TOKEN) && !state.urls.some(u => u.includes(TOKEN)) && !page.url().includes(TOKEN), `token fuera de almacenamiento y de toda URL ${tag}`)
    await axeAndLayout(page, `éxito ${tag}`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
