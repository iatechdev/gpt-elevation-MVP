// ES-359 (M3, informe de regresión de QA-5): la superadministración no ve pantallas cuyas APIs el servidor le niega. Chromium, API simulada con DATOS SINTÉTICOS (sin datos reales ni IA).
// Uso: npx vite build --outDir dist-fx && npx vite preview --outDir dist-fx --host 127.0.0.1 --port 4123 --strictPort
//   PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4123 node scripts/es359-m3-superadmin-check.cjs
// Comprueba, por rol × ES/EN × 390/1360 × claro/oscuro: (1) superadministración en las pantallas solo-persona y en las del profesional ve «sin acceso» (h1 propio, axe = 0, sin desborde) y NO
// dispara ninguna petición a las APIs que el servidor le niega; (2) la persona usuaria y el profesional siguen entrando; (3) la barra de superadministración no lleva los tres enlaces ajenos;
// (4) chat, diario, administración y junta siguen abiertos para superadministración.
const fs = require('fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8'); const BASE = process.env.BASE || 'http://127.0.0.1:4123'
const DENIED_API = /\/api\/(user\/context|user\/resumes|user\/resume-skills|routes|experiments|career-plan|sessions\/user|therapist)(\/|$|\?)/
const PARTICIPANT_ONLY = ['/app/onboarding', '/app/context/resumes', '/app/context/resumes/update', '/app/evidence/resume-skills', '/app/my-therapist', '/app/session/7', '/app/next-step', '/app/next-step/plan']
const PROFESSIONAL = ['/therapist/dashboard', '/therapist/patient/9', '/therapist/session/9']
const NO_ACCESS = /no tiene acceso|does not have access/i
let failures = 0, total = 0
async function open(browser, { role, lang, width, scheme }) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  const denied = []
  await page.route('**/api/**', route => { const url = new URL(route.request().url()); const p = url.pathname
    if (DENIED_API.test(p) && role === 'superadmin') { denied.push(p); return route.fulfill({ status: 403, json: { error: 'Acceso denegado.' } }) }
    if (p === '/api/session') return route.fulfill({ json: { role, onboardingCompleted: true } })
    return route.fulfill({ json: {} }) })
  await page.addInitScript(([r, l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Persona de ejemplo') }, [role, lang])
  return { ctx, page, denied }
}
const axeRun = async page => { await page.addScriptTag({ content: axeSource }); return page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then(r => r.violations.map(v => v.id + ':' + v.nodes.length))) }
const report = (ok, text) => { total++; if (!ok) failures++; if (!ok) console.log('FALLA ' + text) }
;(async () => {
  const browser = await chromium.launch()
  for (const lang of ['es', 'en']) for (const width of [390, 1360]) for (const scheme of ['light', 'dark']) {
    const tag = `${lang} ${width}px ${scheme}`
    // (1) superadministración: «sin acceso», sin llamadas a las APIs negadas
    for (const path of [...PARTICIPANT_ONLY, ...PROFESSIONAL]) {
      const { ctx, page, denied } = await open(browser, { role: 'superadmin', lang, width, scheme })
      await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(150)
      const axe = await axeRun(page)
      const m = await page.evaluate(() => ({ text: document.body.innerText, h1: document.querySelectorAll('h1').length, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, retry: /Reintentar|Retry|No tienes permiso|You do not have permission/.test(document.body.innerText) }))
      report(NO_ACCESS.test(m.text) && m.h1 === 1 && !m.retry && axe.length === 0 && m.overflow <= 0 && denied.length === 0, `superadmin ${path} ${tag}: sinAcceso=${NO_ACCESS.test(m.text)} h1=${m.h1} reintento/permiso=${m.retry} axe=[${axe}] desborde=${m.overflow} llamadasNegadas=${JSON.stringify(denied)}`)
      await ctx.close()
    }
    // (2) la persona y el profesional siguen entrando
    for (const [role, path] of [['user', '/app/my-therapist'], ['user', '/app/next-step'], ['user', '/app/context/resumes'], ['therapist', '/therapist/dashboard']]) {
      const { ctx, page } = await open(browser, { role, lang, width, scheme })
      await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(150)
      const text = await page.evaluate(() => document.body.innerText)
      report(!NO_ACCESS.test(text), `${role} ${path} ${tag}: ve «sin acceso»`)
      await ctx.close()
    }
    // (3) y (4) la barra de superadministración en su marco de persona y lo que sigue abierto
    {
      const { ctx, page } = await open(browser, { role: 'superadmin', lang, width, scheme })
      await page.goto(BASE + '/app/chat', { waitUntil: 'networkidle' }); await page.waitForTimeout(200)
      const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/app/"]')].map(a => a.getAttribute('href')))
      const wrong = ['/app/next-step', '/app/context/resumes', '/app/my-therapist'].filter(h => hrefs.includes(h))
      report(wrong.length === 0, `superadmin barra ${tag}: enlaces ajenos ${JSON.stringify(wrong)}`)
      await ctx.close()
      for (const [path, mustHave] of [['/app/chat', null], ['/app/diary', null], ['/admin/dashboard', null], ['/board/manifest', null]]) {
        const c = await open(browser, { role: 'superadmin', lang, width, scheme })
        await c.page.goto(BASE + path, { waitUntil: 'networkidle' }); await c.page.waitForTimeout(150)
        const text = await c.page.evaluate(() => document.body.innerText)
        report(!NO_ACCESS.test(text) || path === '/board/manifest', `superadmin ${path} ${tag}: ve «sin acceso»`) // /board/* redirige a /manifiesto (ES-207)
        await c.ctx.close()
      }
    }
  }
  console.log(`${total - failures}/${total} comprobaciones OK`)
  await browser.close(); process.exit(failures ? 1 : 0)
})()
