// ES-171: /app/compass en navegador real (Chromium), API simulada con la MISMA idempotencia del servidor (requestId), datos sintéticos.
// Resultado incierto al confirmar: la revisión se conserva y ofrece «Comprobar» y «Reintentar» (mismo requestId y mismo token); con el token vencido solo «Renovar vista previa».
// Conflicto: aviso propio, se recarga la versión vigente y lo escrito se conserva. Retirar: el diálogo dice «Tu profesional dejará de ver este contexto…» (cierto: ver es-25-bridge.test.cjs).
// Matriz ES/EN × 390/1360 px × claro/oscuro del sistema (la pantalla es clara por diseño: se mide y se declara): axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es171-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { category: 'Selecciona una categoría', text: 'Texto que quiero autorizar', include: 'Incluir en la autorización', preview: 'Ver exactamente qué autorizo', authorize: 'He revisado estos campos y autorizo su uso profesional.',
    confirm: 'Confirmar autorización', confirmed: 'Autorización confirmada', check: 'Comprobar', retry: 'Reintentar', renew: 'Renovar vista previa', edit: 'Seguir editando',
    uncertain: 'No pudimos verificar la confirmación. Tu selección sigue aquí.', none: 'Todavía no vemos esa confirmación. Puedes reintentar: no se duplica.', conflict: 'Hay una versión más reciente de tu contexto. La recargamos; revisa antes de continuar.',
    withdraw: 'Retirar contexto vigente', withdrawConfirm: 'Retirar contexto', cancel: 'Cancelar', help: 'Tu profesional dejará de ver este contexto. No borra tus textos guardados ni otros permisos, que se gestionan por separado.', withdrawn: 'Contexto retirado del uso profesional' },
  en: { category: 'Choose a category', text: 'Text I want to authorize', include: 'Include in the authorization', preview: 'See exactly what I authorize', authorize: 'I have reviewed these fields and authorize their professional use.',
    confirm: 'Confirm authorization', confirmed: 'Authorization confirmed', check: 'Check', retry: 'Retry', renew: 'Renew preview', edit: 'Keep editing',
    uncertain: 'We could not verify the confirmation. Your selection is still here.', none: 'We do not see that confirmation yet. You can try again: it will not be duplicated.', conflict: 'There is a newer version of your context. We reloaded it; review it before continuing.',
    withdraw: 'Withdraw current context', withdrawConfirm: 'Withdraw context', cancel: 'Cancel', help: 'Your professional will stop seeing this context. It does not delete your saved texts or other permissions, which are managed separately.', withdrawn: 'Context withdrawn from professional use' },
}
const version = (n, text, status = 'active') => ({ version: n, status, approvedAt: '2026-11-01T12:00:00.000Z', revokedAt: status === 'revoked' ? '2026-11-02T12:00:00.000Z' : null, fields: [{ key: 'interests', text, origin: { type: 'direct' } }], ...(status === 'active' ? { needsReview: false } : {}) })

async function open(browser, { width, lang, scheme, mode = 'ok', withActive = false, ttlMs = 600000 }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { versions: withActive ? [version(1, 'Contexto existente')] : [], confirms: [], revokes: 0, byRequest: new Map(), mode, pageErrors: [] }
  const ack = v => ({ ...v, fields: v.fields.map(({ key, text }) => ({ key, text })) }) // FORMA REAL del servidor: /confirm responde {key,text}; el GET añade origin
  const snapshot = () => { const active = state.versions.find(v => v.status === 'active') || null; return { active, versions: state.versions } }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/session', route => route.fulfill({ json: { role: 'user', onboardingCompleted: true } }))
  await page.route('**/api/career-context**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (method === 'GET') return route.fulfill({ json: snapshot() })
    const body = req.postDataJSON()
    if (p.endsWith('/preview')) return route.fulfill({ json: { token: 'opaque-preview-' + Math.random().toString(16).slice(2, 8), expiresAt: new Date(Date.now() + ttlMs).toISOString(), representation: body.fields.map(f => ({ key: f.key, text: f.text.trim() })) } })
    if (p.endsWith('/confirm')) {
      state.confirms.push(body)
      if (state.byRequest.has(body.requestId)) return route.fulfill({ status: 201, json: ack(state.byRequest.get(body.requestId)) }) // idempotente: la misma versión
      if (state.mode === 'conflict') { state.mode = 'ok'; state.versions = [version(5, 'Cambio hecho en otra pestaña'), ...state.versions.map(v => ({ ...v, status: 'superseded', needsReview: undefined }))]; return route.fulfill({ status: 409, json: { code: 'conflict' } }) }
      if (state.mode === 'drop') { state.mode = 'ok'; return route.abort('connectionreset') } // nunca llegó al servidor
      const next = version((state.versions[0]?.version || 0) + 1, body.fields[0].text.trim())
      state.versions = [next, ...state.versions.map(v => v.status === 'active' ? { ...v, status: 'superseded', needsReview: undefined } : v)]
      state.byRequest.set(body.requestId, next)
      if (state.mode === 'lose-ack') { state.mode = 'ok'; return route.abort('connectionreset') } // el servidor guardó, la respuesta no llegó
      return route.fulfill({ status: 201, json: ack(next) })
    }
    if (p.endsWith('/revoke')) { state.revokes++; state.versions = state.versions.map(v => v.status === 'active' ? { ...v, status: 'revoked', revokedAt: '2026-11-03T12:00:00.000Z', needsReview: undefined } : v); return route.fulfill({ json: { revoked: true } }) }
    return route.fulfill({ status: 404, json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/compass', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor()
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main a[href], main button, main select, main textarea, dialog[open] button')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => (el.getAttribute('aria-label') || el.innerText || el.id).trim().slice(0, 24)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
async function toReview(page, t, text = 'Texto sintético de prueba') {
  await page.getByLabel(t.category, { exact: true }).selectOption('interests'); await page.getByLabel(t.text, { exact: true }).fill(text)
  await page.getByLabel(t.include, { exact: true }).check(); await page.getByRole('button', { name: t.preview, exact: true }).click()
  await page.getByLabel(t.authorize, { exact: true }).waitFor(); await page.getByLabel(t.authorize, { exact: true }).check()
}
const confirmBtn = (page, t) => page.getByRole('button', { name: t.confirm, exact: true })

;(async () => {
  const browser = await chromium.launch()
  // Matriz: estados clave con axe.
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, withActive: true })
      await axeAndLayout(page, `brújula con contexto vigente ${tag}`)
      await page.getByRole('button', { name: t.withdraw, exact: true }).click(); await page.locator('dialog[open]').waitFor()
      report((await page.locator('dialog[open]').innerText()).includes(t.help), `el diálogo de retirar dice «${t.help.slice(0, 40)}…» ${tag}`)
      await axeAndLayout(page, `diálogo de retirar ${tag}`)
      await ctx.close()
    }
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, mode: 'lose-ack' })
      await toReview(page, t); await confirmBtn(page, t).click()
      await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      await axeAndLayout(page, `confirmación incierta con «${t.check}» y «${t.retry}» ${tag}`)
      await ctx.close()
    }
  }

  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    // 1) ACK perdido (el servidor sí guardó): se conserva la revisión; «Reintentar» usa el MISMO requestId y token y no duplica.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, mode: 'lose-ack' })
      await toReview(page, t); await confirmBtn(page, t).click()
      await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      report(state.confirms.length === 1, `una sola confirmación enviada; nunca se reintenta sola ${tag}`)
      report(await page.getByRole('button', { name: t.check, exact: true }).isVisible() && await page.getByRole('button', { name: t.retry, exact: true }).isVisible() && await page.getByRole('button', { name: t.confirm, exact: true }).count() === 0, `la revisión sigue con «${t.check}» y «${t.retry}» (sin «${t.confirm}») ${tag}`)
      report(await page.getByLabel(t.authorize, { exact: true }).isChecked(), `la casilla de autorización se conserva ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click()
      await page.getByText(t.confirmed, { exact: true }).waitFor({ timeout: 8000 })
      const [a, b] = state.confirms
      report(state.confirms.length === 2 && a.requestId === b.requestId && a.token === b.token, `reintentar usa el MISMO requestId y el MISMO token ${tag}`)
      report(state.versions.filter(v => v.status === 'active').length === 1 && state.versions.length === 1, `no se duplica la versión (1 versión, activa) ${tag}`)
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
    // 2) «Comprobar» tras ACK perdido: relee y reconoce la versión nueva sin enviar otra confirmación.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, mode: 'lose-ack' })
      await toReview(page, t); await confirmBtn(page, t).click(); await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      await page.getByRole('button', { name: t.check, exact: true }).click()
      await page.getByText(t.confirmed, { exact: true }).waitFor({ timeout: 8000 })
      report(state.confirms.length === 1, `«${t.check}» reconoce la versión nueva sin enviar otra confirmación ${tag}`)
      await ctx.close()
    }
    // 3) Corte antes de llegar al servidor: «Comprobar» dice que aún no se ve; «Reintentar» confirma.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, mode: 'drop' })
      await toReview(page, t); await confirmBtn(page, t).click(); await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      await page.getByRole('button', { name: t.check, exact: true }).click(); await page.getByText(t.none).first().waitFor({ timeout: 8000 })
      report(state.versions.length === 0 && await page.getByRole('button', { name: t.retry, exact: true }).isVisible(), `«${t.check}» sin versión nueva: «${t.none.slice(0, 30)}…» y sigue «${t.retry}» ${tag}`)
      await page.getByRole('button', { name: t.retry, exact: true }).click(); await page.getByText(t.confirmed, { exact: true }).waitFor({ timeout: 8000 })
      report(state.versions.length === 1 && state.confirms.length === 2 && state.confirms[0].requestId === state.confirms[1].requestId, `«${t.retry}» confirma con el mismo requestId ${tag}`)
      await ctx.close()
    }
    // 4) Token vencido: no se ofrece «Reintentar»; solo «Renovar vista previa» (nuevo token).
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, mode: 'drop', ttlMs: 5000 })
      await toReview(page, t); await confirmBtn(page, t).click(); await page.getByText(t.uncertain).first().waitFor({ timeout: 8000 })
      await page.getByRole('button', { name: t.renew, exact: true }).waitFor({ timeout: 12000 })
      report(await page.getByRole('button', { name: t.retry, exact: true }).count() === 0, `con el token vencido no hay «${t.retry}»: solo «${t.renew}» ${tag}`)
      const before = state.confirms.length
      await page.getByRole('button', { name: t.renew, exact: true }).click(); await page.getByLabel(t.authorize, { exact: true }).waitFor()
      report(state.confirms.length === before, `renovar no envía ninguna confirmación ${tag}`)
      await ctx.close()
    }
    // 5) Conflicto: aviso propio, versión vigente recargada y lo escrito se conserva.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, mode: 'conflict', withActive: true })
      await toReview(page, t, 'Mi texto escrito'); await confirmBtn(page, t).click()
      await page.getByText(t.conflict).first().waitFor({ timeout: 8000 })
      report(await page.getByText('Cambio hecho en otra pestaña').first().isVisible(), `se recarga y muestra la versión vigente ${tag}`)
      report(await page.getByLabel(t.text, { exact: true }).inputValue() === 'Mi texto escrito' && await page.getByLabel(t.include, { exact: true }).isChecked(), `lo escrito y la selección se conservan ${tag}`)
      await axeAndLayout(page, `aviso de conflicto ${tag}`)
      await ctx.close()
    }
    // 6) Retirar: foco inicial en «Cancelar», Esc cierra, confirmar retira.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, withActive: true })
      await page.getByRole('button', { name: t.withdraw, exact: true }).click(); await page.locator('dialog[open]').waitFor()
      report(await page.getByRole('button', { name: t.cancel, exact: true }).evaluate(el => el === document.activeElement), `el foco inicial del diálogo de retirar está en «${t.cancel}» ${tag}`)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      report(state.revokes === 0, `Esc cierra el diálogo sin retirar ${tag}`)
      await page.getByRole('button', { name: t.withdraw, exact: true }).click(); await page.locator('dialog[open]').getByRole('button', { name: t.withdrawConfirm, exact: true }).click()
      await page.getByText(t.withdrawn, { exact: true }).waitFor({ timeout: 8000 })
      report(state.revokes === 1 && !state.versions.some(v => v.status === 'active'), `confirmar retira (1 llamada) y no queda versión activa ${tag}`)
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
