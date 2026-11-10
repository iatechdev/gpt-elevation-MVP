// ES-169 (PR3): /app/session/:id (sala de la persona) en navegador real (Chromium), API simulada, datos sintéticos. El video es un servicio externo: el iframe apunta a una página local inerte.
// Mide los estados conectando → antes de entrar → en curso, «aún no comienza» y «error» con reintento SIN recargar la página, que el iframe no se cargue hasta que la persona pulse «Entrar»
// (así el permiso de cámara y micrófono se explica ANTES), que unirse sea una lectura repetible, y la accesibilidad (axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px)
// en ES/EN × 390/1360 × claro/oscuro del sistema (la pantalla es clara por diseño: se mide y se declara).
// NO se puede verificar aquí: el video real, los permisos reales de cámara y micrófono del navegador ni qué hace el servicio externo si se deniegan.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es169-sala-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { connecting: 'Conectando a tu sesión...', preTitle: 'Antes de entrar', preBody: /cámara y el micrófono dentro de la sesión.*servicio externo/, enter: 'Entrar a la sesión', inProgress: 'Elevation — Sesión en curso', leave: 'Salir',
    notStarted: 'La sesión aún no ha comenzado', notStartedBody: 'Tu profesional todavía no ha iniciado la videollamada. Espera unos minutos e inténtalo de nuevo.', retry: 'Reintentar', home: 'Volver al inicio', connError: 'Error de conexión.', old: /terapeut/i },
  en: { connecting: 'Connecting to your session...', preTitle: 'Before you join', preBody: /camera and microphone inside the session.*external service/, enter: 'Join the session', inProgress: 'Elevation — Session in progress', leave: 'Leave',
    notStarted: 'The session has not started yet', notStartedBody: 'Your professional has not started the video call yet. Please wait a few minutes and try again.', retry: 'Try again', home: 'Back to home', connError: 'Connection error.', old: /therapist/i },
}
const EMOJI = /\p{Extended_Pictographic}/u

// responses: lista de respuestas por llamada a /join: 'ok' | 'not_started' | 'network' | 'forbidden'
async function open(browser, { width, lang, scheme, responses }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { joins: 0, writes: [], iframeRequests: 0, pageErrors: [], delay: 0 }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/video-sintetico', route => { state.iframeRequests++; return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>video</title><p>Video sintético</p>' }) })
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (method !== 'GET') state.writes.push(method + ' ' + p)
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/sessions/user/7/join') {
      const kind = responses[Math.min(state.joins, responses.length - 1)]; state.joins++
      if (state.delay) await new Promise(r => setTimeout(r, state.delay))
      if (kind === 'network') return route.abort('connectionreset')
      if (kind === 'not_started') return route.fulfill({ status: 400, json: { error: 'Session has not started yet.' } })
      if (kind === 'forbidden') return route.fulfill({ status: 404, json: { error: 'Session not found.' } })
      return route.fulfill({ json: { meetingUrl: BASE + '/video-sintetico', sessionId: 7 } })
    }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/session/7', { waitUntil: 'domcontentloaded' })
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('a[href], button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => ((el.innerText || '').trim().slice(0, 28)) + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    { // antes de entrar
      const { ctx, page, state } = await open(browser, { width, lang, scheme, responses: ['ok'] })
      await page.getByRole('heading', { name: t.preTitle, exact: true }).waitFor()
      const text = await page.locator('body').innerText()
      report(t.preBody.test(text) && !t.old.test(text) && !EMOJI.test(text), `«${t.preTitle}»: explica cámara y micrófono y que el video es un servicio externo; sin emojis ${tag}`)
      report(state.iframeRequests === 0 && await page.locator('iframe').count() === 0, `el video NO se carga hasta que la persona pulse «${t.enter}» ${tag}`)
      report(await page.getByRole('button', { name: t.enter, exact: true }).evaluate(el => el === document.activeElement), `el foco inicial está en «${t.enter}» ${tag}`)
      await axeAndLayout(page, `sala: antes de entrar ${tag}`)
      await page.getByRole('button', { name: t.enter, exact: true }).click()
      await page.getByRole('heading', { name: t.inProgress, exact: true }).waitFor()
      await page.waitForFunction(() => document.querySelector('iframe'))
      report(await page.locator('iframe').getAttribute('allow') === 'camera; microphone; fullscreen; display-capture; autoplay' && state.joins === 1 && state.writes.length === 0, `«${t.inProgress}»: iframe con permisos de cámara y micrófono, una sola lectura y ninguna escritura ${tag}`)
      await axeAndLayout(page, `sala: en curso ${tag}`)
      await ctx.close()
    }
    { // aún no comienza
      const { ctx, page } = await open(browser, { width, lang, scheme, responses: ['not_started'] })
      await page.getByText(t.notStarted, { exact: true }).waitFor()
      const text = await page.locator('body').innerText()
      report(text.includes(t.notStartedBody) && !t.old.test(text) && !EMOJI.test(text), `«${t.notStarted}» con el texto de espera y sin emojis ${tag}`)
      await axeAndLayout(page, `sala: aún no comienza ${tag}`)
      await ctx.close()
    }
  }
  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    { // conectando (respuesta lenta)
      const ctxInfo = await open(browser, { width, lang, scheme, responses: ['ok'] }); await ctxInfo.ctx.close()
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })
      const page = await ctx.newPage()
      await page.route('**/api/**', async route => { const p = new URL(route.request().url()).pathname; if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } }); if (p.endsWith('/join')) { await new Promise(r => setTimeout(r, 1500)); return route.fulfill({ json: { meetingUrl: BASE + '/video-sintetico', sessionId: 7 } }) } return route.fulfill({ json: {} }) })
      await page.addInitScript(l => { localStorage.setItem('elevation_token', 'x'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
      await page.goto(BASE + '/app/session/7', { waitUntil: 'domcontentloaded' })
      await page.getByText(t.connecting, { exact: true }).waitFor()
      report(await page.locator('[role=status][aria-busy=true]').count() === 1 && !EMOJI.test(await page.locator('body').innerText()), `«${t.connecting}»: estado accesible (status, ocupado) y sin emojis ${tag}`)
      await page.getByRole('heading', { name: t.preTitle, exact: true }).waitFor(); await ctx.close()
    }
    { // aún no comienza → reintentar sin recargar → entra
      const { ctx, page, state } = await open(browser, { width, lang, scheme, responses: ['not_started', 'ok'] })
      await page.getByText(t.notStarted, { exact: true }).waitFor()
      await page.evaluate(() => { window.__sinRecarga = true })
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.getByRole('heading', { name: t.preTitle, exact: true }).waitFor()
      report(state.joins === 2 && await page.evaluate(() => window.__sinRecarga === true) && state.writes.length === 0, `«${t.retry}» vuelve a pedir la sala SIN recargar la página y sin escrituras ${tag}`)
      await ctx.close()
    }
    { // error de conexión → reintentar
      const { ctx, page, state } = await open(browser, { width, lang, scheme, responses: ['network', 'ok'] })
      await page.getByText(t.connError, { exact: true }).waitFor()
      report(await page.getByRole('alert').count() >= 1 && await page.getByRole('button', { name: t.home, exact: true }).isVisible(), `error de conexión con alerta, «${t.retry}» y «${t.home}» ${tag}`)
      await axeAndLayout(page, `sala: error de conexión ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.getByRole('heading', { name: t.preTitle, exact: true }).waitFor()
      report(state.joins === 2, `tras el error, «${t.retry}» llega a «${t.preTitle}» ${tag}`)
      await ctx.close()
    }
    { // sesión ajena: el servidor responde 404, la pantalla no revela nada y se puede volver
      const { ctx, page } = await open(browser, { width, lang, scheme, responses: ['forbidden'] })
      await page.getByRole('alert').waitFor()
      report(await page.locator('iframe').count() === 0 && await page.getByRole('button', { name: t.home, exact: true }).isVisible(), `sesión ajena o inexistente: error, sin video y con «${t.home}» ${tag}`)
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
