// ES-157: /profesionales en navegador. ES/EN × 390/1360 px × claro/oscuro (sistema): axe WCAG A/AA, un h1, sin desborde, objetivos >= 24 px,
// estado «no recibimos solicitudes» (503 not_accepting: aviso con foco accesible, envío inactivo, lo escrito y el PDF conservados, se rehabilita al editar y reintenta),
// 503 genérico = aviso de servidor (no el de cierre), enlace http:// bloqueado en el cliente sin llamar al servidor, https:// aceptado y enviado, teclado.
// No corre en CI; evidencia del PR. API simulada. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es157-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
const PDF = Buffer.from('%PDF-1.4\n% synthetic\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const T = {
  es: { closed: /Por ahora no estamos recibiendo solicitudes/, server: /No pudimos guardar la solicitud/, submit: 'Enviar solicitud', invalid: /Revisa los campos marcados/, ok: /Solicitud recibida/ },
  en: { closed: /We are not accepting applications right now/, server: /We could not save the application/, submit: 'Send application', invalid: /Check the marked fields/, ok: /Application received/ },
}

async function open(browser, { width, lang, scheme }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })
  const page = await ctx.newPage()
  const state = { posts: 0, mode: 'closed', lastProfile: null }
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/professional-applications' && route.request().method() === 'POST') {
      state.posts++
      const body = route.request().postData() || ''
      state.lastProfile = (body.match(/name="profileUrl"\r?\n\r?\n([^\r\n]*)/) || [])[1] ?? null
      if (state.mode === 'closed') return json(route, 503, { code: 'not_accepting', error: 'x' })
      if (state.mode === 'server') return json(route, 503, { error: 'x' })
      return json(route, 201, { ok: true })
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
    small: [...document.querySelectorAll('a[href], button, input:not([type=checkbox]):not([type=file]):not([tabindex="-1"]), textarea')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 24)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && r.small.length === 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} pequeños=[${r.small}] axe=[${axe}]`)
}
async function fillForm(page, profile) {
  await page.fill('#pro-name', 'Persona Sintética'); await page.fill('#pro-email', 'synthetic@example.invalid')
  await page.fill('#pro-country', 'Colombia'); await page.fill('#pro-profession', 'Psicología')
  if (profile !== undefined) await page.fill('#pro-profileUrl', profile)
  await page.setInputFiles('#pro-cv', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: PDF })
  await page.check('#pro-consent')
}

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page, state } = await open(browser, { width, lang, scheme })
    await page.goto(BASE + '/profesionales', { waitUntil: 'networkidle' })
    await axeAndLayout(page, `formulario ${tag}`)
    const submit = page.getByRole('button', { name: t.submit, exact: true })

    // http:// se bloquea en el cliente: no llama al servidor.
    await fillForm(page, 'http://example.test/perfil')
    await submit.click()
    await page.waitForFunction(() => document.activeElement?.id === 'pro-profileUrl', null, { timeout: 3000 }).catch(() => {})
    report(state.posts === 0 && await page.locator('#pro-profileUrl-error').count() === 1 && await page.evaluate(() => document.activeElement?.id) === 'pro-profileUrl', `http:// bloqueado sin llamar al servidor, foco al campo ${tag}`)
    // https:// sí pasa → 503 not_accepting → estado cerrado.
    await page.fill('#pro-profileUrl', 'https://example.test/perfil')
    await submit.click()
    await page.waitForSelector('#pro-banner')
    const banner = await page.locator('#pro-banner').innerText()
    report(t.closed.test(banner) && !t.server.test(banner), `503 not_accepting muestra el aviso de cierre ${tag}`, `«${banner}»`)
    report(state.posts === 1 && state.lastProfile === 'https://example.test/perfil', `se envió https:// ${tag}`, String(state.lastProfile))
    report(await submit.isDisabled(), `envío inactivo mientras está cerrado ${tag}`)
    report(await page.inputValue('#pro-name') === 'Persona Sintética' && await page.inputValue('#pro-profileUrl') === 'https://example.test/perfil' && await page.evaluate(() => document.getElementById('pro-cv').files.length) === 1 && await page.isChecked('#pro-consent'), `lo escrito, el PDF y el consentimiento se conservan ${tag}`)
    report(await page.locator('#pro-banner[role="alert"]').count() === 1, `el aviso es role=alert ${tag}`)
    await axeAndLayout(page, `estado cerrado ${tag}`)
    // Teclado: Tab llega a los campos; el botón inactivo no recibe foco.
    await page.focus('#pro-message'); await page.keyboard.type('x')
    report(!(await submit.isDisabled()), `editar rehabilita el envío ${tag}`)
    // 503 sin código = fallo del servidor, no cierre.
    state.mode = 'server'; await submit.click(); await page.waitForFunction(() => /guardar|save/i.test(document.getElementById('pro-banner')?.textContent || ''))
    const b2 = await page.locator('#pro-banner').innerText()
    report(t.server.test(b2) && !t.closed.test(b2) && !(await submit.isDisabled()), `503 sin not_accepting = aviso de servidor, envío activo ${tag}`)
    // Reintento con el límite liberado.
    state.mode = 'ok'; await submit.click(); await page.waitForSelector('h1:has-text("' + (lang === 'es' ? 'Solicitud recibida' : 'Application received') + '")')
    report(t.ok.test(await page.locator('h1').innerText()), `reintento exitoso tras el cierre ${tag}`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
