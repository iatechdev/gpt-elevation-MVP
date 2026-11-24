// [QA-Claude-5] PR #415 (ES-364): marcador de altura (.ac-hold) mientras «verificando». Backend real (token alterado = 401 real; válido = 200 real; «no disponible» = 503 simulado; lento = respuesta retenida). Datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4402 API=http://127.0.0.1:8402 DATABASE_URL=... node qa/qa5-415-ui.cjs
const fs = require('fs'); const crypto = require('crypto'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const { Client } = require('pg')
const BASE = process.env.BASE, API = process.env.API; let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
let VALID, EXPIRED
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const open = async (br, { width = 390, lang = 'es', scheme = 'light', token, state = 'real', hold = 0 }) => {
  const ctx = await br.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce', colorScheme: scheme }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([tk, l]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elevation_name', 'Persona Sintetica') } localStorage.setItem('elv_lang', l) }, [token, lang])
  await page.route('**/api/session', async (route) => { if (hold) await sleep(hold); if (state === 'unavailable') return route.fulfill({ status: 503, json: {} }); if (state === 'network') return route.abort('failed'); return route.continue() })
  return { ctx, page, errs }
}
const geo = (page) => page.evaluate(() => { const h = document.querySelector('.ac-hold'); const f = document.querySelector('.ac-form'); const sec = document.querySelector('.ac-secondary'); const foot = document.querySelector('footer, .cg-footer')
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height) } }
  return { hold: r(h), holdAria: h && h.getAttribute('aria-hidden'), holdFocusable: h ? h.querySelectorAll('a,button,input,[tabindex]').length : 0, form: r(f), secondary: r(sec), footer: r(foot), status: [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => e.textContent.trim().slice(0, 50)), docH: document.documentElement.scrollHeight, ox: document.documentElement.scrollWidth > innerWidth + 1 } })
const axe = (page) => page.addScriptTag({ content: axeSource }).then(() => page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' '))))))
;(async () => {
  const email = `qa5-${crypto.randomBytes(4).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name: 'Persona Sintetica', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' })
  VALID = (await call(null, 'POST', '/api/login', { email, password: pass })).body.token; EXPIRED = VALID.slice(0, -4) + 'AAAA'
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); await c.query('UPDATE "Users" SET "onboardingCompleted"=true WHERE email=$1', [email]); await c.end()
  const br = await chromium.launch()
  // 1) sin sesión guardada: no hay marcador, ni en login ni en registro
  for (const path of ['/login', '/login?mode=register']) { const { ctx, page } = await open(br, { token: null }); await page.goto(BASE + path); await page.waitForSelector('.ac-form'); const g = await geo(page); check(`sin sesión guardada ${path}: no hay marcador y el formulario se ve`, g.hold === null && !!g.form, JSON.stringify(g)); await ctx.close() }
  // 2) verificación LENTA: el marcador existe, es aria-hidden, sin foco, con el aviso «verificando» visible; al llegar el 401 desaparece, el formulario ocupa su sitio y no queda hueco
  for (const [path, kind] of [['/login', 'login'], ['/login?mode=register', 'registro']]) for (const width of [1360, 768, 390, 320]) for (const lang of ['es', 'en']) {
    const { ctx, page, errs } = await open(br, { width, lang, token: EXPIRED, hold: 2500 }); await page.goto(BASE + path); await page.waitForSelector('.ac-hold', { timeout: 8000 }); await page.waitForTimeout(300)
    const g1 = await geo(page); await page.waitForSelector('.ac-form', { timeout: 15000 }); await page.waitForTimeout(500); const g2 = await geo(page)
    check(`[${kind} ${lang} ${width}px] verificando: marcador aria-hidden sin elementos enfocables y aviso visible; luego el marcador desaparece y el formulario aparece`, g1.holdAria === 'true' && g1.holdFocusable === 0 && g1.status.length >= 1 && g2.hold === null && !!g2.form && !g2.ox && errs.length === 0, JSON.stringify({ g1: g1.hold, aria: g1.holdAria, status: g1.status, g2form: g2.form, ox: g2.ox, errs }))
    const content = (g2.secondary ? g2.secondary.top + g2.secondary.h : (g2.form.top + g2.form.h)) - g2.form.top
    const diff = g1.hold.h - content
    info(`[${kind} ${lang} ${width}px] alto del marcador ${g1.hold.h}px vs contenido real (formulario + enlaces) ${content}px → diferencia ${diff >= 0 ? '+' : ''}${diff}px (positivo = el pie sube ${diff}px al terminar)`)
    await ctx.close() }
  // 3) fallo: «no disponible» (503) y sin red: el marcador desaparece, aparece el aviso con «Reintentar» y el formulario; nada vacío
  for (const state of ['unavailable', 'network']) for (const path of ['/login', '/login?mode=register']) { const { ctx, page, errs } = await open(br, { token: EXPIRED, state, hold: 800 }); await page.goto(BASE + path); await page.waitForSelector('.ac-form', { timeout: 15000 }); await page.waitForTimeout(400); const g = await geo(page)
    check(`verificación con fallo (${state}) ${path}: sin marcador, con aviso (alert) y formulario visible`, g.hold === null && !!g.form && g.status.length >= 1 && errs.length === 0, JSON.stringify(g)); await ctx.close() }
  // 4) sesión válida: login redirige; registro muestra «sesión abierta» (sin marcador)
  { const { ctx, page } = await open(br, { token: VALID }); await page.goto(BASE + '/login'); await page.waitForTimeout(3000); check('sesión válida en /login: redirige fuera de /login (el marcador no se queda)', !new URL(page.url()).pathname.startsWith('/login'), page.url()); await ctx.close() }
  { const { ctx, page } = await open(br, { token: VALID }); await page.goto(BASE + '/login?mode=register'); await page.waitForTimeout(3000); const g = await geo(page); check('sesión válida en el registro: sin marcador y con el aviso de sesión abierta', g.hold === null && g.status.length >= 1, JSON.stringify(g)); await ctx.close() }
  // 5) token de invitación inválido (página aparte, sin cambios en el PR): no tiene marcador y muestra el error
  { const { ctx, page } = await open(br, { token: null }); await page.goto(BASE + '/accept-invitation#token=' + 'x'.repeat(43)); await page.waitForTimeout(2500); const t = await page.evaluate(() => ({ hold: !!document.querySelector('.ac-hold'), text: document.body.innerText.slice(0, 200) })); check('/accept-invitation con token inválido: sin marcador y responde (error o formulario) sin quedarse vacía', !t.hold && t.text.length > 20, JSON.stringify(t)); await ctx.close() }
  // 6) axe en cada estado × claro/oscuro × es/en × 1360/390/320, en /login y /login?mode=register
  for (const path of ['/login', '/login?mode=register']) for (const [state, token, hold] of [['verificando', EXPIRED, 6000], ['vencida', EXPIRED, 0], ['sin sesión', null, 0]]) for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) for (const lang of ['es', 'en']) {
    const { ctx, page } = await open(br, { width, lang, scheme, token, hold }); await page.goto(BASE + path); if (state === 'verificando') await page.waitForSelector('.ac-hold'); else { await page.waitForSelector('.ac-form'); await page.waitForTimeout(600) } const v = await axe(page); const g = await geo(page)
    check(`axe = 0 y sin desborde · ${path} ${state} · ${scheme} ${width}px ${lang}`, v.length === 0 && !g.ox, JSON.stringify({ v, ox: g.ox })); await ctx.close() }
  console.log(`UI #415: ${ok} correctas, ${bad} fallos`); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
