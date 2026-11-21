// [QA-Claude] ES-342 · PR #394 · M8: la Parte A (#337) no regresa. Alto del hilo (.chat-scroll) como % del viewport, y estilo del botón Enviar vacío, PR (5273) frente a main (5274), con la persona sintética de es342b-menu-barra.cjs.
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/Usuario/tools/pw-browsers'
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright'); const { createRequire } = require('module')
const API = 'http://localhost:8191'; const api = async (m, p, b) => { const r = await fetch(API + p, { method: m, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})) }
;(async () => {
  const email = `es342a-${Date.now().toString(36)}@example.invalid`; const password = 'Sintetica-Clave-2026!'; await api('POST', '/api/register', { name: 'Persona Sintetica A', email, password, acceptedTerms: true, termsVersion: '2026-11-v2' })
  const { Client } = createRequire('C:/Users/Usuario/Documents/qa-pr-253/backend/package.json')('pg'); const c = new Client({ connectionString: 'postgres://elevation:elevation_local@127.0.0.1:54459/q394' }); await c.connect(); await c.query(`UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1`, [email]); await c.end()
  const { token } = await api('POST', '/api/login', { email, password }); const BR = await chromium.launch(); const rows = []
  for (const [w, h] of [[390, 844], [320, 568], [1024, 768], [1360, 900], [1280, 720], [900, 800]]) for (const [tag, base] of [['main', 'http://localhost:5274'], ['pr', 'http://localhost:5273']]) for (const scheme of ['light', 'dark']) {
    const ctx = await BR.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); const p = await ctx.newPage(); await p.addInitScript(([t, s]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elv_lang', 'es'); localStorage.setItem('elv_theme', s) }, [token, scheme])
    await p.goto(base + '/app/chat', { waitUntil: 'networkidle' }); await p.locator('.chat-scroll').waitFor(); await new Promise((r) => setTimeout(r, 900))
    const m = await p.evaluate(() => { const t = document.querySelector('.chat-scroll').getBoundingClientRect(); const send = [...document.querySelectorAll('button')].find((b) => /^enviar$/i.test(b.innerText.trim())); const cs = send && getComputedStyle(send); return { thread: Math.round(100 * t.height / innerHeight), send: cs && [cs.backgroundColor, cs.color, cs.opacity].join(' / '), over: document.documentElement.scrollWidth - innerWidth } })
    rows.push({ w, h, tag, scheme, ...m }); await ctx.close() }
  await BR.close(); const keyOf = (r) => `${r.w}×${r.h} ${r.scheme}`; let diffs = 0
  for (const r of rows.filter((x) => x.tag === 'pr')) { const m = rows.find((x) => x.tag === 'main' && keyOf(x) === keyOf(r)); const d = r.thread - m.thread; if (r.send !== m.send || r.over > 0) diffs++; console.log(`${keyOf(r).padEnd(18)} hilo main ${m.thread}% → PR ${r.thread}% (Δ ${d}) | Enviar main [${m.send}] PR [${r.send}] | desborde PR ${r.over}`) }
  console.log('filas con Enviar distinto o desborde:', diffs)
})()
