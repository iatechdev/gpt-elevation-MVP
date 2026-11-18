// ES-310 (PR 3): Guías de la IA (/admin/prompts) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe wcag2a/2aa/21a/21aa/22aa = 0 (lista, detalle, diálogo abierto, error del servidor) en claro/oscuro × ES/EN × 1360/390/320 px, h1 único, sin estilos en línea,
// sin desborde, objetivos >= 24 px, dos columnas desde 901 px, rol (admin no ve Aprobar/Rechazar/Publicar/Nueva guía; superadmin sí), diálogo (foco al abrir, Tab atrapado,
// Esc cierra, foco devuelto), contador «0 / mínimo 50» que deshabilita el envío, error del servidor con razones y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-310g && npx vite preview --outDir dist-310g --host 127.0.0.1 --port 4312 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4312 node scripts/es310-guias-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4312'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const iso = d => new Date(Date.UTC(2026, 10, 17 - d, 15, 0)).toISOString()
const guides = [
  { key: 'companion_main', activeVersion: 4, activeBy: 'Ana Sintética', activeAt: iso(5), approvedBy: 'Sup Sintético', pendingCount: 1, versionCount: 5, lastChangeAt: iso(1) },
  { key: 'compass_main_con_un_identificador_muy_largo_que_debe_partirse_sin_desbordar', activeVersion: 2, activeBy: null, activeAt: iso(20), approvedBy: null, pendingCount: 0, versionCount: 2, lastChangeAt: iso(20) },
]
const longText = 'Guía sintética: acompañar sin diagnosticar, sin tratar y sin prometer empleo. '.repeat(8)
const versions = [
  { id: 5, key: 'companion_main', version: 5, status: 'pending_review', proposed_by: 'Luz Sintética', approved_by: null, rejected_by: null, rejection_note: null, approved_at: null, rejected_at: null, createdAt: iso(1), updatedAt: iso(1), content: longText, reviewReasons: [{ code: 'x', es: 'Revisar tono.', en: 'Review the tone.' }] },
  { id: 4, key: 'companion_main', version: 4, status: 'active', proposed_by: 'Ana Sintética', approved_by: 'Sup Sintético', rejected_by: null, rejection_note: null, approved_at: iso(5), rejected_at: null, createdAt: iso(6), updatedAt: iso(5), content: longText },
  { id: 3, key: 'companion_main', version: 3, status: 'archived', proposed_by: 'Ana Sintética', approved_by: 'Sup Sintético', rejected_by: null, rejection_note: null, approved_at: iso(30), rejected_at: null, createdAt: iso(31), updatedAt: iso(30), content: longText },
  { id: 2, key: 'companion_main', version: 2, status: 'rejected', proposed_by: 'Luz Sintética', approved_by: null, rejected_by: 'Sup Sintético', rejection_note: 'Quita las promesas de empleo.', approved_at: null, rejected_at: iso(40), createdAt: iso(41), updatedAt: iso(40), content: longText },
]

async function open(browser, { width, lang, scheme, role = 'superadmin', cpu = 1, postFail = false }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(([l, r]) => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l)
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  }, [lang, role])
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const p = url.pathname
    if (p === '/api/session') return route.fulfill({ json: { role, onboardingCompleted: true } })
    if (p === '/api/admin/prompts') return route.fulfill({ json: guides })
    if (/^\/api\/admin\/prompt\/.+\/versions$/.test(p)) return route.fulfill({ json: versions })
    if (route.request().method() === 'POST' && /prompt/.test(p)) return postFail ? route.fulfill({ status: 422, json: { error: 'La guía no supera la revisión. / The guide does not pass review.', reasons: [{ code: 'x', es: 'Contiene un diagnóstico.', en: 'It contains a diagnosis.' }] } }) : route.fulfill({ json: { ok: true } })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/admin/prompts', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.locator('.ap-pick').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('main button, main a[href], dialog[open] button, dialog[open] input, dialog[open] textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20)))

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page, errors } = await open(browser, { width, lang, scheme })
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea (${tag})`)
    report(await page.locator('.ap-pick').count() === 2, `dos guías en la lista (${tag})`)
    let v = await axe(page); report(v.length === 0, `axe en 0, lista (${tag})`, v.join(','))
    // seleccionar la primera guía
    await page.locator('.ap-pick').first().click()
    await page.locator('.ap-detail').waitFor()
    const cols = await page.evaluate(() => { const w = document.querySelector('.ap-work'); return getComputedStyle(w).gridTemplateColumns.split(' ').length })
    report(cols === (width >= 901 ? 2 : 1), `${cols} columna(s) (${tag})`)
    report(await page.locator('.ap-pick[aria-current=true]').count() === (width >= 901 ? 1 : 0), `guía elegida con aria-current cuando la lista sigue visible (${tag})`)
    report(await page.locator('.cg-chip').count() >= 4, `estados con Chip (palabra) (${tag})`)
    const activeChip = (await page.locator('.cg-chip--ok').first().innerText()).trim()
    report(/✓/.test(activeChip) && activeChip.length > 2, `«Activa» con símbolo y palabra «${activeChip.replace('\n', ' ')}» (${tag})`)
    // ver texto
    const toggle = page.locator('.ap-detail button[aria-expanded]').first(); await toggle.click()
    report(await toggle.getAttribute('aria-expanded') === 'true' && await page.locator('.ap-text').count() >= 1, `ver texto activo (${tag})`)
    const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal (${tag})`, String(ov))
    const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
    v = await axe(page); report(v.length === 0, `axe en 0, detalle (${tag})`, v.join(','))
    // rol superadmin: ve Aprobar / Rechazar / Publicar / Nueva guía
    report(await page.locator('main .cg-btn--danger').count() === 1 && await page.locator('main button:has-text("Publicar"), main button:has-text("Publish")').count() >= 1, `superadmin ve Rechazar y Publicar (${tag})`)
    // diálogo Proponer
    const opener = page.locator('.ap-detail section.cg-card .pg-actions .cg-btn').first()
    await opener.focus(); await page.keyboard.press('Enter')
    await page.locator('dialog[open]').waitFor()
    report(await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)), `foco dentro del diálogo al abrir (${tag})`)
    const submit = page.locator('dialog[open] .cg-dialog__actions .cg-btn:not(.cg-btn--ghost)')
    await page.locator('dialog[open] textarea').fill('corto')
    report(await submit.isDisabled(), `con menos de 50 caracteres el envío está deshabilitado (${tag})`)
    report(/5 \/ 50/.test(await page.locator('dialog[open] .cg-hint').last().innerText()), `contador «5 / 50» (${tag})`)
    v = await axe(page); report(v.length === 0, `axe en 0, diálogo abierto (${tag})`, v.join(','))
    const ovd = await overflow(page); report(ovd <= 0, `sin desborde con el diálogo (${tag})`, String(ovd))
    // Tab atrapado: 12 Tab no sacan el foco del diálogo
    let inside = true; for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); inside = inside && await page.evaluate(() => !!document.querySelector('dialog[open]')?.contains(document.activeElement)) }
    report(inside, `Tab atrapado dentro del diálogo (${tag})`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === (await opener.textContent()).trim(), `Esc cierra y el foco vuelve al botón que abrió (${tag})`)
    report(errors.length === 0, `sin errores de página (${tag})`, errors.join('; '))
    await ctx.close()
  }
  // Rol admin (no superadmin): sin Rechazar/Aprobar/Publicar/Nueva guía
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 1360, lang: 'es', scheme, role: 'admin' })
    await page.locator('.ap-pick').first().click(); await page.locator('.ap-detail').waitFor()
    const txt = await page.locator('main').innerText()
    report(!/Publicar versión|Aprobar|Rechazar|\+ Nueva guía|Volver a esta versión/.test(txt) && /proponer versión/i.test(txt), `admin: solo Proponer; sin Publicar/Aprobar/Rechazar/Nueva guía/Volver (${scheme})`)
    const v = await axe(page); report(v.length === 0, `axe en 0, vista admin (${scheme})`, v.join(',')); await ctx.close()
  }
  // Error del servidor al publicar: Banner con razones, el texto se conserva, axe en 0
  for (const scheme of ['light', 'dark']) for (const width of [1360, 320]) {
    const tag = `${width}px ${scheme}`
    const { ctx, page } = await open(browser, { width, lang: 'es', scheme, postFail: true })
    await page.locator('.ap-pick').first().click(); await page.locator('.ap-detail').waitFor()
    await page.getByRole('button', { name: 'Publicar versión' }).click(); await page.locator('dialog[open]').waitFor()
    await page.locator('dialog[open] textarea').fill(longText)
    await page.getByRole('button', { name: 'Publicar ahora' }).click()
    await page.locator('dialog[open] .cg-banner--error[role=alert]').waitFor()
    const bt = await page.locator('dialog[open] .cg-banner--error').innerText()
    report(/no supera la revisión/.test(bt) && /diagnóstico/.test(bt) && !/does not pass/.test(bt), `error 422 en el idioma activo con razones (${tag})`)
    report(await page.locator('dialog[open] textarea').inputValue() === longText, `el texto se conserva tras el error (${tag})`)
    const v = await axe(page); report(v.length === 0, `axe en 0, diálogo con error (${tag})`, v.join(',')); await ctx.close()
  }
  // CLS a 390 px con CPU×4
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4 })
    await page.waitForTimeout(800)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme})`)
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTodo OK'); process.exit(failures ? 1 : 0)
})()
