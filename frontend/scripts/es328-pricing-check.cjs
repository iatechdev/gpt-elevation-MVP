// ES-328 (PR 1): /pricing en Cartografía. Chromium, API simulada (page.route), planes sintéticos. Evidencia; no corre en CI.
// Mide en cada escena × ES/EN × claro/oscuro × 1360/390/320: axe wcag2a/2aa/21a/21aa/22aa + label-content-name-mismatch activada, sin desborde horizontal, un h1, un main, selector de idioma del marco
// (sin aria-label), foco visible; y CLS ≤ 0,1 a 390 px con CPU×4 en la escena lista. Escenas: visitante, plan elegido (?plan=), con sesión, solicitud en revisión, cargando, error, vacío, plan retirado.
// Uso: PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> BASE=http://127.0.0.1:4320 node scripts/es328-pricing-check.cjs
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE || 'http://127.0.0.1:4320'
const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
const PLAN = (id, o) => ({ id, slug: `plan-${id}`, name_es: `Plan ${id} (sintético)`, name_en: `Plan ${id} (synthetic)`, description_es: 'Descripción sintética del plan.', description_en: 'Synthetic plan description.', features_es: ['Función uno', 'Función dos'], features_en: ['Feature one', 'Feature two'], price: '0.00', currency: 'USD', period: 'month', order: id, isHighlighted: false, ...o })
const PLANS = [PLAN(1, {}), PLAN(2, { price: '12.00' }), PLAN(3, { price: '29.00', isHighlighted: true }), PLAN(4, { price: '590.00', period: 'year' })]
const SCENES = {
  visitor: { url: '/pricing', plans: PLANS },
  chosen: { url: '/pricing?plan=3', plans: PLANS },
  retired: { url: '/pricing?plan=99', plans: PLANS },
  session: { url: '/pricing', plans: PLANS, token: true, request: null },
  pending: { url: '/pricing', plans: PLANS, token: true, request: { id: 5, planId: 2, status: 'pending' } },
  loading: { url: '/pricing', plans: PLANS, delay: 8000 },
  error: { url: '/pricing', plansStatus: 500 },
  empty: { url: '/pricing', plans: [] },
  landing: { url: '/#planes', plans: PLANS },
}
let failures = 0
const log = (ok, msg) => { if (!ok) failures++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${msg}`) }
async function open(browser, name, { width, lang, scheme, cpu = 1 }) {
  const scene = SCENES[name]
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.addInitScript(([l, token]) => { localStorage.setItem('elv_lang', l); if (token) { localStorage.setItem('elevation_token', 'synthetic-browser-token'); localStorage.setItem('elevation_role', 'user') }
    window.__cls = 0; new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }, [lang, !!scene.token])
  await page.route('**/api/**', async r => {
    const p = new URL(r.request().url()).pathname
    if (p === '/api/plans') { if (scene.delay) await new Promise(res => setTimeout(res, scene.delay)); return scene.plansStatus ? r.fulfill({ status: scene.plansStatus, json: {} }) : r.fulfill({ json: scene.plans }) }
    if (p === '/api/session') return r.fulfill({ json: { role: 'user', onboardingCompleted: true } })
    if (p === '/api/plan-requests/me') return r.fulfill({ json: { request: scene.request ?? null } })
    if (p === '/api/landing-content') return r.fulfill({ json: {} })
    return r.fulfill({ json: [] })
  })
  if (cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + scene.url, { waitUntil: name === 'loading' ? 'domcontentloaded' : 'networkidle' })
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(name === 'loading' ? 800 : 600)
  return { ctx, page }
}
;(async () => {
  const browser = await chromium.launch()
  for (const name of Object.keys(SCENES)) for (const scheme of ['light', 'dark']) for (const lang of ['es', 'en']) for (const width of [1360, 390, 320]) {
    const tag = `${name} ${scheme} ${lang} ${width}`
    const { ctx, page } = await open(browser, name, { width, lang, scheme })
    await page.addScriptTag({ content: axeSource })
    const axe = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, rules: { 'label-content-name-mismatch': { enabled: true } } }))
    const mismatch = await page.evaluate(() => axe.run(document, { runOnly: { type: 'rule', values: ['label-content-name-mismatch'] } }))
    const bad = [...axe.violations, ...mismatch.violations].map(v => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.join(' ')}`)
    const m = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length,
      langLabels: [...document.querySelectorAll('.cg-lang button, [role=group] button')].filter(b => /^(ES|EN)$/.test(b.textContent.trim()) && b.hasAttribute('aria-label')).length,
      legacy: (document.querySelector('#planes') ?? document).querySelectorAll('.landing-plan, .landing-plans, [class*="elv-"], .landing-header').length + document.querySelectorAll('.landing-header').length, plans: document.querySelectorAll('.pp-plan').length }))
    const expectPlans = ['visitor', 'chosen', 'retired', 'session', 'pending', 'landing'].includes(name) ? 4 : 0
    const ok = bad.length === 0 && m.scrollW <= m.innerW && m.h1 === 1 && m.main === 1 && m.langLabels === 0 && m.plans === expectPlans && m.legacy === 0
    log(ok, `${tag}${ok ? '' : ` axe[${bad.join(' | ')}] scroll ${m.scrollW}/${m.innerW} h1 ${m.h1} main ${m.main} langAria ${m.langLabels} plans ${m.plans}/${expectPlans} legacy ${m.legacy}`}`)
    await ctx.close()
  }
  for (const name of ['visitor', 'session']) for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await open(browser, name, { width: 390, lang: 'es', scheme, cpu: 4 }); await page.waitForTimeout(1200)
    const cls = await page.evaluate(() => window.__cls); log(cls <= 0.1, `CLS ${name} ${scheme} 390 CPU×4 = ${cls.toFixed(3)}`); await ctx.close()
  }
  await browser.close(); console.log(failures ? `\n${failures} FALLAS` : '\nTODO OK'); process.exit(failures ? 1 : 0)
})()
