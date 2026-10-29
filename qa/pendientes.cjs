// QA-Claude-2 — pruebas del plan que quedaron pendientes en la primera pasada: sesión/token, puente (Compass) con backend REAL,
// P-4 (render con 40 capacidades) y catálogo vacío. Requiere backend (:8090) con catálogo publicado y vite (:5173) sobre el head #93.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const reg = async (tag) => { const email = `qa-${tag}-${Date.now()}${Math.floor(Math.random() * 1e3)}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return email }
const login = async (email, pw = PASS) => call('POST', '/api/login', null, { email, password: pw })
;(async () => {
  // A) Sesión y token
  const e1 = await reg('ses'); const t1 = (await login(e1)).j.token
  ck('S sesión: GET /api/session con token válido', (await call('GET', '/api/session', t1)).s === 200)
  const lo = await call('POST', '/api/logout', t1); ck('S logout: 200', lo.s === 200, `HTTP ${lo.s}`)
  const after = await call('GET', '/api/skill-map', t1); ck('S logout: el mismo token queda revocado (401/403)', [401, 403].includes(after.s), `HTTP ${after.s}`)
  const t2 = (await login(e1)).j.token; const t3 = (await login(e1)).j.token
  ck('S dos sesiones activas', (await call('GET', '/api/skill-map', t2)).s === 200 && (await call('GET', '/api/skill-map', t3)).s === 200)
  const la = await call('POST', '/api/logout-all', t2); ck('S logout-all: 200', la.s === 200, `HTTP ${la.s}`)
  ck('S logout-all revoca TODAS las sesiones', [401, 403].includes((await call('GET', '/api/skill-map', t2)).s) && [401, 403].includes((await call('GET', '/api/skill-map', t3)).s))
  ck('S tras logout-all se puede iniciar sesión de nuevo', (await login(e1)).s === 200)
  // B) Puente (Compass) con backend real
  const eA = await reg('brA'), eB = await reg('brB'); const A = (await login(eA)).j.token, B = (await login(eB)).j.token
  await call('PUT', '/api/consents/professional_bridge', A, { status: 'granted' }); await call('PUT', '/api/consents/professional_bridge', B, { status: 'granted' })
  const fields = [{ key: 'motivations', text: 'Me motiva aprender algo nuevo cada semana.' }, { key: 'constraints', text: 'Solo puedo dedicar las tardes.' }]
  const pv = await call('POST', '/api/career-context/preview', A, { fields }); ck('F puente: vista previa devuelve token y no guarda', pv.s === 200 && !!pv.j.token && (await call('GET', '/api/career-context', A)).j.active === null, `HTTP ${pv.s}`)
  const cf = await call('POST', '/api/career-context/confirm', A, { fields, token: pv.j.token, requestId: 'br-' + Date.now() }); ck('F puente: confirmar crea la versión', [200, 201].includes(cf.s), `HTTP ${cf.s}`)
  ck('S puente: B no ve el contexto de A', (await call('GET', '/api/career-context', B)).j.active === null)
  const bad = await call('POST', '/api/career-context/confirm', B, { fields, token: pv.j.token, requestId: 'br2-' + Date.now() }); ck('S puente: B no puede confirmar con el token de A', bad.s >= 400 && bad.s < 500, `HTTP ${bad.s}`)
  for (const [n, f] of [['clave desconocida', [{ key: 'diary', text: 'x' }]], ['XSS', [{ key: 'motivations', text: '<script>alert(1)</script>' }]], ['texto de 5000 caracteres', [{ key: 'motivations', text: 'z'.repeat(5000) }]], ['campo extra', [{ key: 'motivations', text: 'x', origin: 'chat', extra: 1 }]]]) { const r = await call('POST', '/api/career-context/preview', A, { fields: f }); ck(`S puente entrada «${n}»: sin 5xx`, r.s < 500, `HTTP ${r.s} ${r.j?.code || ''}`) }
  const b = await chromium.launch()
  const open = async (tk, route, { lang = 'es', w = 1280, scheme = 'light' } = {}) => { const c = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [tk, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); p.dialogs = []; p.on('dialog', d => { p.dialogs.push(d.message()); d.accept() }); await p.goto(UI + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); return p }
  let p = await open(A, '/app/compass'); const txt = await p.locator('body').innerText()
  ck('F Compass real: muestra el contexto activo del servidor', /aprender algo nuevo/.test(txt) && /Retirar contexto/.test(txt), '')
  ck('S Compass real: no muestra el contexto de B ni datos ajenos', !/qa-brB/.test(txt))
  await p.screenshot({ path: path.join(OUT, 'compass-real-1280.png'), fullPage: true })
  const wd = p.getByRole('button', { name: /Retirar contexto/ }).first(); await wd.click(); await p.waitForTimeout(600)
  const dlg = await p.locator('dialog[open]').count(); console.log('   al retirar: diálogo =', dlg, '| confirm() =', JSON.stringify(p.dialogs))
  if (dlg) { console.log('   foco inicial:', JSON.stringify(await p.evaluate(() => document.activeElement.textContent.trim()))); await p.keyboard.press('Escape'); await p.waitForTimeout(300); ck('F Compass: Esc cancela y NO retira', (await call('GET', '/api/career-context', A)).j.active !== null); await wd.click(); await p.waitForTimeout(400); await p.locator('dialog[open] button').filter({ hasText: /^(Sí|Retirar|Confirm)/ }).last().click().catch(() => {}) ; await p.waitForTimeout(1200) }
  const act = (await call('GET', '/api/career-context', A)).j.active; ck('F Compass real: retirar contexto lo revoca en el servidor', act === null || act.status === 'revoked' || act.revokedAt, JSON.stringify(act && { s: act.status }))
  ck('F Compass real: B sigue sin contexto y su permiso intacto', (await call('GET', '/api/career-context', B)).j.active === null)
  ck('consola Compass', p.errs.filter(e => !/403|Failed to load resource/.test(e)).length === 0, p.errs.join('|')); await p.context().close()
  for (const [lang, w, scheme] of [['en', 375, 'light'], ['es', 320, 'light'], ['es', 1280, 'dark']]) { const pe = await open(A, '/app/compass', { lang, w, scheme }); const m = await pe.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); ck(`F Compass ${lang}/${w}px/${scheme}: sin desborde`, m.sw <= m.iw, `${m.sw}/${m.iw}`); await pe.screenshot({ path: path.join(OUT, `compass-${lang}-${w}-${scheme}.png`), fullPage: true }); await pe.context().close() }
  // C) P-4: 40 capacidades en el navegador
  const mkS = (k, n) => ({ skillKey: k, type: 'domain', labels: { es: n, en: n }, territories: ['dir', 'con', 'com', 'ing', 'inn'].filter((_, i) => (k.length + i) % 3 === 0), rubric: { levels: { 1: { es: 'a', en: 'a' }, 2: { es: 'b', en: 'b' }, 3: { es: 'c', en: 'c' }, 4: { es: 'd', en: 'd' } }, source: 's', verifiedAt: '2026-10-01T00:00:00Z' }, state: 'no_evidence', self: null, review: null })
  const many = Array.from({ length: 40 }, (_, i) => mkS('skill_' + String(i).padStart(2, '0'), 'Capacidad ' + (i + 1)))
  for (const w of [1280, 375]) { const pp = await open(A, '/app/dashboard', { w }); await pp.route('**/api/skill-map', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ catalogVersion: 5, skills: many }) }))
    const t0 = Date.now(); await pp.goto(UI + '/app/skill-map', { waitUntil: 'domcontentloaded' }); await pp.waitForSelector(w >= 1024 ? 'svg .skill-map-chip' : '.skill-map-pick', { timeout: 15000 }); const ms = Date.now() - t0
    const n = await pp.locator(w >= 1024 ? 'svg .skill-map-chip' : '.skill-map-pick').count(); const m = await pp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
    ck(`P-4 ${w}px: 40 capacidades visibles en ≤1,5 s (sin servidor lento)`, n >= 40 && ms <= 1500, `${n} nodos/tarjetas en ${ms} ms`); ck(`P-4 ${w}px: sin desborde`, m.sw <= m.iw)
    if (w === 1280) { const ov = await pp.evaluate(() => { const cs = [...document.querySelectorAll('svg .skill-map-chip rect')].map(r => r.getBoundingClientRect()); let o = 0; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = cs[i], c = cs[j]; if (a.left < c.right && a.right > c.left && a.top < c.bottom && a.bottom > c.top) o++ } return o }); ck('P-4 1280px: 0 solapes visuales entre nodos (medido en el DOM)', ov === 0, `${ov} solapes`); await pp.screenshot({ path: path.join(OUT, 'map-40-1280.png'), fullPage: true }) }
    ck(`P-4 ${w}px consola`, pp.errs.filter(e => !/403|Failed to load resource/.test(e)).length === 0, pp.errs.join('|')); await pp.context().close() }
  // D) catálogo vacío: la guía no debe aparecer (#90) y el mapa da un aviso propio
  p = await open(A, '/app/dashboard'); await p.route('**/api/skill-map', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ catalogVersion: 1, skills: [] }) })); await p.goto(UI + '/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(700)
  ck('F catálogo vacío en navegador: sin guía de 3 pasos y con aviso propio', await p.locator('section.map-guide').count() === 0 && /no hay|vacío|todavía|disponible/i.test(await p.locator('body').innerText()), JSON.stringify((await p.locator('[role=status]').allInnerTexts()).slice(-1))); await p.context().close()
  // bloqueo por intentos fallidos (al final: limita el login por IP y afectaría a las demás pruebas)
  const e2 = await reg('lock'); const codes = []; for (let i = 0; i < 14; i++) codes.push((await login(e2, 'incorrecta-' + i)).s)
  console.log('   códigos tras 14 intentos fallidos:', codes.join(','))
  ck('S intentos fallidos: se limita con 429 (rate limit) en algún momento', codes.includes(429), codes.filter(c => c === 429).length + ' respuestas 429')
  ck('S intentos fallidos: nunca 5xx', codes.every(c => c < 500))
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
