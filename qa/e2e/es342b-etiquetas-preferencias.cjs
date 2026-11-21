// [QA-Claude] ES-342 · PR #394 · el grupo «Preferencias» del menú tiene sus etiquetas visibles «Idioma» y «Tema» (ES) / «Language» y «Theme» (EN). BASE=<url> node qa/e2e/es342b-etiquetas-preferencias.cjs
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const { createRequire } = require('module')
const API = 'http://localhost:8191'; const api = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})) }
;(async () => {
  const email = `es342e-${Date.now().toString(36)}@example.invalid`; const password = 'Sintetica-Clave-2026!'; await api('POST', '/api/register', { name: 'Persona Sintetica E', email, password, acceptedTerms: true, termsVersion: '2026-11-v2' })
  const { Client } = createRequire('C:/Users/Usuario/Documents/qa-pr-253/backend/package.json')('pg'); const c = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/q394' }); await c.connect(); await c.query(`UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1`, [email]); await c.end()
  const { token } = await api('POST', '/api/login', { email, password }); const BR = await chromium.launch(); let bad = 0
  for (const [lang, want] of [['es', ['Idioma', 'Tema']], ['en', ['Language', 'Theme']]]) {
    const ctx = await BR.newContext({ viewport: { width: 390, height: 800 } }); const p = await ctx.newPage(); await p.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', l) }, [token, lang])
    await p.goto(process.env.BASE + '/app/chat', { waitUntil: 'networkidle' }); await p.locator('.chat-menu-btn').first().click(); await p.locator('dialog[open] .chat-menu-prefs').waitFor()
    const labels = await p.$$eval('dialog[open] .chat-menu-pref > span', (s) => s.map((e) => e.innerText.trim())); const ok = want.every((w, i) => labels[i] === w); if (!ok) bad++; console.log((ok ? 'OK   ' : 'FALLA ') + `etiquetas de Preferencias (${lang}): ${JSON.stringify(labels)}`); await ctx.close() }
  await BR.close(); process.exit(bad ? 1 : 0)
})()
