// [QA-Claude-5] PR #392 (ES-359 PR6): aviso de sesión abierta en «Crear cuenta». Backend REAL de main + PostgreSQL desechable; cuentas sintéticas; sin IA.
// Uso: via qa/run.sh e392-sesion.cjs <build> <db> ONLY=C1,C2,C3,C4,C5,C6,C7,C8,R (LABEL=pr|main: en main las comprobaciones del aviso son el control y solo se informan)
const L = require('./qa5-lib.cjs'); const { ck, info, mk, open, call, sleep, axeRun } = L
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
const PR = L.LABEL === 'pr'; const REG = '/login?mode=register'
const HOME = { user: '/app/onboarding', therapist: '/therapist/dashboard', admin: '/admin/dashboard' }
const T = { es: { open: n => `Ya tienes una sesión abierta como ${n}.`, short: 'Ya tienes una sesión abierta.', go: 'Seguir con mi sesión', out: 'Cerrar sesión para crear una cuenta nueva', hid: 'El formulario de registro queda oculto mientras haya una sesión abierta.' },
  en: { open: n => `You already have a session open as ${n}.`, short: 'You already have a session open.', go: 'Continue with my session', out: 'Sign out to create a new account', hid: 'The sign-up form stays hidden while a session is open.' } }
const norm = s => s.replace(/\s+/g, ' ').toLowerCase()
const body = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const shape = p => p.evaluate(() => ({ forms: document.querySelectorAll('form').length, inputs: document.querySelectorAll('input').length, h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('.ac-actions a, .ac-actions button')].filter(e => e.getBoundingClientRect().height < 44).length }))
const noName = c => c.addInitScript(() => { try { localStorage.removeItem('elevation_name') } catch {} })
;(async () => {
  await L.DB.connect(); await L.launch(); const srv = await L.serve(); info('build', process.env.DIST, 'label', L.LABEL)
  const US = { user: await mk('user', 'Marta Sintética'), therapist: await mk('therapist', 'Prof Sintético'), admin: await mk('admin', 'Admin Sintético') }
  if (want('C1')) for (const [role, U] of Object.entries(US)) for (const lang of ['es', 'en']) {
    const p = await open(U, { lang, url: REG, wait: 2200 }); const b = norm(await body(p)); const s = await shape(p); const path = await p.evaluate(() => location.pathname)
    if (PR) ck(`C1 [${role} ${lang}] aviso con el nombre, seguir / cerrar sesión y nota; formulario NO dibujado (0 form, 0 input); sigue en /login`, b.includes(norm(T[lang].open(U.name))) && b.includes(norm(T[lang].go)) && b.includes(norm(T[lang].out)) && b.includes(norm(T[lang].hid)) && s.forms === 0 && s.inputs === 0 && path === '/login', JSON.stringify({ ...s, path }))
    else info(`CONTROL main [${role} ${lang}]: ruta final ${path} (redirige) forms=${s.forms}`)
    await p.c.close()
  }
  if (want('C1')) for (const lang of ['es', 'en']) { // sin nombre guardado: forma corta
    const p = await open(US.user, { lang, url: REG, wait: 2200, init: undefined, routes: async pg => { await pg.context().addInitScript(() => { try { localStorage.removeItem('elevation_name') } catch {} }) } }); const b = norm(await body(p))
    if (PR) ck(`C1b [${lang}] sin nombre guardado: forma corta «${T[lang].short}» (sin llaves ni «undefined»)`, b.includes(norm(T[lang].short)) && !b.includes('{name}') && !b.includes('undefined') && !b.includes(' como .'), b.slice(0, 160)); await p.c.close()
  }
  if (want('C2')) for (const [role, U] of Object.entries(US)) {
    const p = await open(U, { lang: 'es', url: '/login', wait: 2500 }); const path = await p.evaluate(() => location.pathname)
    ck(`C2 [${role}] «Entrar» (/login) con sesión redirige al inicio del rol (${HOME[role]})`, path === HOME[role], path); await p.c.close()
  }
  if (want('C3') && PR) for (const [role, U] of Object.entries(US)) {
    const p = await open(U, { lang: 'es', url: REG, wait: 2200 }); await p.getByRole('link', { name: T.es.go }).click(); await sleep(1800); const path = await p.evaluate(() => location.pathname)
    ck(`C3 [${role}] «Seguir con mi sesión» lleva a ${HOME[role]}`, path === HOME[role], path); await p.c.close()
  }
  if (want('C4') && PR) {
    // C4a: servidor real: el token queda revocado, sesión local limpia, formulario y foco; doble clic = 1 logout
    const U = await mk('user', 'Cierre Sintético'); const before = await call('GET', '/api/session', U.token)
    const p = await open(U, { lang: 'es', url: REG, wait: 2200 }); const btn = p.getByRole('button', { name: T.es.out }); await btn.dblclick(); await sleep(2500)
    const st = await p.evaluate(() => ({ token: localStorage.getItem('elevation_token'), name: localStorage.getItem('elevation_name'), role: localStorage.getItem('elevation_role'), focus: document.activeElement && document.activeElement.id, forms: document.querySelectorAll('form').length, notice: document.body.innerText.includes('Ya tienes una sesión') }))
    const logouts = p.reqs.filter(r => r.m === 'POST' && r.u === '/api/logout').length; const after = await call('GET', '/api/session', U.token)
    ck('C4a cierre real: sesión local limpia, formulario visible, foco en el primer campo, sin aviso', st.token === null && st.name === null && st.role === null && st.forms === 1 && st.focus === 'access-name' && !st.notice, JSON.stringify(st))
    ck('C4b doble clic = 1 sola petición de logout', logouts === 1, String(logouts))
    ck('C4c el token QUEDÓ REVOCADO en el servidor (antes 200, después 401)', before.s === 200 && after.s === 401, `${before.s} → ${after.s}`)
    // y la cuenta nueva se puede crear tras cerrar sesión
    const email = `qa5-392-${Date.now()}@example.test`; await p.fill('#access-name', 'Nueva Sintética'); await p.fill('#access-email', email); await p.fill('#access-password', L.PASS)
    const cb = p.locator('input[type=checkbox]').first(); if (await cb.count()) await cb.check().catch(() => {})
    await p.locator('form button[type=submit], form .ac-submit').first().click(); await sleep(3500)
    const reg = p.reqs.filter(r => r.m === 'POST' && r.u === '/api/register').length; const path = await p.evaluate(() => location.pathname)
    const msg = await p.evaluate(() => /Registro exitoso|Registration successful/i.test(document.body.innerText))
    ck('C4d tras cerrar sesión se puede crear la cuenta nueva (un POST /api/register y el mensaje de registro exitoso, igual que sin sesión)', reg === 1 && msg, `registros=${reg} ruta=${path} mensaje=${msg}`)
    ck('C4e el cuerpo del registro NO contiene el nombre de la sesión anterior ni el token anterior', !p.reqs.filter(r => r.u === '/api/register').some(r => (r.b || '').includes('Cierre Sintético') || (r.b || '').includes(U.token)), ''); await p.c.close()
    // C4f: fallos del logout
    for (const [nm, handler] of [['5xx', rt => rt.fulfill({ status: 500, json: { error: 'x' } })], ['sin red', rt => rt.abort()]]) {
      const V = await mk('user', 'Falla ' + nm); const q = await open(V, { lang: 'es', url: REG, wait: 2200, routes: async pg => pg.route(x => new URL(x).pathname === '/api/logout', handler) })
      await q.getByRole('button', { name: T.es.out }).click(); await sleep(2500)
      const s2 = await q.evaluate(() => ({ token: localStorage.getItem('elevation_token'), forms: document.querySelectorAll('form').length, notice: document.body.innerText.includes('Ya tienes una sesión'), busy: !!document.querySelector('[aria-busy=true]') }))
      ck(`C4f logout con ${nm}: se cierra igual en el navegador, el formulario aparece y no queda el aviso ni el estado «ocupado»`, s2.token === null && s2.forms === 1 && !s2.notice && !s2.busy, JSON.stringify(s2)); await q.c.close()
    }
  }
  if (want('C5')) {
    for (const [nm, U] of [['sin sesión', null], ['token inválido', { token: 'token-invalido-qa3', role: 'user', name: 'Fantasma' }]]) {
      const p = await open(U, { lang: 'es', url: REG, wait: 2500 }); const s = await shape(p); const b = await body(p)
      ck(`C5 [${nm}] formulario normal de registro, sin aviso de sesión`, s.forms === 1 && s.inputs >= 4 && !/Ya tienes una sesión/.test(b), JSON.stringify(s)); await p.c.close()
    }
  }
  if (want('C6') && PR) {
    const evil = [['html', '<img src=x onerror="window.__x=1"><b>N</b>'], ['dolar', "A$&B$'C$`D"], ['largo', 'N'.repeat(200)]]
    for (const [nm, name] of evil) {
      const U = { ...US.user, name }; const p = await open(U, { lang: 'es', url: REG, wait: 2200 }); const r = await p.evaluate(() => ({ x: window.__x === 1, imgs: document.querySelectorAll('.ac-session img, .ac-session b').length, text: document.querySelector('.ac-session p')?.innerText || '' }))
      const leaked = p.reqs.some(q => (q.u + (q.b || '')).includes(encodeURIComponent(name)) || (q.b || '').includes(name))
      const okTxt = nm === 'html' ? r.text.includes('<img src=x') && !r.x && r.imgs === 0 : nm === 'dolar' ? r.text.includes("A$&B$'C$`D") && !r.text.includes('{name}') : r.text.length < 120 && r.text.includes('N'.repeat(80)) && !r.text.includes('N'.repeat(81))
      ck(`C6 [${nm}] el nombre guardado se muestra como TEXTO (sin ejecutar nada), sin duplicar texto y recortado a 80; no se envía en peticiones`, okTxt && !leaked, JSON.stringify({ ...r, text: r.text.slice(0, 90), leaked })); await p.c.close()
    }
  }
  if (want('C7') && PR) { // el nombre mostrado viene solo del navegador: token de A con nombre guardado de B
    const A = await mk('user', 'Persona A 392'), B = await mk('user', 'Persona B 392'); const p = await open({ ...A, name: B.name }, { lang: 'es', url: REG, wait: 2200 }); const b = await body(p)
    const urls = [...new Set(p.reqs.map(r => r.m + ' ' + r.u.split('?')[0]))]
    ck('C7 con token de A y nombre guardado de B: no hay lecturas de datos de B (solo /api/session y contenido público)', urls.every(u => /\/api\/(session|landing-content|content|user\/context)/.test(u) || /^GET \/api\/(public|health|plans)/.test(u)), urls.join(' | '))
    info('INFORMATIVO C7: el aviso muestra el nombre guardado en el navegador (' + (b.includes('Persona B 392') ? 'B' : b.includes('Persona A 392') ? 'A' : '?') + '), no el que devuelve el servidor; solo difiere si se manipula localStorage a mano'); await p.c.close()
  }
  if (want('C8')) {
    const ax = []; const cases = [['sesión', US.therapist], ['sin sesión', null]]
    for (const [nm, U] of cases) for (const lang of ['es', 'en']) for (const [w, scheme] of [[1360, 'light'], [390, 'dark'], [320, 'light'], [1360, 'dark']]) { const p = await open(U, { lang, w, scheme, theme: scheme, url: REG, wait: 1800 }); const s = await shape(p); ax.push({ nm, lang, w, scheme, ax: await axeRun(p), s }); await p.c.close() }
    const bad = ax.filter(a => a.ax.length || a.s.ov > 0 || a.s.h1 !== 1 || a.s.main !== 1 || (a.nm === 'sesión' && PR && a.s.small > 0)); ck(`C8 [${L.LABEL}] axe wcag2a/2aa/21a/21aa/22aa = 0, 1 h1, 1 main, sin desborde (y acciones ≥ 44 px en el aviso) en ${ax.length} estados`, bad.length === 0, bad.slice(0, 4).map(a => `${a.nm} ${a.lang} ${a.w} ${a.scheme}: ${a.ax.join(';')} ${JSON.stringify(a.s)}`).join(' | '))
    // contenido útil sin sesión: mismo en PR y main
    const p = await open(null, { lang: 'es', url: REG, wait: 1800 }); const t = await body(p); console.log(`U392 ${L.LABEL} sin-sesion chars=${t.length} hash=${L.crypto.createHash('sha1').update(t).digest('hex').slice(0, 10)}`); await p.c.close()
  }
  if (want('R')) { const n = +(process.env.RUNS || 2); let seq = 0; const r = await L.clsRuns(async () => ({ token: 'token-invalido-qa3', role: 'user' }), REG, n); console.log(`R392 ${L.LABEL} token-invalido cls=${JSON.stringify(r.cls)} util=${JSON.stringify(r.util)} src=${JSON.stringify(r.src)}`)
    const rv = await L.clsRuns(async () => ({ token: 'x', role: 'user' }), REG, n, () => { localStorage.removeItem('elevation_token'); localStorage.removeItem('elevation_role') }); console.log(`R392 ${L.LABEL} visitante-sin-token cls=${JSON.stringify(rv.cls)} util=${JSON.stringify(rv.util)} src=${JSON.stringify(rv.src)}`)
    if (PR) { const r2 = await L.clsRuns(async () => mk('therapist', 'R-392-' + (seq++)), REG, n); console.log(`R392 ${L.LABEL} con-sesion(aviso) cls=${JSON.stringify(r2.cls)} util=${JSON.stringify(r2.util)}`) } }
  await L.done(); srv?.close?.(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
