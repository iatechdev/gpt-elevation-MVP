// ES-168: El Puente (/app/bridge) en navegador real (Chromium), API simulada, datos sintéticos.
// Mide: diálogo de activar el DIARIO (hasta 10 entradas propias; el proveedor de IA procesa el texto; las de riesgo se saltan; nada se guarda ni llega al profesional sin confirmar cada idea;
// se puede retirar), diálogo de «Retirar todo» con sus dos consecuencias (lo cruzado + los permisos de las tres fuentes), el motivo de «para revisión» cuando se retiró una fuente (reviewReason),
// el aviso cuando los permisos cambian en otra pestaña (visibilitychange) y la accesibilidad (axe WCAG 2.x A/AA, un h1, sin desborde, objetivos >= 24 px) en ES/EN × 390/1360 × claro/oscuro.
// No corre en CI; evidencia del PR. Uso: `npx vite build && npx vite preview --port 5299 --strictPort` y luego
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://localhost:5299 node scripts/es168-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://localhost:5299'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const T = {
  es: { diary: 'Diario', allow: /Permitir.*diario|diario/i, count: 'Se leerán hasta 10 de tus entradas propias del diario (las más recientes).', provider: 'El texto que se lee lo procesa el proveedor de IA para generar las ideas. A un profesional no llega nada.',
    risk: 'Los textos que el sistema marca como de riesgo se saltan: no se leen.', each: 'Nada se guarda ni llega a tu profesional sin que confirmes cada idea.', withdraw: 'Puedes retirar este permiso cuando quieras.',
    yes: 'Sí, autorizar', cancel: 'Cancelar', all: 'Retirar todo', allCrossed: 'Lo que ya cruzó: tu profesional dejará de ver tu perfil profesional autorizado.', allPerms: 'Los permisos de lectura: la IA dejará de leer tu chat, tu diario y tu hoja de vida.',
    allKeep: 'No borra tus mensajes, tus entradas del diario, tus hojas de vida ni tus textos guardados.', allDone: 'Retiraste todo: lo que había cruzado y los permisos de lectura.', review: 'Retiraste el permiso de una de las fuentes de lo que autorizaste. Revisa lo que sigue cruzando.', changed: 'Los permisos cambiaron en otra pestaña o dispositivo. Los actualizamos.' },
  en: { diary: 'Journal', allow: /journal/i, count: 'Up to 10 of your own journal entries (the most recent) will be read.', provider: 'The text that is read is processed by the AI provider to generate the ideas. Nothing reaches a professional.',
    risk: 'Texts the system flags as risky are skipped: they are not read.', each: 'Nothing is saved or reaches your professional unless you confirm each idea.', withdraw: 'You can withdraw this permission at any time.',
    yes: 'Yes, allow', cancel: 'Cancel', all: 'Withdraw everything', allCrossed: 'What already crossed: your professional will stop seeing your authorized professional profile.', allPerms: 'The reading permissions: the AI will stop reading your chat, your journal and your résumé.',
    allKeep: 'It does not delete your messages, your journal entries, your résumés or your saved texts.', allDone: 'You withdrew everything: what had crossed and the reading permissions.', review: 'You withdrew the permission for one of the sources of what you authorized. Review what still crosses.', changed: 'The permissions changed in another tab or device. We updated them.' },
}
const field = { key: 'values', text: 'Valoro la autonomía sintética', origin: { type: 'direct' } }
const version = (extra = {}) => ({ version: 1, status: 'active', approvedAt: '2026-11-05T12:00:00.000Z', revokedAt: null, fields: [field], needsReview: false, ...extra })

async function open(browser, { width, lang, scheme, perms = { chat: false, diary: false, resume: false }, active = null }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const state = { perms: { ...perms }, active, revokes: 0, putCalls: [], failPutAt: 0, pageErrors: [] }
  page.on('pageerror', e => state.pageErrors.push(e.message))
  await page.route('**/api/**', async route => {
    const req = route.request(); const p = new URL(req.url()).pathname; const method = req.method()
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/consents' && method === 'GET') return route.fulfill({ json: { consents: Object.entries(state.perms).map(([source, on]) => ({ purpose: 'insights_' + source, status: on ? 'granted' : 'revoked' })) } })
    const put = p.match(/^\/api\/consents\/insights_(chat|diary|resume)$/)
    if (put && method === 'PUT') {
      const status = req.postDataJSON().status; state.putCalls.push([put[1], status])
      if (state.failPutAt && state.putCalls.length === state.failPutAt) return route.fulfill({ status: 500, json: {} })
      state.perms[put[1]] = status === 'granted'; return route.fulfill({ json: { status } })
    }
    if (p === '/api/career-context' && method === 'GET') return route.fulfill({ json: { active: state.active, versions: state.active ? [state.active] : [] } })
    if (p === '/api/career-context/revoke') { state.revokes++; state.active = null; return route.fulfill({ json: { revoked: true } }) }
    if (p === '/api/user/resumes') return route.fulfill({ json: { resumes: [] } })
    return route.fulfill({ json: {} })
  })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  await page.goto(BASE + '/app/bridge', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor()
  return { ctx, page, state }
}
async function axeAndLayout(page, label) {
  await page.addScriptTag({ content: axeSource })
  const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
  const r = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    small: [...document.querySelectorAll('main a[href], main button, [role=dialog] button, main select')].filter(el => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el); return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && (b.width < 24 || b.height < 24) }).map(el => el.tagName.toLowerCase() + ' «' + (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 28) + '» ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height)),
  }))
  report(r.h1 === 1 && r.overflow <= 0 && axe.length === 0, label, `h1=${r.h1} desborde=${r.overflow} axe=[${axe}]`)
  report(r.small.length === 0, `${label}: objetivos >= 24 px`, `pequeños=[${r.small}]`)
}
const diarySwitch = page => page.locator('[data-source="diary"]')

;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    const { ctx, page } = await open(browser, { width, lang, scheme, perms: { chat: true, diary: false, resume: false }, active: version() })
    await diarySwitch(page).waitFor()
    await axeAndLayout(page, `El Puente ${tag}`)
    await diarySwitch(page).click(); await page.getByRole('dialog').waitFor()
    const text = await page.getByRole('dialog').innerText()
    report([t.count, t.provider, t.risk, t.each, t.withdraw].every(line => text.includes(line)), `el diálogo del Diario dice: hasta 10 entradas propias, proveedor de IA, riesgo se salta, cada idea se confirma, se puede retirar ${tag}`, [t.count, t.provider, t.risk, t.each, t.withdraw].filter(line => !text.includes(line)).map(l => '«' + l.slice(0, 25) + '»').join(' '))
    await axeAndLayout(page, `diálogo del Diario ${tag}`)
    await page.getByRole('button', { name: t.cancel, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
    await page.getByRole('button', { name: t.all, exact: true }).click(); await page.getByRole('dialog').waitFor()
    const all = await page.getByRole('dialog').innerText()
    report([t.allCrossed, t.allPerms, t.allKeep].every(line => all.includes(line)), `«${t.all}» dice las dos consecuencias (lo cruzado + los permisos) y qué no borra ${tag}`)
    await axeAndLayout(page, `diálogo «${t.all}» ${tag}`)
    await ctx.close()
  }

  for (const [lang, width, scheme] of [['es', 1360, 'light'], ['en', 390, 'dark']]) {
    const t = T[lang]; const tag = `${lang} ${width}px ${scheme}`
    // 1) Activar el diario: el foco entra en «Cancelar», Esc cierra y devuelve el foco; confirmar concede solo el diario.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme })
      await diarySwitch(page).click(); await page.getByRole('dialog').waitFor()
      report(await page.getByRole('button', { name: t.cancel, exact: true }).evaluate(el => el === document.activeElement), `el foco inicial del diálogo del Diario está en «${t.cancel}» ${tag}`)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
      report(await diarySwitch(page).evaluate(el => el === document.activeElement) && state.putCalls.length === 0, `Esc cierra sin conceder y devuelve el foco al interruptor ${tag}`)
      await diarySwitch(page).click(); await page.getByRole('button', { name: t.yes, exact: true }).click()
      await page.waitForFunction(() => document.querySelector('[data-source="diary"]')?.getAttribute('aria-checked') === 'true')
      report(JSON.stringify(state.putCalls) === JSON.stringify([['diary', 'granted']]), `confirmar concede SOLO el permiso del diario ${tag}`, JSON.stringify(state.putCalls))
      await ctx.close()
    }
    // 2) «Retirar todo»: retira lo cruzado y los permisos activos; nada se borra.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, perms: { chat: true, diary: true, resume: false }, active: version() })
      await page.getByRole('button', { name: t.all, exact: true }).click(); await page.getByRole('dialog').waitFor()
      report(await page.getByRole('button', { name: t.cancel, exact: true }).evaluate(el => el === document.activeElement), `el foco inicial de «${t.all}» está en «${t.cancel}» ${tag}`)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('[role=dialog]'))
      report(state.revokes === 0 && state.putCalls.length === 0, `Esc cierra sin retirar nada ${tag}`)
      await page.getByRole('button', { name: t.all, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: t.all, exact: true }).click()
      await page.getByText(t.allDone).first().waitFor({ timeout: 8000 })
      report(state.revokes === 1 && state.active === null && JSON.stringify(state.putCalls.slice().sort()) === JSON.stringify([['chat', 'revoked'], ['diary', 'revoked']].sort()), `«${t.all}» retira lo cruzado (1 llamada) y los 2 permisos activos, ni uno más ${tag}`, JSON.stringify(state.putCalls))
      report(await page.getByRole('button', { name: t.all, exact: true }).count() === 0, `sin nada que retirar, el botón desaparece ${tag}`)
      await ctx.close()
    }
    // 3) Fallo a medias: no se declara éxito.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, perms: { chat: true, diary: true, resume: false }, active: version() })
      state.failPutAt = 2
      await page.getByRole('button', { name: t.all, exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: t.all, exact: true }).click()
      await page.getByRole('alert').filter({ hasText: /./ }).first().waitFor({ timeout: 8000 })
      report(await page.getByText(t.allDone).count() === 0, `si un permiso falla a medias NO se dice que se retiró todo ${tag}`)
      await ctx.close()
    }
    // 4) Motivo de «para revisión» tras retirar una fuente (reviewReason de ES-229).
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, active: version({ needsReview: true, reviewReason: 'source_revoked' }) })
      await page.getByText(t.review).waitFor()
      report(true, `«para revisión» con motivo de fuente retirada ${tag}`)
      await axeAndLayout(page, `El Puente con motivo de revisión ${tag}`)
      await ctx.close()
    }
    // 5) Permisos cambiados en otra pestaña: al volver se actualizan y se avisa.
    {
      const { ctx, page, state } = await open(browser, { width, lang, scheme, perms: { chat: true, diary: false, resume: false } })
      await diarySwitch(page).waitFor()
      state.perms.diary = true
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.getByText(t.changed).waitFor({ timeout: 8000 })
      report(await diarySwitch(page).getAttribute('aria-checked') === 'true', `al volver a la pestaña se actualizan los permisos y se avisa ${tag}`)
      report(state.pageErrors.length === 0, `sin errores de página ${tag}`, state.pageErrors.join(' | '))
      await ctx.close()
    }
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(2) })
