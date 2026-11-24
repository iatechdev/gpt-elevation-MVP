// [QA-Claude-5] PR #404 (ES-286): El Puente muestra mensaje propio ante source_consent_required / source_consent_revoked.
// Backend REAL (403 reales de /api/career-context/preview y /confirm) + build fresco. Solo la PROPUESTA de IA va simulada (page.route a /api/insights/proposals): 0 IA real. Datos sintéticos.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4402 API=http://127.0.0.1:8402 CRED=<cred404.json> node qa/qa5-404-ui.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8')
const BASE = process.env.BASE, API = process.env.API, CRED = JSON.parse(fs.readFileSync(process.env.CRED, 'utf8'))
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const COPY = {
  es: { req: 'Para usar esa fuente como origen, primero autoriza su análisis en la sección de fuentes de esta pantalla. Tu texto sigue aquí y no se guardó nada.', rev: 'El permiso de esa fuente se retiró mientras preparabas esto, así que no se guardó nada. Autorízala de nuevo para usarla, o déjala fuera de lo que cruzas.', gen: 'No pudimos guardar. Intenta de nuevo.', bridge: 'Necesitas autorizar el puente profesional antes de cruzar esto.', analyze: /Analizar mi diario/, authorize: /Autorizar cruce/, confirm: /^Confirmar$/ },
  en: { req: 'To use that source as an origin, first allow its analysis in the sources section of this screen. Your text is still here and nothing was saved.', rev: 'The permission for that source was withdrawn while you were preparing this, so nothing was saved. Allow it again to use it, or leave it out of what you cross.', gen: 'We could not save. Try again.', bridge: 'You need to authorize the professional bridge before crossing this.', analyze: /Analyze my (diary|journal)/i, authorize: /Authorize crossing/i, confirm: /^Confirm$/ },
}
let TOKEN = null, ROLE = 'user', DIARY = null
const api = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const grant = (purpose, status = 'granted') => api('PUT', `/api/consents/${purpose}`, { status })
const active = async () => (await api('GET', '/api/career-context')).body
const open = async (br, { lang = 'es', width = 1360, height = 900, scheme = 'light' } = {}) => {
  const ctx = await br.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([tk, role, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', role); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Persona Sintetica') }, [TOKEN, ROLE, lang])
  await page.route('**/api/insights/proposals', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ insights: [{ key: 'motivations', text: 'Me motiva coordinar equipos pequeños.', origins: [{ type: 'diary_entry', id: DIARY, quote: 'Una entrada del diario sintética' }] }] }) }))
  return { ctx, page, errs }
}
const alertText = (page) => page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()).join(' | '))
// Prepara: consentimientos concedidos, abre El Puente y deja una propuesta del diario en pantalla.
const prepare = async (br, opts) => {
  await grant('professional_bridge'); await grant('insights_diary')
  const t = await open(br, opts); await t.page.goto(BASE + '/app/bridge'); await t.page.waitForSelector('main', { timeout: 20000 }); await t.page.waitForTimeout(900)
  const c = COPY[opts.lang || 'es']; await t.page.getByRole('button', { name: c.analyze }).first().click({ timeout: 10000 }); await t.page.waitForTimeout(900)
  return t
}
const authorizeAndConfirm = async (page, lang, pause) => {
  const c = COPY[lang]; await page.getByRole('button', { name: c.authorize }).first().click({ timeout: 10000 }); await page.waitForTimeout(300)
  await page.getByRole('button', { name: c.confirm }).first().click({ timeout: 10000 }); await page.waitForTimeout(pause || 1500)
}
;(async () => {
  const br = await chromium.launch()
  const s = await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: CRED.persona, password: CRED.pass }) })).json(); TOKEN = s.token; ROLE = s.role || 'user'
  // contexto vacío para saltar el onboarding (como en las otras pruebas)
  const EMPTY = Object.fromEntries(['motivations', 'values', 'interests', 'energy_gives', 'energy_drains', 'desired_conditions', 'constraints', 'strengths', 'skills', 'experience', 'education', 'goals', 'blockers', 'support', 'notes'].map((k) => [k, '']))
  await api('PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: 0, action: 'continue', context: EMPTY })
  const d = await api('POST', '/api/diary', { date: '2026-10-01', content: 'Una entrada del diario sintética' }); DIARY = d.body && d.body.id; check('entrada de diario sintética creada (origen)', d.status < 300 && Number.isInteger(DIARY), d.status + ' ' + JSON.stringify(d.body).slice(0, 120))

  // 0) la API real devuelve los 403 con los códigos que el cliente ahora conserva
  await grant('professional_bridge'); await grant('insights_diary', 'revoked')
  const fields = [{ key: 'motivations', text: 'Me motiva coordinar equipos pequeños.', origin: { type: 'diary_entry', id: DIARY } }]
  const pv = await api('POST', '/api/career-context/preview', { fields }); check('API real: preview sin permiso de la fuente → 403 source_consent_required', pv.status === 403 && pv.body.code === 'source_consent_required', pv.status + ' ' + JSON.stringify(pv.body))

  for (const lang of ['es', 'en']) {
    const c = COPY[lang]
    // A) preview: la fuente no tiene permiso cuando la persona confirma
    { await grant('insights_diary'); const { ctx, page, errs } = await prepare(br, { lang }); await grant('insights_diary', 'revoked'); await authorizeAndConfirm(page, lang)
      const at = await alertText(page)
      check(`[${lang}] A (preview): se muestra el mensaje PROPIO «fuente requerida» (role=alert) y no el genérico ni el del puente`, at.includes(c.req) && !at.includes(c.gen) && !at.includes(c.bridge), at)
      const v = await active(); check(`[${lang}] A: no se guardó nada (sin versión activa)`, !v.active, JSON.stringify(v).slice(0, 200))
      check(`[${lang}] A: el insight sigue en pantalla ("Tu texto sigue aquí") y sin desborde`, await page.evaluate(() => document.body.innerText.includes('Me motiva coordinar equipos pequeños.') && document.documentElement.scrollWidth <= innerWidth + 1))
      check(`[${lang}] A: sin errores de JavaScript`, errs.length === 0, errs.join('|'))
      // recuperación: la persona vuelve a autorizar la fuente y reintenta el mismo insight
      await grant('insights_diary'); const retry = page.getByRole('button', { name: c.confirm }); if (await retry.count()) { await retry.first().click(); await page.waitForTimeout(1500) } else await authorizeAndConfirm(page, lang)
      const v2 = await active(); check(`[${lang}] A: tras autorizar la fuente de nuevo, el reintento cruza el texto (versión activa con el campo)`, !!(v2.active && JSON.stringify(v2.active).includes('Me motiva')), JSON.stringify(v2).slice(0, 200))
      check(`[${lang}] A: el aviso de error desaparece tras el éxito`, !(await alertText(page)).includes(c.req), await alertText(page))
      await api('POST', '/api/career-context/revoke'); await ctx.close() }
    // B) confirm: el permiso se retira ENTRE la vista previa y la confirmación (se intercepta confirm y se retira antes de dejarlo pasar al backend real)
    { await grant('insights_diary'); const { ctx, page, errs } = await prepare(br, { lang })
      await page.route('**/api/career-context/confirm', async (route) => { await grant('insights_diary', 'revoked'); await route.continue() })
      await authorizeAndConfirm(page, lang); const at = await alertText(page)
      check(`[${lang}] B (confirm): se muestra el mensaje PROPIO «permiso retirado» y no el genérico`, at.includes(c.rev) && !at.includes(c.gen) && !at.includes(c.req), at)
      const v = await active(); check(`[${lang}] B: no se creó versión (nada guardado)`, !v.active, JSON.stringify(v).slice(0, 200))
      check(`[${lang}] B: sin errores de JavaScript`, errs.length === 0, errs.join('|'))
      await ctx.close() }
  }
  // C) axe + desborde con el aviso visible (el más largo: «revoked»), claro/oscuro × 1360/390/320 × es/en
  for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) {
    await grant('insights_diary'); const { ctx, page } = await prepare(br, { lang, width, scheme, height: 800 })
    await page.route('**/api/career-context/confirm', async (route) => { await grant('insights_diary', 'revoked'); await route.continue() })
    await authorizeAndConfirm(page, lang); const shown = (await alertText(page)).includes(COPY[lang].rev)
    await page.addScriptTag({ content: axeSource })
    const v = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' ')))))
    const ox = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
    check(`aviso visible + axe = 0 + sin desborde · ${scheme} ${width}px ${lang}`, shown && v.length === 0 && !ox, JSON.stringify({ shown, v, ox })); await ctx.close() }
  console.log(`UI #404: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
