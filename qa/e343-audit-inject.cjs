// QA-Claude-2 — COPIA de frontend/scripts/es290-291-audit.cjs (PR #343, c83fc9cb) con 3 cambios para el control positivo: INJECT=1 agrega un aria-label que no contiene el texto visible y una región con scroll sin tabindex; ONLYROUTES=<rutas> acota las rutas; DATAMOD=<ruta> carga los datos sintéticos del PR. El núcleo de detección (axe, reglas, STRICT) es el del PR sin tocar.
// ES-290 / ES-291: auditoría con axe de label-content-name-mismatch (WCAG 2.5.3, regla experimental) y scrollable-region-focusable (WCAG 2.1.1)
// en los marcos de persona, profesional, administración y público a 320/390/1360 px, ES/EN. API simulada, DATOS SINTÉTICOS.
// Uso: ES290_URL=http://127.0.0.1:4342 PLAYWRIGHT_MODULE=<playwright> AXE_PATH=<axe.min.js> [STRICT=1] node scripts/es290-291-audit.cjs
const fs = require('node:fs')
// Con DATA=1 las API simuladas devuelven datos sintéticos (scripts/es290-291-data.cjs) para medir las pantallas con contenido. /board redirige a /manifiesto (App.tsx).
const DATA = !!process.env.DATA
const dataFor = require(process.env.DATAMOD)
const ROUTES_ALL = {
  user: ['/app/diary/1', '/app/evidence/new', '/app/diary/new', '/app/dashboard', '/app/chat', '/app/progress', '/app/diary', '/app/my-therapist', '/app/skill-map', '/app/evidence', '/app/data', '/app/plan', '/app/exercises', '/app/bridge', '/app/checkin', '/app/feedback', '/app/context/resumes'],
  therapist: ['/therapist/dashboard', '/facilitation'],
  admin: ['/admin/dashboard', '/admin/prompts', '/admin/content', '/admin/users', '/admin/metrics', '/admin/manifest', '/admin/route-catalog', '/admin/skill-catalog', '/admin/pilot-metrics'],
  public: ['/', '/login', '/pricing', '/manifiesto', '/privacidad', '/terminos', '/profesionales', '/forgot-password'],
}
const ROUTES = process.env.ONLYROUTES ? Object.fromEntries(Object.entries(ROUTES_ALL).map(([k, v]) => [k, v.filter(p => process.env.ONLYROUTES.split(',').includes(p))]).filter(([, v]) => v.length)) : ROUTES_ALL
;(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES290_URL; const browser = await chromium.launch(); const axeSource = fs.readFileSync(process.env.AXE_PATH, 'utf8')
  const found = new Map(); let n = 0
  for (const [role, paths] of Object.entries(ROUTES)) for (const lang of ['es', 'en']) for (const w of [320, 390, 1360]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } }); const page = await ctx.newPage()
    await page.addInitScript(([r, l]) => { if (r !== 'public') { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', r === 'user' ? 'user' : r === 'admin' ? 'admin' : 'therapist') } localStorage.setItem('elv_lang', l) }, [role, lang])
    await page.route('**/api/**', route => { const p = new URL(route.request().url()).pathname
      const body = p === '/api/session' ? { role: role === 'user' ? 'user' : role === 'admin' ? 'admin' : 'therapist', onboardingCompleted: true } : p === '/api/ai/usage' ? { configured: true, limit: 100, used: 37, resetsAt: '2026-12-01T00:00:00Z' } : (DATA && dataFor(p)) || []
      return route.fulfill({ json: body }) })
    for (const path of paths) {
      try { await page.goto(base + path, { waitUntil: 'networkidle', timeout: 15000 }) } catch { /* sigue */ }
      await page.waitForTimeout(500); if (process.env.INJECT) await page.evaluate(() => { const b = document.createElement('button'); b.setAttribute('aria-label', 'Cerrar sesión definitiva'); b.textContent = 'Salir'; document.body.appendChild(b); const d = document.createElement('div'); d.style.cssText = 'overflow:auto;height:40px;width:100px'; const i = document.createElement('div'); i.style.height = '400px'; i.textContent = 'región con scroll inyectada'; d.appendChild(i); document.body.appendChild(d) }); await page.addScriptTag({ content: axeSource })
      const res = await page.evaluate(async () => (await window.axe.run(document, { rules: { 'label-content-name-mismatch': { enabled: true }, 'scrollable-region-focusable': { enabled: true } }, runOnly: { type: 'rule', values: ['label-content-name-mismatch', 'scrollable-region-focusable'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(x => x.target.join(' ') + ' :: ' + x.html.slice(0, 110)) })))
      const finalPath = new URL(page.url()).pathname
      for (const v of res) for (const nd of v.nodes) { const k = `${v.id} | ${role} ${path}${finalPath !== path ? ' -> ' + finalPath : ''} | ${nd}`; if (!found.has(k)) found.set(k, new Set()); found.get(k).add(`${lang}/${w}`) }
      n++
    }
    await ctx.close()
  }
  for (const [k, v] of found) console.log(`${k}  [${[...v].join(', ')}]`)
  console.log(`\n${n} páginas medidas${DATA ? ' (con datos sintéticos)' : ''}; ${found.size} hallazgos`); await browser.close(); if (process.env.STRICT && found.size) process.exit(1)
})().catch(e => { console.error(e.message); process.exit(1) })
