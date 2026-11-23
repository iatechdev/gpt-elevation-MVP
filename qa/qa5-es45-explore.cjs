// [QA-Claude-5] ES-45 Fase 0: exploración del recorrido (qué muestra cada pantalla) con backend real local + IA simulada con espía. Datos sintéticos.
// Uso: PLAYWRIGHT_MODULE=... BASE=http://127.0.0.1:4410 API=http://127.0.0.1:8410 LANG_=es PATHS=/app/onboarding,/app/chat node qa/qa5-es45-explore.cjs
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const BASE = process.env.BASE, API = process.env.API, lang = process.env.LANG_ || 'es'; const OUT = (process.env.QA_TOOLS || '.') + '/qa5/out/es45'; fs.mkdirSync(OUT, { recursive: true })
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
;(async () => {
  const email = `qa5-x-${crypto.randomBytes(3).toString('hex')}@example.test`
  await call(null, 'POST', '/api/register', { name: 'Persona Explora', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' })
  const l = await call(null, 'POST', '/api/login', { email, password: pass }); const tk = process.env.TOKEN_ || l.body.token
  const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' }); const page = await ctx.newPage()
  await page.addInitScript(([t, n, lg]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', n); localStorage.setItem('elv_lang', lg) }, [tk, 'Persona Explora', lang])
  for (const p of (process.env.PATHS || '/app/onboarding').split(',')) {
    await page.goto(BASE + p); await page.waitForTimeout(2500)
    const d = await page.evaluate(() => ({ url: location.pathname, h: [...document.querySelectorAll('h1,h2')].map((e) => e.textContent.trim().slice(0, 70)), b: [...document.querySelectorAll('main button')].map((e) => (e.disabled ? '(x)' : '') + e.textContent.trim().slice(0, 50)).filter(Boolean), a: [...document.querySelectorAll('main a')].map((e) => e.textContent.trim().slice(0, 40) + '→' + e.getAttribute('href')).slice(0, 20), inp: [...document.querySelectorAll('main input,main textarea,main select')].map((e) => e.tagName + ':' + (e.type || '') + ':' + (e.id || e.name || '')).slice(0, 20), t: document.querySelector('main')?.textContent.replace(/\s+/g, ' ').slice(0, 500) }))
    console.log('=====', p, '→', JSON.stringify(d, null, 1)); await page.screenshot({ path: `${OUT}/explore-${p.replace(/\//g, '_')}.png` })
  }
  console.log('TOKEN_USER', email); await br.close()
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
