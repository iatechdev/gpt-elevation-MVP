// [QA-Claude-3] PR #428 (ES-359 M3): la superadministración no ve pantallas cuyas APIs el servidor le niega. Backend REAL + build estático (PR o main como control) + Chromium. Datos sintéticos, 0 IA.
// Uso: bash qa/run.sh e428-superadmin.cjs p428 <db>     (control: ... m428 <db>; allí se esperan fallas de M3)
const L = require('./lib3.cjs'); const { ck, info, mk, open, sleep, axeRun } = L
const NOACC = /no tiene acceso a esta pantalla|does not have access to this screen/i
const PART = ['/app/onboarding', '/app/context/resumes', '/app/context/resumes/update', '/app/evidence/resume-skills', '/app/my-therapist', '/app/session/123', '/app/next-step']
const OPEN_FOR_SUPER = ['/app/dashboard', '/app/chat', '/app/data', '/app/plan', '/app/professional-reviews', '/app/progress', '/app/skill-map']
const FORBID = ['/app/next-step', '/app/context/resumes', '/app/my-therapist'] // enlaces que el menú de superadmin ya no debe traer
const links = p => p.evaluate(() => [...document.querySelectorAll('a[href]')].filter(a => a.offsetWidth + a.offsetHeight > 0).map(a => ({ h: new URL(a.href).pathname.replace(/\/+$/, ''), main: !!a.closest('main') })))
const openMenu = async p => { const cm = p.locator('.chat-menu-btn').first(); if (await cm.count()) { await cm.click({ timeout: 4000 }).catch(() => {}); await sleep(900); return } const b = p.locator('button[aria-expanded="false"]').filter({ hasText: /Menú|Menu/ }).first(); if (await b.count()) { await b.click({ timeout: 4000 }).catch(() => {}); await sleep(700) } }
const visit = async (U, url, o = {}) => { const bad403 = []; const p = await open(U, { ...o, url, routes: async pg => { pg.on('response', r => { if (r.status() === 403 && r.url().includes('/api/')) bad403.push(new URL(r.url()).pathname) }) } }); p.bad403 = bad403; p.text = await p.evaluate(() => document.body.innerText); p.denied = NOACC.test(p.text); p.where = await p.evaluate(() => location.pathname); return p }
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve()
  const R = {}; for (const r of ['user', 'superadmin', 'admin', 'therapist', 'board']) R[r] = await mk(r, 'M3-' + r)
  // F1 pantallas solo-persona × rol × idioma
  for (const lang of ['es', 'en']) {
    const rows = { user: [], superadmin: [], admin: [], therapist: [], board: [] }
    for (const role of Object.keys(R)) for (const url of PART) { const p = await visit(R[role], url, { lang, wait: 1500 }); rows[role].push([url, p.denied, p.where, p.bad403.length, p.errs.length]); await p.c.close() }
    ck(`F1[${lang}] persona usuaria entra a las ${PART.length} pantallas solo-persona (0 «sin acceso»)`, rows.user.every(r => !r[1]), JSON.stringify(rows.user.filter(r => r[1])))
    ck(`F1[${lang}] superadministración: «sin acceso» en ${PART.length}/${PART.length} y 0 respuestas 403 de las APIs de persona`, rows.superadmin.every(r => r[1] && r[3] === 0), JSON.stringify(rows.superadmin.filter(r => !r[1] || r[3])))
    ck(`F1[${lang}] administración, profesional y junta siguen sin entrar (${PART.length}/${PART.length} cada uno)`, ['admin', 'therapist', 'board'].every(k => rows[k].every(r => r[1] || r[2] !== r[0])), JSON.stringify(['admin', 'therapist', 'board'].map(k => rows[k].filter(r => !(r[1] || r[2] !== r[0])).map(r => k + r[0]))))
    ck(`F1[${lang}] sin errores JS en ninguna de las 35 cargas`, Object.values(rows).flat().every(r => r[4] === 0), '')
  }
  // F2 panel profesional
  for (const lang of ['es', 'en']) { const t = await visit(R.therapist, '/therapist/dashboard', { lang }); const s = await visit(R.superadmin, '/therapist/dashboard', { lang }); const tp = await visit(R.therapist, '/app/professional-reviews', { lang })
    ck(`F2[${lang}] profesional entra a su panel y a /app/professional-reviews; superadministración ve «sin acceso» en /therapist/dashboard sin 403`, !t.denied && t.where === '/therapist/dashboard' && !tp.denied && s.denied && s.bad403.length === 0, JSON.stringify({ t: t.denied, tp: tp.denied, s: s.denied, s403: s.bad403 })); for (const x of [t, s, tp]) await x.c.close() }
  // F3 pantallas que superadmin SÍ debe seguir viendo, y que admin/profesional siguen fuera de /app
  { const bad = []; for (const url of OPEN_FOR_SUPER) { const p = await visit(R.superadmin, url, { wait: 1500 }); if (p.denied || p.where !== url) bad.push([url, p.denied, p.where]); await p.c.close() }
    ck(`F3 superadministración sigue entrando a ${OPEN_FOR_SUPER.length} pantallas de persona no afectadas`, bad.length === 0, JSON.stringify(bad))
    const bad2 = []; for (const [role, url, ok] of [['admin', '/admin/dashboard', true], ['superadmin', '/admin/dashboard', true], ['admin', '/app/dashboard', false], ['therapist', '/app/dashboard', false], ['therapist', '/admin/dashboard', false], ['board', '/admin/dashboard', false], ['user', '/admin/dashboard', false], ['user', '/therapist/dashboard', false]]) { const p = await visit(R[role], url, { wait: 1200 }); if ((!p.denied && p.where === url) !== ok) bad2.push([role, url, p.denied, p.where]); await p.c.close() }
    ck('F3 matriz de zonas sin cambios (admin/profesional/junta/persona frente a /admin, /therapist y /app)', bad2.length === 0, JSON.stringify(bad2)) }
  // F4 menús: barra lateral (1360) y cajón (390) de persona y superadmin
  for (const lang of ['es', 'en']) for (const [role, w] of [['user', 1360], ['user', 390], ['superadmin', 1360], ['superadmin', 390]]) {
    const p = await visit(R[role], '/app/dashboard', { lang, w, wait: 1800 }); if (w < 900) await openMenu(p); const hs = (await links(p)).map(x => x.h); const hasAll = FORBID.every(f => hs.includes(f)), hasAny = FORBID.some(f => hs.includes(f))
    ck(`F4[${lang}] ${role} ${w}px: ${role === 'user' ? 'conserva' : 'NO trae'} «Siguiente paso», «Mis hojas de vida» y «Mi profesional»`, role === 'user' ? hasAll : !hasAny, JSON.stringify(FORBID.map(f => [f, hs.includes(f)]))); if (role === 'superadmin' && w < 900) ck(`F4[${lang}] superadmin 390: el cajón abrió (hay enlaces de grupo)`, hs.length > 5, String(hs.length))
    if (w < 900) ck(`F4[${lang}] ${role} 390: axe 0 con el cajón abierto`, (await axeRun(p)).length === 0, JSON.stringify(await axeRun(p))); await p.c.close() }
  // F5 conflicto de frames.tsx: el chat (#427) añade «Conversación» al cajón Y M3 filtra los enlaces por rol
  for (const lang of ['es', 'en']) for (const role of ['user', 'superadmin']) {
    const p = await visit(R[role], '/app/chat', { lang, w: 390, wait: 2500 }); const pre = (await links(p)).length; await openMenu(p); const hs = (await links(p)); const txt = await p.evaluate(() => document.body.innerText); const conv = /Conversaci[oó]n|Conversation/.test(txt)
    const ok = role === 'user' ? FORBID.every(f => hs.some(x => x.h === f)) : !FORBID.some(f => hs.some(x => x.h === f))
    ck(`F5[${lang}] ${role} /app/chat 390: el cajón trae el grupo «Conversación» (#427) y ${role === 'user' ? 'los tres enlaces de persona' : 'ninguno de los tres enlaces solo-persona'} (M3)`, conv && ok && hs.length > pre - 1, JSON.stringify({ conv, enlaces: hs.length, antes: pre, ok })); ck(`F5[${lang}] ${role} /app/chat 390: «Mi progreso» no se repite en el cajón (omit de #427)`, hs.filter(x => x.h === '/app/progress').length <= 1, String(hs.filter(x => x.h === '/app/progress').length)); ck(`F5[${lang}] ${role} /app/chat 390: axe 0 con el cajón abierto`, (await axeRun(p)).length === 0, JSON.stringify(await axeRun(p))); await p.c.close() }
  // F6 pantalla «sin acceso»: ES/EN × claro/oscuro × 1360/390/320, axe, desborde, h1, CLS
  { const bad = []; let n = 0; for (const lang of ['es', 'en']) for (const scheme of ['light', 'dark']) for (const w of [1360, 390, 320]) { n++; const p = await visit(R.superadmin, '/app/next-step', { lang, scheme, w, wait: 1800 }); const ax = await axeRun(p); const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); const h1 = await p.locator('h1').count(); if (!p.denied || ax.length || ov > 0 || h1 < 1 || p.errs.length) bad.push([lang, scheme, w, p.denied, ax.slice(0, 2), ov, h1, p.errs.slice(0, 1)]); await p.c.close() }
    ck(`F6 «sin acceso» (superadmin, /app/next-step) en ${n} combinaciones: texto, h1, axe 0, sin desborde, sin errores JS`, bad.length === 0, JSON.stringify(bad.slice(0, 3))) }
  // F7 teclado: la pantalla «sin acceso» ofrece un enlace de salida alcanzable con Tab
  { const p = await visit(R.superadmin, '/app/next-step', { w: 1360 }); let reach = false; for (let i = 0; i < 25 && !reach; i++) { await p.keyboard.press('Tab'); reach = await p.evaluate(() => { const a = document.activeElement; return !!(a && a.closest('main') && a.tagName === 'A') }) }
    ck('F7 teclado: Tab llega a un enlace dentro de la pantalla «sin acceso» (salida a un inicio válido)', reach, ''); if (reach) { const href = await p.evaluate(() => document.activeElement.getAttribute('href')); info('enlace de salida:', href); await p.keyboard.press('Enter'); await sleep(1500); const w = await p.evaluate(() => location.pathname); ck('F7 el enlace de salida lleva a un inicio al que superadmin SÍ entra', !NOACC.test(await p.evaluate(() => document.body.innerText)), w) } await p.c.close() }
  // F8 ruta profunda con parámetros / mayúsculas / barra final
  { const bad = []; for (const url of ['/app/my-therapist/', '/app/session/123', '/app/context/resumes/9', '/app/NEXT-STEP', '/app/next-step/..%2fdashboard']) { const p = await visit(R.superadmin, url, { wait: 1200 }); const pu = await visit(R.user, url, { wait: 1200 }); info('F8', url, '→ super:', p.denied ? 'sin acceso' : p.where, '| user:', pu.denied ? 'sin acceso' : pu.where); if (p.errs.length || pu.errs.length) bad.push(url); await p.c.close(); await pu.c.close() }
    ck('F8 rutas con barra final, subrutas y rutas raras no producen errores JS (el comportamiento queda en info)', bad.length === 0, JSON.stringify(bad)) }
  // F9 sin sesión: el flujo anónimo a esas rutas sigue llevando a login
  { const p = await open(null, { url: '/app/next-step', wait: 1500 }); const w = await p.evaluate(() => location.pathname); ck('F9 sin sesión: /app/next-step no muestra la pantalla (login)', /login/.test(w) || !NOACC.test(await p.evaluate(() => document.body.innerText)), w); await p.c.close() }
  // F10 CLS (390, CPU×4, 5 cargas) de la pantalla «sin acceso» y del inicio de superadmin / persona
  { const init = () => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) }; const out = {}
    for (const [role, url] of [['superadmin', '/app/next-step'], ['superadmin', '/app/dashboard'], ['user', '/app/dashboard'], ['superadmin', '/therapist/dashboard']]) { const v = []; for (let i = 0; i < 5; i++) { const p = await open(R[role], { url, w: 390, wait: 3000, init, routes: async pg => { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }) } }); v.push(+(await p.evaluate(() => window.__cls)).toFixed(4)); await p.c.close() } out[role + url] = v }
    info('CLS', JSON.stringify(out)); ck('F10 CLS máx ≤ 0,1 en las 4 vistas (5 cargas c/u, CPU×4, 390)', Object.values(out).every(v => Math.max(...v) <= 0.1), JSON.stringify(out)) }
  srv.close(); await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
