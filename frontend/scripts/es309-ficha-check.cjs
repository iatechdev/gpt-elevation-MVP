// ES-309 (PR 2): ficha de la persona (/therapist/patient/:id) en Cartografía, en navegador real (Chromium) con API simulada y datos sintéticos. No corre en CI; evidencia del PR.
// Mide: axe WCAG 2.x A/AA (wcag2a/2aa/21a/21aa/22aa) = 0 en claro y oscuro, ES/EN × 1360/390/320 px (ficha completa, sin autorización, error de carga, editor de notas, conflicto,
// agendar con error por campo, resumen con IA y límite), h1 único, sin estilos en línea ni elv-theme, sin desborde, objetivos >= 24 px, tema del sistema, diálogos (foco al abrir,
// Tab/Shift+Tab atrapado, Esc cierra y devuelve el foco, lo escrito se conserva), error por campo con foco, límite de IA con aria-disabled y CLS <= 0,1 a 390 px con CPU×4.
// Uso: npx vite build --outDir dist-309f && npx vite preview --outDir dist-309f --host 127.0.0.1 --port 4310 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4310 node scripts/es309-ficha-check.cjs
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const BASE = process.env.BASE || 'http://127.0.0.1:4310'
let failures = 0
const report = (ok, label, extra = '') => { if (!ok) failures++; console.log((ok ? 'OK    ' : 'FALLA ') + label + (extra ? ' ' + extra : '')) }
const iso = days => new Date(Date.now() - days * 86400000).toISOString()
const day = days => iso(days).slice(0, 10)
const T = {
  es: { newNote: 'Nueva nota', save: 'Guardar', cancel: 'Cancelar', schedule: 'Agendar sesión', confirm: 'Agendar', generate: 'Generar resumen', back: /Panel/ },
  en: { newNote: 'New note', save: 'Save', cancel: 'Cancel', schedule: 'Schedule session', confirm: 'Schedule', generate: 'Generate summary', back: /Dashboard|Panel/ },
}
const moodLogs = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, date: day(i + 1), checkin_mood: 2 + (i % 3), checkout_mood: 3 + (i % 3) }))
const ratings = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, date: day(i + 2), rating: i === 3 ? null : 4 }))
const notes = [
  { id: 1, type: 'session_note', content: 'Nota sintética de la sesión.\nSegunda línea con un texto largo sin espacios: ' + 'x'.repeat(120), sessionDate: day(2), createdAt: iso(2), updatedAt: iso(2) },
  { id: 2, type: 'goal', content: 'Objetivo sintético.', sessionDate: day(5), createdAt: iso(5), updatedAt: iso(5) },
]
const history = { patient: { id: 7, name: 'Persona Sintética', email: 'sintetica@example.test', createdAt: iso(60) }, moodLogs, ratings, notes }

// opts: { historyStatus, historyBody, put: status+json, schedule: status+json, summary: status+json, delay }
async function open(browser, { width, lang, scheme, cpu = 1, opts = {} }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage(); const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  await page.addInitScript(l => {
    localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'therapist'); localStorage.setItem('elv_lang', l)
    window.__cls = 0; window.__src = []; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__src.push(e.value.toFixed(3) + ' ' + (e.sources || []).map(x => (x.node && (x.node.className || x.node.nodeName)) + ' ' + Math.round(x.previousRect.y) + '>' + Math.round(x.currentRect.y) + ' h' + Math.round(x.previousRect.height) + '>' + Math.round(x.currentRect.height)).join(' ; ')) } }).observe({ type: 'layout-shift', buffered: true })
  }, lang)
  await page.route('**/api/**', async route => {
    const p = new URL(route.request().url()).pathname; const method = route.request().method()
    if (opts.delay) await new Promise(r => setTimeout(r, opts.delay))
    if (p === '/api/session') return route.fulfill({ json: { role: 'therapist', onboardingCompleted: true } })
    if (p === '/api/therapist/pacientes/7/historia') return opts.historyStatus ? route.fulfill({ status: opts.historyStatus, json: opts.historyBody ?? {} }) : route.fulfill({ json: history })
    if (p === '/api/therapist/pacientes/7/notas' && method === 'POST') return route.fulfill({ status: opts.post?.status ?? 201, json: opts.post?.json ?? {} })
    if (p === '/api/therapist/pacientes/7/resumen-ia') return route.fulfill({ status: opts.summary?.status ?? 200, json: opts.summary?.json ?? { summary: 'Resumen sintético de lectura automática.', generatedAt: iso(0), basedOn: { sessions: 6 } } })
    if (p === '/api/sessions/therapist' && method === 'POST') return route.fulfill({ status: opts.schedule?.status ?? 201, json: opts.schedule?.json ?? {} })
    return route.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + '/therapist/patient/7', { waitUntil: 'networkidle' })
  await page.locator('main').first().waitFor({ timeout: 8000 })
  return { ctx, page, errors }
}
const axe = async page => { await page.evaluate(axeSource); return page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => v.id + ':' + v.nodes.length + ' ' + v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))) }
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const smallTargets = page => page.evaluate(() => [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.cg-sr,.tp-sr') && (r.width < 24 || r.height < 24) }).map(e => e.tagName + ':' + (e.textContent || '').trim().slice(0, 20)))
const inDialog = page => page.evaluate(() => !!document.activeElement?.closest('dialog.cg-dialog[open]'))

;(async () => {
  const browser = await chromium.launch()
  for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) {
    const tag = `${width}px ${lang} ${scheme}`; const c = T[lang]
    // 1) Ficha completa
    {
      const { ctx, page, errors } = await open(browser, { width, lang, scheme })
      await page.getByRole('heading', { level: 1 }).waitFor()
      report(await page.locator('h1').count() === 1, `h1 único (${tag})`)
      const h2 = await page.locator('main h2').allInnerTexts()
      report(h2.length === 4, `cuatro bloques con título (resumen IA, notas, historial, valoraciones) (${tag})`, h2.join(' | '))
      report(await page.locator('main section.cg-card').count() === 5, `cinco tarjetas cg-card (cifras + 4) (${tag})`)
      report(await page.evaluate(() => document.querySelectorAll('main [style]').length) === 0, `sin estilos en línea (${tag})`)
      report(await page.evaluate(() => !document.querySelector('main.elv-theme')), `sin elv-theme (${tag})`)
      const dark = await page.evaluate(() => getComputedStyle(document.querySelector('.cg')).colorScheme)
      report(dark === scheme, `tema del sistema aplicado: color-scheme ${dark} (${tag})`)
      const body = await page.locator('main').innerText()
      report(/persona sintética/i.test(body) && body.includes('sintetica@example.test'), `nombre y correo de quien comparte (${tag})`)
      const ov = await overflow(page); report(ov <= 0, `sin desborde horizontal (${tag})`, String(ov))
      const small = await smallTargets(page); report(small.length === 0, `objetivos >= 24 px (${tag})`, small.join(','))
      const v = await axe(page); report(v.length === 0, `axe en 0, ficha completa (${tag})`, v.join(','))
      report(errors.length === 0, `sin errores de página (${tag})`, errors.join('; '))
      await ctx.close()
    }
    // 2) Sin autorización (403 consent_required) y error de carga
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, opts: { historyStatus: 403, historyBody: { code: 'consent_required' } } })
      await page.locator('.cg-banner').waitFor()
      const body = await page.locator('main').innerText()
      report(!/Persona Sintética|sintetica@example/.test(body), `sin autorización: ni nombre ni correo (${tag})`)
      report(await page.getByRole('button', { name: /←/ }).count() === 1, `sin autorización: «volver» (${tag})`)
      const v = await axe(page); report(v.length === 0, `axe en 0, sin autorización (${tag})`, v.join(','))
      await ctx.close()
      const e = await open(browser, { width, lang, scheme, opts: { historyStatus: 500 } })
      await e.page.locator('.cg-banner--error').waitFor()
      report(await e.page.locator('.cg-banner--error[role=alert]').count() === 1, `error de carga como Banner con role=alert (${tag})`)
      const ve = await axe(e.page); report(ve.length === 0, `axe en 0, error de carga (${tag})`, ve.join(','))
      await e.ctx.close()
    }
    // 3) Editor de notas: foco, Tab atrapado, Esc, conservar lo escrito, contador y conflicto
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, opts: { post: { status: 409, json: { code: 'note_changed', current: { content: 'Versión vigente sintética', type: 'observation', sessionDate: day(1), updatedAt: iso(0) } } } } })
      const opener = page.getByRole('button', { name: c.newNote, exact: true })
      await opener.click()
      const dlg = page.locator('dialog.cg-dialog[open]')
      report(await dlg.count() === 1 && await inDialog(page), `editor: el foco entra al diálogo (${tag})`)
      await page.locator('#fu-text').fill('Texto que no se debe perder')
      // Tab: da la vuelta dentro del diálogo
      let stays = true
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!await inDialog(page)) stays = false }
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Shift+Tab'); if (!await inDialog(page)) stays = false }
      report(stays, `editor: Tab y Shift+Tab quedan dentro (${tag})`)
      await page.keyboard.press('Escape')
      report(await page.locator('dialog.cg-dialog[open]').count() === 0, `editor: Esc cierra (${tag})`)
      report(await page.evaluate(() => document.activeElement?.textContent?.trim()) === c.newNote, `editor: el foco vuelve a «${c.newNote}» (${tag})`)
      await opener.click()
      report(await page.locator('#fu-text').inputValue() === 'Texto que no se debe perder', `editor: lo escrito se conserva al reabrir (${tag})`)
      // contador pasado del límite (axe con el error del contador)
      await page.locator('#fu-text').fill('y'.repeat(10001))
      report(await page.locator('#fu-counter.pf-over').count() === 1, `editor: contador en rojo con ⚠ por encima de 10.000 (${tag})`)
      const vOver = await axe(page); report(vOver.length === 0, `axe en 0, editor con el contador excedido (${tag})`, vOver.join(','))
      await page.locator('#fu-text').fill('Texto con conflicto')
      await page.getByRole('button', { name: c.save, exact: true }).click()
      await page.locator('#fu-problem p').waitFor()
      report(await page.locator('#fu-problem[role=alert] p').count() === 1, `editor: aviso de conflicto en role=alert (${tag})`)
      await page.locator('dialog.cg-dialog[open] button[aria-expanded]').click()
      report(await page.locator('dialog.cg-dialog .tp-quote').innerText().then(t => t.includes('Versión vigente sintética')), `editor: «ver la versión actual» muestra la versión vigente (${tag})`)
      const vc = await axe(page); report(vc.length === 0, `axe en 0, editor con conflicto abierto (${tag})`, vc.join(','))
      const ovd = await overflow(page); report(ovd <= 0, `editor: sin desborde (${tag})`, String(ovd))
      await ctx.close()
    }
    // 4) Agendar: error por campo con foco, Esc y retorno del foco
    {
      const { ctx, page } = await open(browser, { width, lang, scheme, opts: { schedule: { status: 409, json: { code: 'session_conflict', field: 'scheduledAt' } } } })
      const opener = page.getByRole('button', { name: c.schedule, exact: true })
      await opener.click()
      report(await inDialog(page), `agendar: el foco entra al diálogo (${tag})`)
      await page.getByRole('button', { name: c.confirm, exact: true }).click()
      await page.locator('#fu-sch-when-error').filter({ hasText: /\S/ }).waitFor()
      report(await page.evaluate(() => document.activeElement?.id) === 'fu-sch-when', `agendar: el foco va al campo con error (${tag})`)
      report(await page.locator('#fu-sch-when[aria-invalid=true]').count() === 1 && await page.locator('#fu-sch-when').getAttribute('aria-describedby') === 'fu-sch-when-error', `agendar: aria-invalid y aria-describedby (${tag})`)
      const vs = await axe(page); report(vs.length === 0, `axe en 0, agendar con error por campo (${tag})`, vs.join(','))
      await page.keyboard.press('Escape')
      report(await page.locator('dialog.cg-dialog[open]').count() === 0 && await page.evaluate(() => document.activeElement?.textContent?.trim()) === c.schedule, `agendar: Esc cierra y el foco vuelve al botón (${tag})`)
      await ctx.close()
    }
    // 5) Resumen con IA: resultado y límite (aria-disabled, sin reintentar)
    {
      const ok = await open(browser, { width, lang, scheme })
      await ok.page.getByRole('button', { name: c.generate, exact: true }).click()
      await ok.page.locator('.pf-summary').waitFor()
      const vok = await axe(ok.page); report(vok.length === 0, `axe en 0, resumen con IA generado (${tag})`, vok.join(','))
      await ok.ctx.close()
      const lim = await open(browser, { width, lang, scheme, opts: { summary: { status: 429, json: { code: 'ai_budget_exhausted', resetsAt: new Date(Date.now() + 36e5).toISOString() } } } })
      await lim.page.getByRole('button', { name: c.generate, exact: true }).click()
      await lim.page.locator('#fu-ai-problem').waitFor()
      report(await lim.page.locator('#fu-ai-button[aria-disabled=true]').count() === 1 && await lim.page.locator('#fu-ai-retry').count() === 0, `resumen: límite con aria-disabled y sin «Reintentar» (${tag})`)
      const vl = await axe(lim.page); report(vl.length === 0, `axe en 0, límite de IA (${tag})`, vl.join(','))
      await lim.ctx.close()
    }
  }
  // CLS a 390 px con CPU×4 (carga lenta)
  for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, { width: 390, lang: 'es', scheme, cpu: 4, opts: { delay: 150 } })
    const cls = await page.evaluate(() => window.__cls)
    report(cls <= 0.1, `CLS ${cls.toFixed(3)} <= 0,1 a 390 px, CPU×4 (${scheme})`, cls > 0.1 ? (await page.evaluate(() => window.__src)).join(' || ') : '')
    await ctx.close()
  }
  await browser.close()
  console.log(failures ? `\n${failures} FALLA(S)` : '\nTODO OK')
  process.exit(failures ? 1 : 0)
})()
