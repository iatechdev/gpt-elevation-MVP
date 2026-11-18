// ES-310 (PR 5): Personas usuarias (/admin/users) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos (correos .invalid). No corre en CI; evidencia del PR.
// Mide, en claro/oscuro × ES/EN × 1360/390/320 px (y 700 px para la tabla con desplazamiento): axe wcag2a/2aa/21a/21aa/22aa = 0 en las tres pestañas, los diálogos de Gestionar,
// Solicitar eliminación, Invitar y Rechazar, y el error de una pestaña; un solo h1; sin estilos en línea; sin desborde; objetivos >= 24 px; tabla en escritorio y tarjetas a <= 640 px;
// estados con palabra (✓ Activa); roles según la cuenta (admin: Persona usuaria y Profesional; superadmin: los cinco) y acciones privilegiadas (restablecer, eliminar) solo para superadmin;
// «Solicitar eliminación» deshabilitado hasta escribir el nombre exacto; pestañas con flechas; diálogo (foco al abrir, Tab atrapado, Esc cierra, foco devuelto); CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-310p && npx vite preview --outDir dist-310p --host 127.0.0.1 --port 4315 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4315 node scripts/es310-personas-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4315'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const day = d => new Date(Date.UTC(2026, 10, 17 - d, 15, 0)).toISOString()
const person = (id, name, role, extra = {}) => ({ id, name, email: `persona${id}@ejemplo.invalid`, role, active: true, therapistId: null, createdAt: day(id), plan: null, isLocked: false, lockedUntil: null, deletionRequested: false, ...extra })
const people = [
  person(1, 'Ana Sintética', 'user', { plan: { id: 1, slug: 'a', name_es: 'Plan A', name_en: 'Plan A' }, therapistId: 2 }),
  person(2, 'Marta Profesional con un nombre muy largo para probar el ajuste', 'therapist'),
  person(3, 'Luis Bloqueado', 'user', { isLocked: true, lockedUntil: day(-1) }),
  person(4, 'Eva Eliminación', 'user', { deletionRequested: true }),
  person(5, 'Inés Inactiva', 'user', { active: false }),
]
const matching = [{ id: 1, user: { id: 1, name: 'Ana Sintética', email: 'a@ejemplo.invalid' }, chosenTherapist: { id: 2, name: 'Marta Profesional' }, answers: { area: 'transition', style: 'direct', language: 'es' }, createdAt: day(1) }]
const plans = [{ id: 1, status: 'pending', createdAt: day(1), requester: { id: 1, name: 'Ana Sintética', email: 'a@ejemplo.invalid' }, plan: { id: 1, slug: 'b', name_es: 'Plan B', name_en: 'Plan B', price: 10, currency: 'USD' } }]

async function open(browser, { width, lang, scheme, role = 'superadmin', cpu = 1, matchingFails = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(([l, r]) => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l)
    window.__cls = 0; window.__src = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; for (const a of e.sources || []) window.__src.push(e.value.toFixed(3) + ' ' + (a.node?.nodeName || '?') + '.' + String(a.node?.className || '').slice(0, 40)) } }).observe({ type: 'layout-shift', buffered: true })
  }, [lang, role])
  const calls = []
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname; const method = route.request().method()
    if (method !== 'GET') calls.push(method + ' ' + p)
    if (p === '/api/session') return route.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/admin/usuarios' && method === 'GET') return route.fulfill({ json: people })
    if (p === '/api/admin/matching/pending') return matchingFails ? route.fulfill({ status: 500, json: {} }) : route.fulfill({ json: matching })
    if (p === '/api/admin/plan-requests/admin') return route.fulfill({ json: plans })
    if (/reject$/.test(p)) return route.fulfill({ json: { ok: true } })
    if (p === '/api/admin/invitations') return route.fulfill({ status: 201, json: { email: 'nueva@ejemplo.invalid', role: 'user', emailSent: true, expiresAt: day(-3), status: 'pending' } })
    return route.fulfill({ json: {} })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/users', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.locator('.au-panel .au-count').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors, calls }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button:not([hidden]), main a[href], main input:not([type=hidden]), main select, main textarea, dialog[open] button, dialog[open] input, dialog[open] select, dialog[open] textarea')].filter(e => { if (e.closest('.au-wide, .au-narrow') && getComputedStyle(e.closest('.au-wide, .au-narrow')).display === 'none') return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || e.id || '').trim().slice(0, 20)))
const common = async (page, tag, errors, name) => {
  report(await page.locator('h1').count() === 1, `h1 único, ${name} (${tag})`)
  report(await page.evaluate(() => document.querySelectorAll('main [style], dialog [style]').length) === 0, `sin estilos en línea, ${name} (${tag})`)
  const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal, ${name} (${tag})`, String(ov))
  const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px, ${name} (${tag})`, small.join(','))
  const v = await axe(page); report(v.length === 0, `axe en 0, ${name} (${tag})`, v.join(','))
  report(errors.length === 0, `sin errores de página, ${name} (${tag})`, errors.join('; '))
}
const optionsOf = (page, selector) => page.locator(`${selector} option`).allInnerTexts()

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 700, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    // 1) Personas (superadmin): tabla o tarjetas, estados con palabra, filtros con los cinco roles
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme })
      const wide = width > 640
      report(await page.locator('.au-wide').isVisible() === wide && await page.locator('.au-narrow').isVisible() === !wide, `${wide ? 'tabla' : 'tarjetas'} (${tag})`)
      const chips = (await page.locator(`${wide ? '.au-wide' : '.au-narrow'} .cg-chip`).allInnerTexts()).join(' | ')
      report(/✓/.test(chips) && chips.split('|').length === 5, `cinco estados con palabra y ✓ en «Activa»: ${chips.replace(/\n/g, ' ')} (${tag})`)
      report((await optionsOf(page, '#au-filter-role')).length === 6, `filtro de rol con los cinco roles + «todos» (${tag})`)
      report(await page.locator('.au-wide .cg-tablewrap').getAttribute('tabindex') === '0' && !!await page.locator('.au-wide .cg-tablewrap').getAttribute('aria-label'), `región de la tabla focalizable y con nombre (${tag})`)
      await common(page, tag, errors, 'personas')
      // filtro: «Bloqueada» deja una cuenta; limpiar filtros las devuelve
      await page.selectOption('#au-filter-status', 'locked'); report(/^1 /.test(await page.locator('.au-count').innerText()), `el filtro de estado deja 1 cuenta (${tag})`)
      await page.getByRole('button', { name: /Limpiar filtros|Clear filters/ }).click(); report(/^5 /.test(await page.locator('.au-count').innerText()), `«Limpiar filtros» devuelve las 5 (${tag})`)
      await ctx.close() }
    // 2) Gestionar (superadmin y admin) y Solicitar eliminación
    for (const role of ['superadmin', 'admin']) {
      const { ctx, page, errors, calls } = await open(browser, { width, lang, scheme, role }); const rtag = `${tag} ${role}`
      if (role === 'admin') report((await optionsOf(page, '#au-filter-role')).length === 4, `admin: filtro de rol sin superadministración ni junta (${rtag})`)
      const opener = page.locator(width > 640 ? '.au-wide .cg-btn' : '.au-narrow .cg-btn').first()
      await opener.focus(); await page.keyboard.press('Enter'); await page.locator('dialog[open]').waitFor()
      report(await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)), `foco dentro del diálogo al abrir (${rtag})`)
      const roleOptions = await optionsOf(page, 'dialog[open] #au-role')
      report(roleOptions.length === (role === 'superadmin' ? 5 : 2), `Gestionar: ${roleOptions.length} roles asignables (${rtag})`, roleOptions.join(','))
      const dlg = await page.locator('dialog[open]').textContent()
      const priv = /Enviar enlace de restablecimiento|Send reset link/.test(dlg) && /Solicitar eliminación…|Request deletion…/.test(dlg)
      report(priv === (role === 'superadmin'), `Gestionar: restablecer y eliminar ${role === 'superadmin' ? 'visibles' : 'ocultos'} (${rtag})`)
      await common(page, rtag, errors, 'gestionar')
      let inside = true; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)) }
      report(inside, `Tab atrapado dentro del diálogo (${rtag})`)
      if (role === 'superadmin') {
        await page.getByRole('button', { name: /Solicitar eliminación…|Request deletion…/ }).click()
        const confirm = page.locator('dialog[open] .cg-btn--danger')
        report(await confirm.isDisabled(), `eliminar: botón peligroso deshabilitado hasta escribir el nombre exacto (${rtag})`)
        await page.locator('#au-delete-name').fill('Ana Sintéticoo'); report(await confirm.isDisabled(), `eliminar: nombre casi igual sigue deshabilitado (${rtag})`)
        await page.locator('#au-delete-name').fill('Ana Sintética'); report(!await confirm.isDisabled(), `eliminar: nombre exacto lo habilita (${rtag})`)
        await common(page, rtag, errors, 'solicitar eliminación')
        report(!calls.some(c => c.startsWith('DELETE')), `eliminar: ninguna llamada hasta confirmar (${rtag})`)
        await page.locator('dialog[open] .cg-btn--ghost').first().click()
      }
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === (await opener.textContent()).trim(), `Esc cierra y el foco vuelve al botón «Gestionar» (${rtag})`)
      await ctx.close() }
    // 3) Invitar persona
    for (const role of ['superadmin', 'admin']) {
      const { ctx, page, errors } = await open(browser, { width, lang, scheme, role }); const rtag = `${tag} ${role}`
      await page.locator('#au-invite').click(); await page.locator('dialog[open]').waitFor()
      const roleOptions = await optionsOf(page, 'dialog[open] #invite-role')
      report(roleOptions.length === (role === 'superadmin' ? 5 : 2), `Invitar: ${roleOptions.length} roles invitables (${rtag})`, roleOptions.join(','))
      await page.locator('dialog[open] button[type=submit]').click()
      await page.locator('#invite-email[aria-invalid=true]').waitFor()
      report(await page.evaluate(() => document.activeElement?.id) === 'invite-email', `correo vacío: error enlazado al campo y foco en él (${rtag})`)
      await common(page, rtag, errors, 'invitar con error')
      await page.locator('#invite-email').fill('nueva@ejemplo.invalid'); await page.locator('dialog[open] button[type=submit]').click()
      await page.locator('dialog[open] [role=status]').waitFor(); report(/nueva@ejemplo\.invalid/i.test(await page.locator('dialog[open] [role=status]').textContent()), `invitación registrada con el correo (${rtag})`)
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      report(await page.evaluate(() => document.activeElement?.id) === 'au-invite', `el foco vuelve a «Invitar persona» (${rtag})`)
      await ctx.close() }
    // 4) Emparejamientos y Solicitudes de plan (+ rechazar), pestañas con flechas
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme })
      await page.locator('[role=tab]').first().focus(); await page.keyboard.press('ArrowRight')
      report(await page.locator('[role=tab][aria-selected=true]').count() === 1 && /\(1\)/.test(await page.locator('[role=tab][aria-selected=true]').innerText()), `flecha derecha pasa a «Emparejamientos (1)» (${tag})`)
      await page.locator('.au-panel .cg-item').first().waitFor(); await common(page, tag, errors, 'emparejamientos')
      await page.keyboard.press('End'); report(await page.locator('[role=tab][aria-selected=true]').count() === 1 && /\(1\)/.test(await page.locator('[role=tab][aria-selected=true]').innerText()), `Fin pasa a «Solicitudes de plan (1)» (${tag})`)
      await page.locator('.au-panel .cg-item').first().waitFor(); await common(page, tag, errors, 'solicitudes de plan')
      const reject = page.locator('.au-panel .cg-btn--ghost').first(); await reject.click(); await page.locator('dialog[open]').waitFor()
      await page.locator('dialog[open] .cg-btn--danger').click(); await page.locator('#au-reject-note[aria-invalid=true]').waitFor()
      await common(page, tag, errors, 'rechazar con error')
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === (await reject.textContent()).trim(), `el foco vuelve a «Rechazar…» (${tag})`)
      await ctx.close() }
    // 5) Error de una pestaña: no tumba las demás
    { const { ctx, page, errors } = await open(browser, { width, lang, scheme, matchingFails: true })
      await page.locator('[role=tab]').nth(1).click(); await page.locator('.au-panel [role=alert]').waitFor()
      report(await page.locator('.au-panel [role=alert] .cg-btn').count() === 1, `error de pestaña con «Reintentar» (${tag})`)
      await common(page, tag, errors, 'error de pestaña')
      await page.locator('[role=tab]').first().click(); report(await page.locator('.au-panel .cg-chip').count() >= 5, `la pestaña Personas sigue funcionando (${tag})`)
      await ctx.close() }
  }
  // CLS a 390 px con CPU×4
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 })
    await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme})`, cls > 0.1 ? 'fuentes: ' + (await page.evaluate(() => window.__src)).join(' ; ') : '')
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTodo OK'); process.exit(failures ? 1 : 0)
})()
