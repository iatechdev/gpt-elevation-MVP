// ES-309 (PR 1): panel profesional (/therapist/dashboard) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe WCAG 2.x A/AA (wcag2a/2aa/21a/21aa/22aa) = 0 en claro y oscuro, ES/EN × 1360/390/320 px (panel completo, bloque con error, diálogo de la guía), h1 único,
// sin desborde, objetivos >= 24 px, «Persona n» sin nombre ni correo, tema del sistema (claro/oscuro), orden del DOM, dos columnas desde 1000 px,
// diálogo de la guía (foco al abrir, Tab/Shift+Tab atrapado, Esc cierra, foco devuelto), «Reintentar» con foco y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-309 && npx vite preview --outDir dist-309 --host 127.0.0.1 --port 4309 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4309 node scripts/es309-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4309'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const iso = days => new Date(Date.now() - days * 86400000).toISOString()
const shaped = (n, over = {}) => ({ id: 100 + n, name: `Persona Sintética ${n}`, ordinal: n, email: `canario-correo-${n}@example.test`, active: true, createdAt: iso(60), sharing: true, lastMood: { checkin_mood: 4, checkout_mood: 5, date: iso(n % 4) }, moodTrend: 'up', avgRating: 4.5, totalSessions: 6, sessionsThisWeek: n % 2, trend: 'improving', ...over })
const hidden = n => ({ id: 200 + n, name: null, ordinal: n, email: '', active: true, createdAt: iso(40), sharing: false, lastMood: null, moodTrend: 'neutral', avgRating: null, totalSessions: 0, sessionsThisWeek: 0, trend: null })
const people = [shaped(1), shaped(2, { trend: 'declining', avgRating: 3 }), shaped(3, { trend: 'stable' }), shaped(4, { active: false }), hidden(5), hidden(6)]
const upcoming = [{ id: 50, patientId: 101, scheduledAt: new Date(Date.now() - 600000).toISOString(), duration: 50, status: 'scheduled', patientName: 'Persona Sintética 1', phase: 'in_progress' }, { id: 51, patientId: 205, scheduledAt: new Date(Date.now() + 3 * 3600000).toISOString(), duration: 50, status: 'scheduled', patientName: null, patientOrdinal: 5 }]
const alerts = { inactivePatients: [{ userId: 102, name: 'Persona Sintética 2', daysSinceLastSession: 9 }, { userId: 103, name: 'Persona Sintética 3', daysSinceLastSession: null }], notableProgress: [{ userId: 101, name: 'Persona Sintética 1', improved: true }] }
const docs = [{ id: 1, documentType: 'titulo', documentName: 'titulo-sintetico.pdf', status: 'pending', reviewNote: null, submittedAt: iso(3), reviewedAt: null }, { id: 2, documentType: 'certificado', documentName: 'cert-sintetico.pdf', status: 'rejected', reviewNote: 'Ilegible, sube otra copia.', reviewedAt: iso(1), submittedAt: iso(4) }]
const guide = { hasPrompt: true, content: 'Guía sintética activa: acompañar sin diagnosticar.', active: { id: 1, version: 2, approved_by: 'x', approved_at: iso(10) }, pending: null, rejected: { id: 3, version: 3, rejected_by: 'x', rejection_note: 'Quita las promesas.', rejected_at: iso(1) } }

async function open(browser, { width, lang, scheme, fail = {}, cpu = 1, delay = 0, onlyOnce = true }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []; const calls = {}
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; window.__src = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__src.push(e.value.toFixed(3) + ' ' + (e.sources || []).map(x => (x.node && (x.node.className || x.node.nodeName)) + ' ' + Math.round(x.previousRect.y) + '>' + Math.round(x.currentRect.y) + ' h' + Math.round(x.previousRect.height) + '>' + Math.round(x.currentRect.height)).join(' ; ')) } }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname; calls[p] = (calls[p] ?? 0) + 1
    if (delay) await new Promise(r => setTimeout(r, delay))
    if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } })
    if (fail[p] && (!onlyOnce || calls[p] <= fail[p])) return route.fulfill({ status: 500, json: { error: 'x' } })
    const body = { '/api/therapist/pacientes': people, '/api/sessions/therapist/upcoming': upcoming, '/api/therapist/alerts': alerts, '/api/therapist/prompt': guide, '/api/therapist/validation/status': docs }[p]
    return route.fulfill({ json: body === undefined ? [] : body })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/therapist/dashboard', { waitUntil: 'networkidle' })
  await page.locator('h1').first().waitFor({ timeout: 8000 })
  await page.getByRole('heading', { level: 2 }).first().waitFor()
  return { ctx, page, errors, calls }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=switch]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.cg-sr,.tp-sr') && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20)))

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page, errors } = await open(browser, { width, lang, scheme })
    report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
    report(await page.locator('main section.cg-card').count() === 6, `seis bloques en tarjetas cg-card (${tag})`)
    const order = await page.locator('main section h2').allInnerTexts()
    report(order.length === 6 && /Resumen|Summary/i.test(order[0]) && /guía|guide/i.test(order[5]), `orden del DOM: Resumen → … → Guía (${tag})`, order.join(' | '))
    report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea dentro del panel (${tag})`)
    const body = await page.locator('main').innerText()
    report(!/canario-correo/.test(body) && body.includes(lang === 'es' ? 'Persona 5' : 'Person 5') && body.includes(lang === 'es' ? 'Persona 6' : 'Person 6'), `«Persona n» sin nombre ni correo (${tag})`)
    report((body.match(lang === 'es' ? /Sin acceso a sus datos/g : /No access to their data/g) ?? []).length === 2, `dos personas sin acceso (${tag})`)
    const dark = await page.evaluate(() => getComputedStyle(document.querySelector('.cg')).colorScheme)
    report(dark === scheme, `tema del sistema aplicado: color-scheme ${dark} (${tag})`)
    report(await page.evaluate(() => !document.querySelector('main.elv-theme')), `sin elv-theme en el área principal (${tag})`)
    const cols = await page.evaluate(() => { const two = document.querySelector('.tp-two'); return two ? getComputedStyle(two).gridTemplateColumns.split(' ').length : 0 })
    report(cols === (width >= 1000 ? 2 : 1), `${cols} columna(s) (${tag})`)
    const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal (${tag})`, String(ov))
    const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
    const v = await axe(page); report(v.length === 0, `axe en 0 (${tag})`, v.join(','))
    report(errors.length === 0, `sin errores de página (${tag})`, errors.join('; '))
    await ctx.close()
  }

  // Un bloque que falla: error con ⚠, «Reintentar» con foco y los demás intactos; axe y desborde en claro/oscuro y 320 px
  for (const scheme of ['light', 'dark']) for (const width of [1360, 320]) {
    const tag = `${width}px ${scheme}`
    const { ctx, page } = await open(browser, { width, lang: 'es', scheme, fail: { '/api/therapist/alerts': 1 } })
    const alertBlock = page.locator('section[aria-labelledby="panel-alerts-title"]')
    report(await alertBlock.locator('[role=alert] .cg-error').count() === 1, `el bloque Avisos muestra su error (${tag})`)
    report(await page.locator('section[aria-labelledby="panel-people-title"] .cg-item').count() === 6, `los demás bloques siguen con datos (${tag})`)
    report((await axe(page)).length === 0, `axe en 0 con un bloque en error (${tag})`)
    if (width === 1360 && scheme === 'light') {
      await alertBlock.getByRole('button', { name: /Reintentar/ }).click()
      await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'panel-alerts-title')
      report(true, 'tras «Reintentar» con éxito el foco va al título del bloque')
    }
    report(await overflow(page) <= 0, `sin desborde con un bloque en error (${tag})`)
    await ctx.close()
  }

  // Diálogo de la guía
  for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) {
    const tag = `${width}px ${lang} ${scheme}`
    const { ctx, page } = await open(browser, { width, lang, scheme })
    const opener = page.getByRole('button', { name: lang === 'es' ? /Proponer nueva versión|Proponer/ : /Propose/ }).first()
    await opener.click()
    const dlg = page.locator('dialog.cg-dialog[open]'); await dlg.waitFor()
    report(await page.evaluate(() => document.activeElement && document.activeElement.id === 'panel-guide-text'), `el foco entra al cuadro de texto (${tag})`)
    report((await axe(page)).length === 0, `axe en 0 con el diálogo abierto (${tag})`)
    report(await overflow(page) <= 0 && await dlg.evaluate(e => e.scrollWidth <= e.clientWidth + 1), `diálogo sin desborde (${tag})`)
    if (width === 1360 && lang === 'es' && scheme === 'light') {
      const inside = () => page.evaluate(() => !!document.activeElement?.closest('dialog[open]'))
      for (let i = 0; i < 8; i++) await page.keyboard.press('Tab'); report(await inside(), 'Tab queda dentro del diálogo')
      for (let i = 0; i < 8; i++) await page.keyboard.press('Shift+Tab'); report(await inside(), 'Shift+Tab queda dentro del diálogo')
      await page.fill('#panel-guide-text', 'corto'); await page.getByRole('button', { name: /Enviar/ }).click()
      report(await dlg.locator('#panel-guide-error p').count() === 1 && (await dlg.locator('#panel-guide-error').innerText()).length > 0, 'texto corto: aviso con ⚠ dentro del diálogo, nada se envía')
      await page.keyboard.press('Escape'); await page.locator('dialog.cg-dialog[open]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
      report(await page.locator('dialog.cg-dialog[open]').count() === 0, 'Esc cierra el diálogo')
      report(await opener.evaluate(e => e === document.activeElement), 'el foco vuelve al botón que lo abrió')
      await opener.click(); report((await page.inputValue('#panel-guide-text')) === 'corto', 'lo escrito se conserva al cerrar y reabrir')
    }
    await ctx.close()
  }

  // CLS a 390 px con CPU×4 (claro y oscuro, ES)
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4, delay: 80 })
    await page.waitForTimeout(1200)
    const cls = await page.evaluate(() => window.__cls); report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px con CPU×4 (${scheme})`, cls > 0.1 ? JSON.stringify(await page.evaluate(() => window.__src)) : '')
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
