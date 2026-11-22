// ES-329 (Inicio): /app/dashboard dentro del marco de persona. Chromium, API simulada con DATOS SINTÉTICOS (sin datos reales ni IA).
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4113 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4113 node scripts/es329-inicio-check.cjs
// Por escenario (vacío, con datos, sesión en curso, diálogo de recomendación, despedida al salir) × ES/EN × 390/1360/320 × claro/oscuro:
// axe wcag2a/2aa/21a/21aa/22aa = 0, UN solo h1 «Mi panel», un solo «Saltar al contenido», sin desborde horizontal, sin emojis ni estrellas, sin estilos en línea con color.
// Con CLS=1: CLS a 390 px con CPU ×4 (10 corridas por escenario) y largo del texto útil (innerText de <main>) para comparar con main.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4113'
const day = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0] }
const now = Date.now()
const SCENES = {
  vacio: { upcoming: null, therapist: null, logs: [], recs: [], plan: null, limits: null },
  datos: { upcoming: { id: 1, scheduledAt: new Date(now + 86400000 * 2).toISOString(), duration: 45, meetingUrl: null, status: 'scheduled', therapistName: 'Ana (ejemplo)', therapistEmail: 'x@example.com' }, therapist: { id: 7 },
    logs: [0, 1, 2, 4, 5].map((n, i) => ({ id: i + 1, date: day(n), checkin_mood: 2 + (i % 3), checkout_mood: 3 + (i % 2) })),
    recs: [['habit', 'Texto de ejemplo uno'], ['reflection', 'Texto de ejemplo dos'], ['mindfulness', 'Texto de ejemplo tres'], ['resource', 'Texto de ejemplo cuatro']].map(([category, content], i) => ({ id: i + 1, category, content, generatedAt: new Date().toISOString() })),
    plan: { id: 2, slug: 'plus', name_es: 'Plus (ejemplo)', name_en: 'Plus (example)', price: 19, currency: 'USD', period: 'month', features_es: ['Característica uno (ejemplo)', 'Característica dos (ejemplo)', 'Tres', 'Cuatro'], features_en: ['Feature one (example)', 'Feature two (example)', 'Three', 'Four'], isHighlighted: true }, limits: { chatMessagesDay: 100, sessionsMonth: -1, canAccessProgress: true, canMatchTherapist: true } },
}
SCENES.vivo = { ...SCENES.datos, upcoming: { ...SCENES.datos.upcoming, status: 'in_progress', scheduledAt: new Date(now - 600000).toISOString() }, plan: null, limits: { chatMessagesDay: 10, sessionsMonth: 0, canAccessProgress: true, canMatchTherapist: true } }
const STAGES = ['vacio', 'datos', 'vivo', 'recomendacion', 'despedida']
let failures = 0, total = 0
async function setup(browser, { lang, width, scheme, scene, checkedIn }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const d = SCENES[scene]
  await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
    if (p === '/api/session') return route.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/user/progress') return route.fulfill({ json: { stats: null, moodLogs: d.logs, ratings: [], recommendations: [] } })
    if (p === '/api/sessions/user/upcoming') return route.fulfill({ json: { session: d.upcoming } })
    if (p === '/api/sessions/user/my-therapist') return route.fulfill({ json: { therapist: d.therapist } })
    if (p === '/api/recommendations') return route.fulfill({ json: d.recs })
    if (p === '/api/user/plan/me') return route.fulfill({ json: { plan: d.plan, limits: d.limits } })
    return route.fulfill({ json: {} }) })
  await page.addInitScript(([l, c]) => { localStorage.setItem('elevation_token', 'h.' + btoa(JSON.stringify({ id: 7 })) + '.s'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); if (c) localStorage.setItem('elevation_checkin', JSON.stringify({ id: '7', day: new Date().toISOString().slice(0, 10) })) }, [lang, checkedIn])
  return { ctx, page }
}
async function axeRun(page) {
  await page.addScriptTag({ content: axeSource })
  return page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length)))
}
const EMOJI = /[\u{1F300}-\u{1FAFF}★☆♡↗◇]/u
;(async () => {
  const browser = await chromium.launch()
  for (const stage of process.env.ONLY_CLS === '1' ? [] : STAGES) for (const lang of ['es', 'en']) for (const width of [390, 1360, 320]) for (const scheme of ['light', 'dark']) {
    const scene = stage === 'recomendacion' || stage === 'despedida' ? 'datos' : stage
    const { ctx, page } = await setup(browser, { lang, width, scheme, scene, checkedIn: stage !== 'vacio' })
    total++
    await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(250)
    if (stage === 'recomendacion') await page.getByRole('button', { name: /Explorar|Explore/ }).first().click()
    if (stage === 'despedida') { await page.getByRole('button', { name: /^(Salir|Sign out)/ }).first().click().catch(async () => { await page.getByRole('button', { name: /Menú de usuario|User menu/ }).click(); await page.getByRole('button', { name: /^(Salir|Sign out)/ }).click() }) }
    await page.waitForTimeout(200)
    const axe = await axeRun(page)
    const m = await page.evaluate(() => ({ h1: [...document.querySelectorAll('h1')].map(h => h.textContent), skips: [...document.querySelectorAll('a')].filter(a => /^#/.test(a.getAttribute('href') || '') && /Saltar|Skip/.test(a.textContent)).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, inlineColor: [...document.querySelectorAll('main [style]')].filter(e => /color|background/.test(e.getAttribute('style') || '')).length,
      dialogOpen: !!document.querySelector('dialog[open]'), oldHeader: document.querySelectorAll('.space-dashboard-header, .elv-btn').length }))
    const wantDialog = stage === 'recomendacion' || stage === 'despedida'
    const ok = axe.length === 0 && m.h1.length === 1 && /Mi panel|My dashboard/.test(m.h1[0]) && m.skips === 1 && m.overflow <= 0 && !EMOJI.test(m.text) && m.inlineColor === 0 && m.oldHeader === 0 && m.dialogOpen === wantDialog
    if (!ok) failures++
    if (!ok || (lang === 'es' && width === 390 && scheme === 'light')) console.log((ok ? 'OK    ' : 'FALLA ') + `${stage} ${lang} ${width}px ${scheme}: axe=[${axe}] h1=${JSON.stringify(m.h1)} saltar=${m.skips} desborde=${m.overflow} emoji=${EMOJI.test(m.text)} colorEnLínea=${m.inlineColor} cabeceraVieja=${m.oldHeader} diálogo=${m.dialogOpen}/${wantDialog}`)
    await ctx.close()
  }
  console.log(`${total - failures}/${total} combinaciones OK`)
  if (process.env.CLS === '1') {
    for (const scene of ['vacio', 'datos']) {
      const values = [], sizes = []
      for (let i = 0; i < 10; i++) {
        const { ctx, page } = await setup(browser, { lang: 'es', width: 390, scheme: 'light', scene, checkedIn: scene !== 'vacio' })
        const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) })
        await page.goto(BASE + '/app/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
        values.push(await page.evaluate(() => window.__cls)); sizes.push(await page.evaluate(() => document.querySelector('main').innerText.length)); await ctx.close()
      }
      values.sort((a, b) => a - b); sizes.sort((a, b) => a - b)
      console.log(`CLS 390px CPU×4 ${scene}: mediana=${values[5].toFixed(4)} máx=${values[9].toFixed(4)} | texto útil de <main> (caracteres) mediana=${sizes[5]}`)
      if (values[9] > 0.1) failures++
    }
  }
  await browser.close(); process.exit(failures ? 1 : 0)
})()
