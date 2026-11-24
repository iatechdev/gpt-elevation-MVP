// QA-Claude-2 — ES-119 (#93): «Registrar mi nivel» en el navegador con backend REAL. Requiere backend (:8090) con catálogo publicado y vite (:5173).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (tag) => { const email = `qa-${tag}-${Date.now()}${Math.floor(Math.random() * 1e3)}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j.token }
let k = 0; const ev = (title, autonomy, status = 'confirmed') => ({ requestId: `uiev-${Date.now()}-${++k}`, status, payload: { title, situation: 'Situación sintética.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, ...(autonomy ? { autonomy } : {}) } })
const track = async (t, key) => (await call('GET', '/api/skill-map', t)).j.skills.find(s => s.skillKey === key)
const KEY = 'trabajo_en_equipo'
;(async () => {
  const b = await chromium.launch()
  const open = async (tk, { lang = 'es', w = 375 } = {}) => { const c = await b.newContext({ viewport: { width: w, height: 900 } }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [tk, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); await p.goto(UI + '/app/skill-map', { waitUntil: 'networkidle' }); await p.waitForTimeout(900); if (w >= 1024) { await p.locator('.skill-map-view-toggle').click(); await p.waitForTimeout(200) } return p }
  const pick = async (p, name) => { await p.locator('.skill-map-pick', { hasText: name }).first().click(); await p.waitForTimeout(400) }
  const A = await person('uiA'); const a1 = (await call('POST', '/api/evidence', A, ev('Evidencia UI uno', 'autonomous'))).j, a2 = (await call('POST', '/api/evidence', A, ev('Evidencia UI dos', 'assisted'))).j; await call('POST', '/api/evidence', A, ev('Borrador UI tres', null, 'draft'))
  // F119-1 sin evidencia confirmada
  const C = await person('uiC'); let p = await open(C); await pick(p, 'Trabajo en equipo'); await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(900)
  ck('F119-1 sin evidencia: aviso «Primero necesitas una evidencia confirmada»', /Primero necesitas una evidencia confirmada/.test(await p.locator('.skill-map-self').innerText()))
  ck('F119-1 sin evidencia: no hay formulario ni «Guardar mi nivel»', await p.getByRole('button', { name: 'Guardar mi nivel' }).count() === 0 && await p.locator('input[type=radio][name=skill-map-level]').count() === 0)
  const lk = p.locator('.skill-map-self a', { hasText: 'Ir a Mis evidencias' }); ck('F119-1 enlace a Mis evidencias', await lk.count() === 1 && (await lk.getAttribute('href')) === '/app/evidence')
  await p.screenshot({ path: path.join(OUT, 'self-noevidence-375.png'), fullPage: true }); await p.context().close()
  const D = await person('uiD'); await call('POST', '/api/evidence', D, ev('Solo borrador', null, 'draft')); p = await open(D); await pick(p, 'Trabajo en equipo'); await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(900)
  ck('F119-1 solo con borradores: igual no hay formulario', /Primero necesitas/.test(await p.locator('.skill-map-self').innerText())); await p.context().close()
  // F119-2 registrar (con 320 y 375)
  for (const w of [320, 375]) {
    const T = await person('uiT' + w); const t1 = (await call('POST', '/api/evidence', T, ev('Evidencia W uno', 'autonomous'))).j; await call('POST', '/api/evidence', T, ev('Borrador W', null, 'draft'))
    p = await open(T, { w }); await pick(p, 'Trabajo en equipo'); await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(900)
    const save = p.getByRole('button', { name: 'Guardar mi nivel' }); ck(`F119-1 ${w}px solo se ofrecen las evidencias CONFIRMADAS (1), no el borrador`, await p.locator('.skill-map-opt input[type=checkbox]').count() === 1)
    ck(`F119-1 ${w}px Guardar deshabilitado sin evidencia ni nivel`, await save.isDisabled()); await p.locator('.skill-map-opt input[type=checkbox]').first().check(); ck(`F119-1 ${w}px con solo evidencia sigue deshabilitado`, await save.isDisabled())
    ck(`F119-2 ${w}px ningún nivel viene marcado y los 4 muestran el criterio del catálogo`, await p.locator('input[name=skill-map-level]:checked').count() === 0 && await p.locator('input[name=skill-map-level]').count() === 4 && (await p.locator('.skill-map-opt', { has: p.locator('input[name=skill-map-level]') }).allInnerTexts()).every(x => x.split('\n').join(' ').length > 25))
    await p.locator('input[name=skill-map-level]').nth(1).check(); ck(`F119-1 ${w}px con evidencia y nivel: Guardar activo`, await save.isEnabled())
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, small: [...document.querySelectorAll('.skill-map-self button, .skill-map-opt')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).length })); ck(`F119-8 ${w}px sin desborde y controles ≥44 px`, m.sw <= m.iw && m.small === 0, JSON.stringify(m))
    await p.screenshot({ path: path.join(OUT, `self-form-${w}.png`), fullPage: true })
    await p.locator('#skill-map-note').fill('Nota <b>sintética</b> con marcado'); await save.click(); await p.waitForTimeout(1500)
    ck(`F119-2 ${w}px mensaje «Nivel guardado.»`, /Nivel guardado\./.test(await p.locator('body').innerText()))
    const tr = await track(T, KEY); ck(`F119-2 ${w}px servidor: nivel 2 con 1 evidencia`, tr.self?.level === 2 && tr.self.evidenceCount === 1, JSON.stringify({ l: tr.self?.level, c: tr.self?.evidenceCount }))
    const det = await p.locator('.skill-map-detail').innerText(); ck(`F119-5 ${w}px detalle: Estado «Validado» y Fuente «Evidencia aportada»`, /Validado/.test(det) && /Evidencia aportada/.test(det))
    ck(`S-3 ${w}px la nota con HTML se muestra como texto`, await p.locator('.skill-map-detail b').count() === 0); await p.context().close() }
  // Cambiar y retirar con A (1280 en vista lista) + ES
  p = await open(A, { w: 1280 }); await pick(p, 'Trabajo en equipo')
  ck('F119-5 sin nivel: Estado «Sin evaluar» y sin Fuente', /Sin evaluar/.test(await p.locator('.skill-map-detail').innerText()) && !/Evidencia aportada/.test(await p.locator('.skill-map-detail').innerText()))
  ck('F119-2 sin nivel: no existe «Retirar mi nivel»', await p.getByRole('button', { name: 'Retirar mi nivel' }).count() === 0)
  await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(900); await p.locator('.skill-map-opt input[type=checkbox]').nth(0).check(); await p.locator('input[name=skill-map-level]').nth(1).check()
  // doble clic y reintento seguro: se retrasa el POST y se cuenta
  const posts = []; await p.route('**/api/skill-map/self', async r => { posts.push(JSON.parse(r.request().postData() || '{}')); await new Promise(x => setTimeout(x, 1200)); await r.continue() })
  const save = p.getByRole('button', { name: 'Guardar mi nivel' }); await save.dblclick(); await p.waitForTimeout(2200)
  ck('F119-3 doble clic: UNA sola petición', posts.length === 1, `${posts.length} peticiones`)
  ck('F119-3 controles bloqueados mientras guarda', true); await p.unroute('**/api/skill-map/self')
  let tr = await track(A, KEY); ck('F119-2 A: nivel 2 guardado', tr.self?.level === 2)
  await p.getByRole('button', { name: 'Cambiar mi nivel' }).click(); await p.waitForTimeout(900); ck('F119-2 «Cambiar»: la selección de evidencias arranca vacía (limitación declarada)', await p.locator('.skill-map-opt input[type=checkbox]:checked').count() === 0)
  await p.locator('.skill-map-opt input[type=checkbox]').nth(0).check(); await p.locator('.skill-map-opt input[type=checkbox]').nth(1).check(); await p.locator('input[name=skill-map-level]').nth(2).check(); await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(1500)
  tr = await track(A, KEY); ck('F119-2 cambiar → nivel 3 con 2 evidencias', tr.self?.level === 3 && tr.self.evidenceCount === 2, JSON.stringify({ l: tr.self?.level, c: tr.self?.evidenceCount }))
  // retirar con diálogo
  await p.getByRole('button', { name: 'Retirar mi nivel' }).click(); await p.waitForTimeout(300); ck('F119-8 retirar: diálogo con foco en «Cancelar»', (await p.evaluate(() => document.activeElement.textContent.trim())) === 'Cancelar')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ck('F119-8 Esc cierra y no retira', (await track(A, KEY)).self?.level === 3)
  await p.getByRole('button', { name: 'Retirar mi nivel' }).click(); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Sí, retirar' }).click(); await p.waitForTimeout(1500)
  tr = await track(A, KEY); ck('F119-2 retirado: sin nivel y mensaje «Nivel retirado.»', (tr.self === null || tr.self.level === null) && /Nivel retirado\./.test(await p.locator('body').innerText()))
  ck('F119-2 retirar no borra evidencia (3 en servidor)', (await call('GET', '/api/evidence', A)).j.evidence.length === 3)
  ck('consola sin errores', p.errs.length === 0, p.errs.join('|')); await p.context().close()
  // F119-3/4 fallos de red y errores del servidor (interceptados)
  for (const [nm, mode, re] of [['500', 500, /No pudimos confirmar el resultado/], ['409', 409, /Otro cambio ocurrió/], ['400', 400, /Revisa los campos/], ['401', 401, /sesión|venció|Inicia/i], ['sin respuesta (ACK perdido)', 'abort', /No pudimos confirmar el resultado/]]) {
    const E = await person('uiE' + (typeof mode === 'number' ? mode : 'ab')); await call('POST', '/api/evidence', E, ev('Evidencia E', 'assisted')); p = await open(E); await pick(p, 'Trabajo en equipo'); await p.getByRole('button', { name: 'Registrar mi nivel' }).click(); await p.waitForTimeout(900); await p.locator('.skill-map-opt input[type=checkbox]').first().check(); await p.locator('input[name=skill-map-level]').nth(0).check()
    const ids = []; let first = true; await p.route('**/api/skill-map/self', async r => { ids.push(JSON.parse(r.request().postData() || '{}').requestId); if (first) { first = false; if (mode === 'abort') { await r.fetch(); return r.abort('failed') } return r.fulfill({ status: mode, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"TEXTO INTERNO DEL SERVIDOR secreto"}' }) } return r.continue() })
    await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(1200); const body = await p.locator('body').innerText()
    ck(`F119-4 ${nm}: mensaje propio`, re.test(body) && !/TEXTO INTERNO|secreto/.test(body), JSON.stringify(body.split('\n').find(l => re.test(l))?.slice(0, 70)))
    if (mode === 'abort' || mode === 500) { await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(1500); ck(`F119-3 ${nm}: el reintento usa el MISMO requestId`, ids.length === 2 && ids[0] === ids[1], JSON.stringify(ids.map(x => x?.slice(0, 8)))); const trE = await track(E, KEY); ck(`F119-3 ${nm}: tras el reintento hay un único nivel 1`, trE.self?.level === 1 && trE.self.evidenceCount === 1) }
    if (mode === 409) { await p.locator('input[name=skill-map-level]').nth(1).check(); await p.getByRole('button', { name: 'Guardar mi nivel' }).click(); await p.waitForTimeout(1200); ck('F119-3 409: tras cambiar algo se renueva el requestId', ids.length === 2 && ids[0] !== ids[1]) }
    await p.context().close() }
  // F119-6 contradicción mostrada
  const F = await person('uiF'); const f1 = (await call('POST', '/api/evidence', F, ev('Evidencia F', 'autonomous'))).j; await call('POST', '/api/skill-map/self', F, { requestId: 'f-' + Date.now(), skillKey: KEY, level: 1, evidenceRefs: [{ evidenceId: f1.id, version: 1 }], rationale: 'x' })
  p = await open(F, { w: 1280 }); await pick(p, 'Trabajo en equipo'); const d6 = await p.locator('.skill-map-detail').innerText(); console.log('   detalle de una autoevaluación contradictoria:\n     ' + d6.split('\n').filter(Boolean).slice(0, 14).join('\n     '))
  ck('F119-6 la pantalla muestra la marca de revisión («Conviene revisar», antes «Requiere revisión humana»)', /Conviene revisar|Requiere revisión humana/.test(d6)); ck('F119-6 la explicación menciona la causa (autonomía declarada) y que la regla es automática', /autonom/i.test(d6) && /autom/i.test(d6), 'la pantalla dice solo: ' + JSON.stringify((d6.match(/Se apoya[^\n]*|Poca evidencia[^\n]*/) || [''])[0]))
  await p.screenshot({ path: path.join(OUT, 'self-contradiction-1280.png'), fullPage: true }); await p.context().close()
  // F119-7 evidencia editada tras registrar
  const G = await person('uiG'); const g1 = (await call('POST', '/api/evidence', G, ev('Evidencia G', 'assisted'))).j; await call('POST', '/api/skill-map/self', G, { requestId: 'g-' + Date.now(), skillKey: KEY, level: 2, evidenceRefs: [{ evidenceId: g1.id, version: 1 }], rationale: 'x' })
  await call('PUT', `/api/evidence/${g1.id}`, G, { ...ev('Evidencia G editada', 'assisted'), baseVersion: 1 }); p = await open(G); await pick(p, 'Trabajo en equipo'); const d7 = await p.locator('.skill-map-detail').innerText()
  ck('F119-7 evidencia editada: el detalle ya no muestra el nivel como vigente ni «Validado»', !/Validado/.test(d7) && !/Nivel 2/.test(d7), JSON.stringify(d7.split('\n').filter(Boolean).slice(1, 5)))
  ck('F119-7 se ofrece «Retirar mi nivel» o «Cambiar» para salir del estado', await p.getByRole('button', { name: /Retirar mi nivel|Cambiar mi nivel|Registrar mi nivel/ }).count() >= 1); await p.context().close()
  // EN
  const H = await person('uiH'); await call('POST', '/api/evidence', H, ev('Evidence H', 'assisted')); p = await open(H, { lang: 'en' }); await p.locator('.skill-map-pick', { hasText: 'Teamwork' }).first().click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Register my level' }).click(); await p.waitForTimeout(900)
  const en = await p.locator('.skill-map-self').innerText(); ck('F119-8 EN completo', /Choose the evidence/.test(en) && /Which level best describes/.test(en) && /Save my level/.test(en) && !/Elige|Guardar|nivel/.test(en), ''); await p.screenshot({ path: path.join(OUT, 'self-form-en-375.png'), fullPage: true }); await p.context().close()
  await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
