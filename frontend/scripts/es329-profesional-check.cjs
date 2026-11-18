// ES-329 (Mi profesional): /app/my-therapist dentro del marco de persona. Chromium, API simulada con DATOS SINTÉTICOS (sin datos reales ni IA).
// Uso: npx vite build --outDir dist && npx vite preview --outDir dist --host 127.0.0.1 --port 4113 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4113 node scripts/es329-profesional-check.cjs
// Escenarios (sin profesional, con profesional, error de carga, diálogo de desvincular) × ES/EN × 390/1360/320 × claro/oscuro:
// axe wcag2a/2aa/21a/21aa/22aa = 0, UN solo h1 «Mi profesional», un solo «Saltar al contenido», sin desborde, sin emojis, 0 colores en línea, sin cabecera propia.
// Además: flujo del permiso (PUT con el estado deseado) y de desvinculación (DELETE). Con CLS=1: CLS a 390 px con CPU ×4 (10 corridas) y texto útil de <main>.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4113'
const now = Date.now()
const THERAPIST = { id: 7, name: 'Ana (ejemplo)', email: 'ana@example.com', profile: { specialties: 'Especialidad de ejemplo', approach: 'Enfoque de ejemplo', languages: 'Español, Inglés', bio: 'Texto de ejemplo' } }
const WITH = { therapist: THERAPIST,
  upcomingSessions: [{ id: 1, scheduledAt: new Date(now + 86400000 * 3).toISOString(), duration: 45, meetingUrl: 'https://example.com/m', status: 'scheduled' }, { id: 2, scheduledAt: new Date(now + 300000).toISOString(), duration: 45, meetingUrl: 'https://example.com/n', status: 'scheduled' }],
  pastSessions: [{ id: 3, scheduledAt: new Date(now - 86400000 * 7).toISOString(), patientMoodAfter: 4, status: 'completed' }, { id: 4, scheduledAt: new Date(now - 86400000 * 14).toISOString(), patientMoodAfter: null, status: 'completed' }] }
const NONE = { therapist: null, upcomingSessions: [], pastSessions: [] }
const STAGES = ['sin', 'con', 'error', 'desvincular']
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡]/u
let failures = 0, total = 0
async function setup(browser, { lang, width, scheme, stage }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const calls = []
  let granted = true
  await page.route('**/api/**', route => { const r = route.request(), p = new URL(r.url()).pathname; if (r.method() !== 'GET') calls.push(r.method() + ' ' + p + ' ' + (r.postData() || ''))
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/sessions/user/my-therapist') {
      if (r.method() === 'DELETE') return route.fulfill({ json: { ok: true } })
      return stage === 'error' ? route.fulfill({ status: 500, json: { error: 'x' } }) : route.fulfill({ json: stage === 'sin' ? NONE : WITH }) }
    if (p === '/api/consents') return route.fulfill({ json: { consents: [{ purpose: 'therapist_sharing', applicable: true, status: granted ? 'granted' : 'revoked' }] } })
    if (p === '/api/consents/therapist_sharing') { granted = JSON.parse(r.postData() || '{}').status === 'granted'; return route.fulfill({ json: { ok: true, changed: true } }) }
    return route.fulfill({ json: {} }) })
  await page.addInitScript(l => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, lang)
  return { ctx, page, calls }
}
;(async () => {
  const browser = await chromium.launch()
  for (const stage of process.env.ONLY_CLS === '1' ? [] : STAGES) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await setup(browser, { lang, width, scheme, stage }); total++
    await page.goto(BASE + '/app/my-therapist', { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
    if (stage === 'desvincular') await page.getByRole('button', { name: /Dejar de compartir|Stop sharing/ }).click()
    await page.waitForTimeout(200)
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
    const m = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.textContent), skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, inlineColor: [...document.querySelectorAll('main [style]')].filter(e => /color|background/.test(e.getAttribute('style') || '')).length,
      dialogOpen: !!document.querySelector('dialog[open]'), oldHeader: document.querySelectorAll('.th-a11y').length }))
    const ok = axe.length === 0 && m.h1.length === 1 && /Mi profesional|My professional/.test(m.h1[0]) && m.skips === 1 && m.overflow <= 0 && !EMOJI.test(m.text) && m.inlineColor === 0 && m.oldHeader === 0 && m.dialogOpen === (stage === 'desvincular')
    if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${stage} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${JSON.stringify(m.h1)} saltar=${m.skips} desborde=${m.overflow} emoji=${EMOJI.test(m.text)} colorEnLínea=${m.inlineColor} diálogo=${m.dialogOpen}`)
    await ctx.close()
  }
  if (process.env.ONLY_CLS !== '1') {
    // Flujos: permiso (interruptor) y desvinculación
    const { ctx, page, calls } = await setup(browser, { lang: 'es', width: 390, scheme: 'light', stage: 'con' })
    await page.goto(BASE + '/app/my-therapist', { waitUntil: 'networkidle' })
    const sw = page.getByRole('switch'); const before = await sw.getAttribute('aria-checked'); await sw.click(); await page.waitForTimeout(400)
    const after = await sw.getAttribute('aria-checked')
    await page.getByRole('button', { name: /Dejar de compartir/ }).click(); await page.locator('dialog[open]').getByRole('button', { name: /Sí, desvincularme/ }).click(); await page.waitForTimeout(400)
    console.log(`Flujo permiso: aria-checked ${before} → ${after}; llamadas: ${calls.join(' | ')}`)
    const flowOk = before === 'true' && after === 'false' && calls.some(c => /PUT \/api\/consents\/therapist_sharing .*"revoked"/.test(c)) && calls.some(c => /DELETE \/api\/sessions\/user\/my-therapist/.test(c))
    if (!flowOk) failures++
    await ctx.close()
    console.log(`${total - failures + (flowOk ? 0 : 1)}/${total} combinaciones OK · flujo ${flowOk ? 'OK' : 'FALLA'}`)
  }
  if (process.env.CLS === '1') {
    for (const stage of ['sin', 'con']) {
      const values = [], sizes = []
      for (let i = 0; i < 10; i++) {
        const { ctx, page } = await setup(browser, { lang: 'es', width: 390, scheme: 'light', stage })
        const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
        await page.goto(BASE + '/app/my-therapist', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
        values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close()
      }
      values.sort((a, b) => a - b); sizes.sort((a, b) => a - b)
      console.log(`CLS 390px CPU×4 ${stage}: mediana=${values[5].toFixed(4)} máx=${values[9].toFixed(4)} | texto útil de <main> (caracteres) mediana=${sizes[5]}`)
      if (values[9] > 0.1) failures++
    }
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
