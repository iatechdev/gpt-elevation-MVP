// ES-359 (PR6): «Crear cuenta» con una sesión abierta (rol profesional: no pide el contexto de la persona). Chromium, API simulada, datos sintéticos. Evidencia; no corre en CI.
// Mide en ES/EN × claro/oscuro × 1360/390/320: el aviso aprobado (con el nombre), el formulario OCULTO, axe wcag2a/2aa/21a/21aa/22aa, sin desborde, un h1 y un main;
// «Seguir con mi sesión» lleva al destino de la sesión; «Cerrar sesión…» llama a /api/logout, limpia la sesión local, muestra el formulario y deja el foco en el primer campo;
// «Entrar» (sin modo registro) con sesión abierta sigue redirigiendo a la sesión. Uso: PLAYWRIGHT_MODULE=… AXE_PATH=… BASE=http://127.0.0.1:4330 node scripts/es359-sesion-abierta-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4330'
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
const TEXT = { es: { open: 'Ya tienes una sesión abierta como Marta Sintética.', go: 'Seguir con mi sesión', out: 'Cerrar sesión para crear una cuenta nueva', hidden: 'El formulario de registro queda oculto mientras haya una sesión abierta.' },
  en: { open: 'You already have a session open as Marta Sintética.', go: 'Continue with my session', out: 'Sign out to create a new account', hidden: 'The sign-up form stays hidden while a session is open.' } }
async function open(browser, { width, lang, scheme, session = true, path = '/login?mode=register' }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const calls = []
  await page.addInitScript(([l, s]) => { localStorage.setItem('elv_lang', l); if (s) { localStorage.setItem('elevation_token', 'tok-sintetico'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elevation_name', 'Marta Sintética') } }, [lang, session])
  await page.route('**/api/**', r => { const p = new URL(r.request().url()).pathname; calls.push(`${r.request().method()} ${p}`)
    if (p === '/api/session') return r.fulfill({ json: { role: 'therapist', onboardingCompleted: true } })
    if (p === '/api/logout') return r.fulfill({ status: 200, json: {} })
    if (p === '/api/landing-content') return r.fulfill({ json: {} })
    return r.fulfill({ json: {} }) })
  await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(500)
  return { ctx, page, calls }
}
;(async () => {
  const browser = await chromium.launch()
  for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
    const { ctx, page } = await open(browser, { width, lang, scheme }); const T = TEXT[lang]; const tag = `${scheme} ${lang} ${width}`
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
    const shown = body.toLowerCase().includes(T.open.toLowerCase()) && body.toLowerCase().includes(T.go.toLowerCase()) && body.toLowerCase().includes(T.out.toLowerCase()) && body.toLowerCase().includes(T.hidden.toLowerCase())
    const m = await page.evaluate(() => ({ forms: document.querySelectorAll('form').length, inputs: document.querySelectorAll('input').length, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length,
      small: [...document.querySelectorAll('.ac-actions a, .ac-actions button')].filter(e => e.getBoundingClientRect().height < 44).length }))
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
    const bad = axe.violations.map(v => `${v.id} x${v.nodes.length}`)
    const ok = shown && m.forms === 0 && m.inputs === 0 && m.scrollW <= m.innerW && m.h1 === 1 && m.main === 1 && m.small === 0 && bad.length === 0
    log(ok, `aviso ${tag}${ok ? '' : ` shown=${shown} forms=${m.forms} inputs=${m.inputs} scroll=${m.scrollW}/${m.innerW} h1=${m.h1} main=${m.main} small=${m.small} axe[${bad}]`}`); await ctx.close()
  }
  { const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme: 'light' }); await page.getByRole('link', { name: TEXT.es.go }).click(); await page.waitForTimeout(600)
    log(new URL(page.url()).pathname === '/therapist/dashboard', `«Seguir con mi sesión» lleva al destino de la sesión (${new URL(page.url()).pathname})`); await ctx.close() }
  { const { ctx, page, calls } = await open(browser, { width: 390, lang: 'es', scheme: 'light' }); await page.getByRole('button', { name: TEXT.es.out }).click(); await page.waitForSelector('#access-name', { timeout: 8000 }); await page.waitForTimeout(300)
    const state = await page.evaluate(() => ({ token: localStorage.getItem('elevation_token'), name: localStorage.getItem('elevation_name'), focus: document.activeElement && document.activeElement.id, forms: document.querySelectorAll('form').length }))
    log(calls.includes('POST /api/logout') && state.token === null && state.name === null && state.focus === 'access-name' && state.forms === 1, `cerrar sesión: POST /api/logout, sesión local limpia, formulario visible y foco en el primer campo ${JSON.stringify(state)}`); await ctx.close() }
  { const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme: 'light', path: '/login' }); await page.waitForTimeout(600)
    log(new URL(page.url()).pathname === '/therapist/dashboard', `«Entrar» con sesión abierta sigue redirigiendo a la sesión (${new URL(page.url()).pathname})`); await ctx.close() }
  { const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme: 'light', session: false }); const n = await page.evaluate(() => ({ forms: document.querySelectorAll('form').length, notice: document.body.innerText.includes('Ya tienes una sesión') }))
    log(n.forms === 1 && !n.notice, 'sin sesión abierta: el formulario de «Crear cuenta» se muestra y no hay aviso'); await ctx.close() }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
