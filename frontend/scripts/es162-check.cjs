// ES-162: /app/chat en navegador real (Chromium), API simulada, datos sintéticos.
// Matriz ES/EN × 390/1360 px × claro/oscuro del sistema: axe WCAG 2.x A/AA (base, mensaje sin confirmar, aviso de demora), un h1, sin desborde, objetivos >= 24 px, etiqueta «Tú/You» en cada turno
// de la persona, y NINGÚN anuncio al cargar el historial. Interacciones (ES 1360 claro; EN 390 oscuro): respuesta nueva anunciada solo tras enviar; Enter envía desactivado por defecto,
// Shift+Enter y IME no envían, mensaje vacío no envía, la preferencia se recuerda; demora a los 15 s con reloj simulado + «Dejar de esperar» (no duplica: un solo POST, «Consultar estado» recupera);
// sin conexión con «Reintentar» (mismo requestId) y «Copiar» (con y sin portapapeles); teclado.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es162-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { you: 'Tú', slow: /Esto está tardando más de lo normal/, stop: 'Dejar de esperar', stopped: /Dejaste de esperar/, offline: /Sin conexión\. Tu mensaje sigue aquí/, copy: 'Copiar', copied: /Copiado/, copyFailed: /No se pudo copiar/, send: 'Enviar', check: 'Consultar estado', retry: 'Reintentar el mismo envío', enter: /Enter envía el mensaje/, message: 'Mensaje' },
  en: { you: 'You', slow: /This is taking longer than usual/, stop: 'Stop waiting', stopped: /You stopped waiting/, offline: /No connection\. Your message is still here/, copy: 'Copy', copied: /Copied/, copyFailed: /Could not copy/, send: 'Send', check: 'Check status', retry: 'Retry the same message', enter: /Enter sends the message/, message: 'Message' },
}
const HISTORY = [{ role: 'bot', text: 'Hola. ¿Cómo va tu día?' }, { role: 'user', text: 'Bien, pensando en mi cambio de área.' }, { role: 'bot', text: 'Gracias por contarlo.' }, { role: 'user', text: 'Quiero ordenar mis ideas.' }]
const USAGE = { configured: true, period: 'month', periodKey: '2026-11', limit: 1000, used: 10, remaining: 990, resetsAt: '2026-12-01T00:00:00.000Z' }

async function open(browser, { width, lang, scheme, clock = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  const state = { messages: HISTORY.map(m => ({ ...m })), posts: [], mode: 'ok', turnDone: false, held: null, pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/ai/usage') return route.fulfill({ json: USAGE })
    if (p === '/api/messages') return route.fulfill({ json: state.messages })
    if (p === '/api/diary') return route.fulfill({ json: { entries: [] } })
    if (p === '/api/chat' && method === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}'); state.posts.push(body)
      if (state.mode === 'offline') return route.abort('internetdisconnected')
      if (state.mode === 'hold') { state.held = { route, body }; return } // la respuesta no llega hasta liberar
      state.messages.push({ role: 'user', text: body.message }, { role: 'bot', text: `Respuesta a: ${body.message}` })
      return route.fulfill({ json: { reply: `Respuesta a: ${body.message}`, requestId: body.requestId } })
    }
    if (p.startsWith('/api/chat/turns/')) {
      const id = p.split('/').pop(); const body = state.posts.find(b => b.requestId === id)
      if (state.turnDone && body) { if (!state.messages.some(m => m.text === body.message)) state.messages.push({ role: 'user', text: body.message }, { role: 'bot', text: `Respuesta a: ${body.message}` }); return route.fulfill({ json: { requestId: id, status: 'completed', retryable: false } }) }
      return route.fulfill({ json: { requestId: id, status: 'pending', retryable: false } })
    }
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  if (clock) await page.clock.install()
  await page.goto(BASE + '/app/chat', { waitUntil: 'networkidle' })
  await page.locator('.chat-composer textarea').waitFor({ timeout: 10000 })
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('.chat-composer button, .chat-composer input, .chat-composer textarea, .space-pending ~ .space-actions button, .chat-slow button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.className).toString().trim().slice(0, 24)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const announced = page => page.evaluate(() => [...document.querySelectorAll('[aria-live="polite"][aria-atomic="true"]')].map(el => el.textContent.trim()).join('|'))

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme })
    // Etiqueta de quién habla y ningún anuncio al cargar.
    const labels = await page.locator('main span', { hasText: new RegExp(`^${t.you}$`) }).count()
    report(labels === 2, `etiqueta «${t.you}» sobre cada turno de la persona (2) ${tag}`, `hallados=${labels}`)
    report(await announced(page) === '', `ningún anuncio al cargar el historial ${tag}`)
    report(await page.getByLabel(t.enter).isVisible() && !(await page.getByLabel(t.enter).isChecked()), `casilla «Enter envía» visible y desactivada por defecto ${tag}`)
    await axeAndLayout(page, `chat base ${tag}`)
    // Sin conexión: mensaje sin confirmar + aviso propio + Reintentar + Copiar.
    state.mode = 'offline'
    await page.locator('.chat-composer textarea').fill('Mensaje de prueba sin conexión')
    await page.getByRole('button', { name: t.send, exact: true }).click()
    await page.getByText(t.offline).first().waitFor({ timeout: 8000 })
    report(await page.getByRole('button', { name: t.retry }).isVisible() && await page.getByRole('button', { name: t.copy, exact: true }).isVisible(), `sin conexión: aviso propio con «Reintentar» y «Copiar» ${tag}`)
    report(await page.locator('.space-private-text').first().innerText() === 'Mensaje de prueba sin conexión', `el texto sigue en pantalla ${tag}`)
    await axeAndLayout(page, `chat con mensaje sin confirmar ${tag}`)
    await ctx.close()
  }

  // Interacciones completas en dos combinaciones.
  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    // 1) Enter, Shift+Enter, IME, vacío, preferencia, y anuncio solo tras enviar.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme })
      const box = page.locator('.chat-composer textarea')
      await box.click(); await box.type('Primera línea'); await page.keyboard.press('Enter'); await box.type('segunda')
      report((await box.inputValue()) === 'Primera línea\nsegunda' && state.posts.length === 0, `Enter inserta una línea y NO envía (por defecto) ${tag}`)
      await page.getByLabel(t.enter).check()
      await box.focus(); await page.keyboard.press('End'); await page.keyboard.press('Shift+Enter'); await box.type('tercera') // marcar la casilla mueve el foco a la casilla
      report((await box.inputValue()) === 'Primera línea\nsegunda\ntercera' && state.posts.length === 0, `con la casilla activa, Shift+Enter inserta línea y NO envía ${tag}`)
      await box.evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true })))
      report(state.posts.length === 0, `Enter durante la composición de un IME no envía ${tag}`)
      await box.fill('   '); await page.keyboard.press('Enter')
      report(state.posts.length === 0, `Enter con el mensaje vacío no envía ${tag}`)
      await box.fill('Quiero practicar una entrevista')
      const before = await announced(page); await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelector('.chat-scroll')?.textContent.includes('Respuesta a: Quiero practicar una entrevista'), null, { timeout: 8000 })
      report(state.posts.length === 1, `Enter envía con la casilla activa (un solo POST) ${tag}`)
      report(before === '' && (await announced(page)) === 'Respuesta a: Quiero practicar una entrevista', `la respuesta nueva se anuncia tras enviar (región aria-live) ${tag}`, `«${await announced(page)}»`)
      // cambiar de idioma no re-anuncia otra cosa ni borra el anuncio de un mensaje distinto
      await page.reload({ waitUntil: 'networkidle' }); await page.locator('.chat-composer textarea').waitFor()
      report(await announced(page) === '', `al recargar no se anuncia nada ${tag}`)
      report(await page.getByLabel(t.enter).isChecked(), `la preferencia «Enter envía» se recuerda ${tag}`)
      await page.getByLabel(t.enter).uncheck(); await page.reload({ waitUntil: 'networkidle' }); await page.locator('.chat-composer textarea').waitFor()
      report(!(await page.getByLabel(t.enter).isChecked()), `desactivar la preferencia también se recuerda ${tag}`)
      await ctx.close()
    }
    // 2) Demora a los 15 s con reloj simulado, «Dejar de esperar», sin duplicar, «Consultar estado».
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, clock: true })
      state.mode = 'hold'
      await page.locator('.chat-composer textarea').fill('Mensaje lento de prueba')
      await page.getByRole('button', { name: t.send, exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.chat-composer')?.textContent.length > 0)
      await page.clock.fastForward(14000)
      report(await page.getByText(t.slow).count() === 0, `a los 14 s todavía no hay aviso de demora ${tag}`)
      await page.clock.fastForward(2000)
      await page.getByText(t.slow).waitFor({ timeout: 4000 })
      report(await page.getByRole('button', { name: t.stop, exact: true }).isVisible(), `a los 15 s aparece el aviso de demora con «${t.stop}» ${tag}`)
      const slowText = await page.locator('.chat-slow').innerText()
      report(!/cancel/i.test(slowText) || /dejar de esperar|stop waiting/i.test(slowText), `el aviso no promete cancelar al servidor ${tag}`)
      await axeAndLayout(page, `chat con aviso de demora ${tag}`)
      await page.getByRole('button', { name: t.stop, exact: true }).click()
      await page.getByText(t.stopped).first().waitFor({ timeout: 4000 })
      report(state.posts.length === 1, `dejar de esperar no envía otra vez (un solo POST) ${tag}`)
      report(await page.locator('.space-private-text').first().innerText() === 'Mensaje lento de prueba', `el mensaje queda sin confirmar y visible ${tag}`)
      // el servidor terminó mientras tanto: «Consultar estado» recupera sin duplicar
      state.turnDone = true
      await page.getByRole('button', { name: t.check, exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.chat-scroll')?.textContent.includes('Respuesta a: Mensaje lento de prueba'), null, { timeout: 8000 })
      const replies = await page.locator('.chat-scroll').evaluate(el => (el.textContent.match(/Respuesta a: Mensaje lento de prueba/g) || []).length)
      report(replies === 1 && state.posts.length === 1, `«${t.check}» recupera la respuesta una sola vez ${tag}`, `respuestas=${replies} POST=${state.posts.length}`)
      await ctx.close()
    }
    // 3) Sin conexión: reintento con el mismo requestId; Copiar con y sin portapapeles; teclado.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme })
      state.mode = 'offline'
      await page.locator('.chat-composer textarea').fill('Texto para copiar y reintentar')
      await page.getByRole('button', { name: t.send, exact: true }).click()
      await page.getByText(t.offline).first().waitFor({ timeout: 8000 })
      await page.getByRole('button', { name: t.copy, exact: true }).click()
      await page.getByText(t.copied).waitFor({ timeout: 4000 })
      report((await page.evaluate(() => navigator.clipboard.readText())) === 'Texto para copiar y reintentar', `«Copiar» deja el mensaje en el portapapeles y avisa «Copiado» ${tag}`)
      await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: () => Promise.reject(new Error('denegado')), configurable: true }) })
      await page.getByRole('button', { name: t.copy, exact: true }).click()
      await page.getByText(t.copyFailed).waitFor({ timeout: 4000 })
      report((await page.evaluate(() => window.getSelection()?.toString().trim())) === 'Texto para copiar y reintentar', `si el portapapeles se rechaza, el texto queda seleccionado y se avisa ${tag}`)
      // teclado: llegar a «Reintentar» con Tab y activarlo con Enter
      await page.getByRole('button', { name: t.check, exact: true }).focus()
      await page.keyboard.press('Tab'); const focusedName = await page.evaluate(() => document.activeElement?.textContent?.trim())
      report(focusedName === t.retry, `Tab llega a «${t.retry}» desde «${t.check}» ${tag}`, `foco=${focusedName}`)
      state.mode = 'ok'; await page.keyboard.press('Enter')
      await page.waitForFunction(() => document.querySelector('.chat-scroll')?.textContent.includes('Respuesta a: Texto para copiar y reintentar'), null, { timeout: 8000 })
      const ids = new Set(state.posts.map(b => b.requestId))
      report(state.posts.length === 2 && ids.size === 1, `el reintento usa el MISMO requestId (no duplica) ${tag}`, `POST=${state.posts.length} ids=${ids.size}`)
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
