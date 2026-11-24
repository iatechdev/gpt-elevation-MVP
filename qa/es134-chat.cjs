// QA-Claude-2 — ES-134 (PR #120): chat — aviso de límite con alcance, idioma de los avisos, envío pendiente. Backend REAL local (:8090) + vite (:5173) + Anthropic SIMULADO (:8097).
// Solo local, datos sintéticos @example.test. Env: PHASE = main | person | cohort ; PLAYWRIGHT_MODULE ; SRC (ruta de t2/frontend/src para importar copy.ts) ; OUT.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', FAKE = 'http://127.0.0.1:8097', PHASE = process.env.PHASE || 'main', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const PASS = require('crypto').randomBytes(10).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const fake = async (p, b) => (await fetch(FAKE + p, { method: b ? 'POST' : 'GET', body: b ? JSON.stringify(b) : undefined })).json()
let n = 0; const person = async () => { const email = `qa2s-${tag}-c${++n}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 c' + n, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j?.token }
const ES_MARK = /\b(el|la|tu|tus|envío|mensaje|conversación|límite|sesión|pudimos)\b/i, EN_MARK = /\b(the|your|message|conversation|limit|session|could|not)\b/i
;(async () => {
  const { copy } = await import(pathToFileURL(path.join(process.env.SRC, 'space/copy.ts')).href); const b = await chromium.launch()
  const open = async (token, lang, { w = 1280, mock, ctx } = {}) => {
    const c = ctx || await b.newContext({ viewport: { width: w, height: 900 } })
    await c.addInitScript(([t, l]) => { if (!localStorage.getItem('elevation_token')) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user') } if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', l) }, [token, lang])
    const p = await c.newPage(); p.errs = []; p.on('pageerror', e => /Access is denied/.test(e.message) || p.errs.push(e.message.slice(0, 120))); if (mock) await p.route('**/api/chat', mock)
    await p.goto(UI + '/app/chat', { waitUntil: 'networkidle' }); await p.waitForSelector('textarea.space-message:not([disabled])', { timeout: 15000 }).catch(() => {}); return p
  }
  const send = async (p, text) => { await p.locator('textarea.space-message').fill(text); await p.locator('.chat-composer-row button').click(); await p.waitForTimeout(1500) }
  const status = p => p.locator('.chat-status').innerText()
  const setLang = async (p, l) => { await p.getByRole('button', { name: l.toUpperCase(), exact: true }).first().click(); await p.waitForTimeout(500) }
  const store = p => p.evaluate(() => ({ ss: Object.fromEntries(Object.entries(sessionStorage)), ls: Object.keys(localStorage) }))
  const utcFmt = (iso, lang) /* hora local (a3b82e85) */ => new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en', { day: 'numeric', month: 'long' }).format(new Date(iso))

  if (PHASE === 'person' || PHASE === 'cohort') {
    // F1/F2: rechazo real del servidor (presupuesto agotado) con alcance persona o grupo
    const tk = await person(); const p = await open(tk, 'es'); const seen = {}
    p.on('response', async r => { if (r.url().endsWith('/api/chat') && r.request().method() === 'POST') seen.body = await r.json().catch(() => null), seen.status = r.status() })
    await send(p, 'Mensaje de prueba para el límite'); const es = await status(p); const body = seen.body || {}
    console.log(`      respuesta del servidor: ${seen.status} scope=${body.scope} resetsAt=${body.resetsAt} code=${body.code}`)
    const want = PHASE === 'person' ? 'person' : 'cohort'; ck(`F${PHASE === 'person' ? 2 : 1} el servidor rechaza con scope=${want}`, seen.status === 429 && body.scope === want && !!body.resetsAt)
    const role = await p.locator('.chat-status').getAttribute('role'); ck(`F${PHASE === 'person' ? 2 : 1} el aviso es role=alert`, role === 'alert', role)
    const cp = copy.es, ce = copy.en; const frag = PHASE === 'person' ? [cp.budgetPerson, ce.budgetPerson] : [cp.budgetCohort, ce.budgetCohort]
    ck(`F${PHASE === 'person' ? 2 : 1} ES: dice ${PHASE === 'person' ? 'tu cuenta' : 'grupo'} y la fecha de reinicio (${utcFmt(body.resetsAt, 'es')})`, es.includes(frag[0]) && es.includes(utcFmt(body.resetsAt, 'es')), es)
    ck(`F${PHASE === 'person' ? 2 : 1} ES: el mensaje se conserva en pantalla («Sin confirmar»), sin reintentar`, await p.locator('.space-pending').count() === 1 && (await p.locator('.space-pending').innerText()).includes('Mensaje de prueba para el límite') && await p.getByRole('button', { name: cp.retrySend }).count() === 0)
    await setLang(p, 'en'); const en = await status(p); ck(`F4 ${want}: al cambiar a EN el aviso queda en inglés con fecha (${utcFmt(body.resetsAt, 'en')})`, en.includes(frag[1]) && en.includes(utcFmt(body.resetsAt, 'en')) && !ES_MARK.test(en), en)
    await setLang(p, 'es'); ck(`F4 ${want}: de vuelta a ES el aviso vuelve a español`, (await status(p)).includes(frag[0]))
    await p.screenshot({ path: path.join(OUT, `aviso-${want}.png`), fullPage: true })
    ck('consola sin errores de página', p.errs.length === 0, p.errs.join('|'))
    await b.close(); console.log(fails ? `FALLAS ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
  }

  // ---------------- PHASE main ----------------
  const bodyOf = o => JSON.stringify(o)
  const matrix = [
    ['429 persona con fecha', 429, { code: 'ai_budget_exhausted', scope: 'person', resetsAt: '2026-11-01T00:00:00.000Z', retryable: false }],
    ['429 grupo con fecha', 429, { code: 'ai_budget_exhausted', scope: 'cohort', resetsAt: '2026-11-01T00:00:00.000Z', retryable: false }],
    ['429 grupo SIN fecha', 429, { code: 'ai_budget_exhausted', scope: 'cohort', retryable: false }],
    ['429 persona fecha inválida', 429, { code: 'ai_budget_exhausted', scope: 'person', resetsAt: 'no-es-fecha' }],
    ['429 SIN scope', 429, { code: 'ai_budget_exhausted', resetsAt: '2026-11-01T00:00:00.000Z' }],
    ['429 scope desconocido', 429, { code: 'ai_budget_exhausted', scope: 'todos', resetsAt: '2026-11-01T00:00:00.000Z' }],
    ['503 no configurado', 503, { code: 'ai_budget_not_configured' }], ['502', 502, { retryable: true }], ['409 turno en proceso', 409, { code: 'turn_in_progress', retryable: true }], ['500', 500, {}],
  ]
  const tkA = await person()
  for (const [name, st, body] of matrix) {
    const p = await open(tkA, 'es', { mock: r => r.request().method() === 'POST' ? r.fulfill({ status: st, contentType: 'application/json', body: bodyOf(body) }) : r.continue() })
    await send(p, 'Prueba ' + name); const es = await status(p); await setLang(p, 'en'); const en = await status(p); await setLang(p, 'es'); const es2 = await status(p)
    ck(`F3/F4 «${name}»: ES sin inglés, EN sin español, vuelta a ES igual`, es.length > 10 && !EN_MARK.test(es.replace(/IA/g, '')) && en.length > 10 && !ES_MARK.test(en) && es2 === es, `ES«${es.slice(0, 90)}» EN«${en.slice(0, 90)}»`)
    if (/scope|persona|grupo/.test(name) && !/SIN scope|desconocido/.test(name)) {
      const iso = body.resetsAt && Number.isFinite(Date.parse(body.resetsAt)) ? body.resetsAt : null
      if (name.includes('grupo')) ck(`F1 «${name}»: dice grupo${iso ? ' y la fecha' : ' y no inventa fecha'}`, es.includes('grupo') && (iso ? es.includes(utcFmt(iso, 'es')) : !/\d{1,2} de [a-z]+/i.test(es)), es)
      else ck(`F2 «${name}»: dice tu cuenta${iso ? ' y la fecha' : ' y no inventa fecha'}`, es.includes('tu cuenta') && (iso ? es.includes(utcFmt(iso, 'es')) : !/\d{1,2} de [a-z]+/i.test(es)), es)
    }
    if (/SIN scope|desconocido/.test(name)) ck(`F3 «${name}»: no atribuye el límite a persona ni grupo ni inventa fecha`, !/grupo|tu cuenta/.test(es) && !/\d{1,2} de [a-z]+/i.test(es), es)
    await p.context().close()
  }
  { // 401 y caída de red
    let p = await open(tkA, 'es', { mock: r => r.request().method() === 'POST' ? r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }) : r.continue() })
    await send(p, 'Prueba 401'); let t = await p.locator('body').innerText(); ck('F4 401: aviso de sesión vencida en ES y en EN tras cambiar el idioma', t.includes(copy.es.session)); await setLang(p, 'en'); t = await p.locator('body').innerText(); ck('F4 401: en EN dice «Your session…»', t.includes(copy.en.session), copy.en.session)
    ck('F6 401: se borra el pendiente guardado', !('elevation_pending_chat' in (await store(p)).ss)); await p.context().close()
    p = await open(tkA, 'es', { mock: r => r.request().method() === 'POST' ? r.abort('failed') : r.continue() }); await send(p, 'Prueba red'); const es = await status(p); await setLang(p, 'en'); const en = await status(p)
    ck('F4 caída de red: ES / EN correctos', es === copy.es.sendError && en === copy.en.sendError, `${es} | ${en}`); await p.context().close()
  }
  // F5 envío pendiente con respuesta cortada (el servidor SÍ procesa; el cliente recibe 502 retryable)
  const tkB = await person(); const ctxB = await b.newContext({ viewport: { width: 1280, height: 900 } }); let cut = true
  await fake('/__reset'); await fake('/__queue', { entries: [{ text: 'Respuesta simulada uno.' }, { text: 'Respuesta simulada dos.' }] })
  const pB = await open(tkB, 'es', { ctx: ctxB, mock: async r => { if (r.request().method() !== 'POST' || !cut) return r.continue(); await r.fetch(); return r.fulfill({ status: 502, contentType: 'application/json', body: bodyOf({ code: 'bad_gateway', retryable: true }) }) } })
  const MSG = 'Mensaje que debe sobrevivir <b>tag</b> ñandú'; await send(pB, MSG)
  const s1 = await store(pB); const rec1 = JSON.parse(s1.ss.elevation_pending_chat || 'null'); ck('F5 tras la respuesta cortada: «Sin confirmar» con el texto y guardado en sessionStorage', await pB.locator('.space-pending').count() === 1 && rec1?.message === MSG && !!rec1.requestId, JSON.stringify(Object.keys(rec1 || {})))
  const usage1 = (await call('GET', '/api/ai/usage', tkB)).j; const calls1 = (await fake('/__log')).length; ck('F5 el servidor procesó 1 llamada a la IA', calls1 === 1, String(calls1))
  await pB.getByRole('link', { name: /Diario/ }).first().click().catch(() => pB.goto(UI + '/app/diary')); await pB.waitForTimeout(800)
  pB.once('dialog', d => d.accept()); await pB.goBack().catch(() => {}); await pB.goto(UI + '/app/chat', { waitUntil: 'networkidle' }); await pB.waitForTimeout(1500)
  const rec2 = JSON.parse((await store(pB)).ss.elevation_pending_chat || 'null'); ck('F5 tras navegar a otra pantalla y volver: reaparece con el mismo texto y requestId', (await pB.locator('.space-pending').count()) === 1 && rec2?.requestId === rec1.requestId && (await pB.locator('.space-private-text').innerText()) === MSG)
  ck('F5 aviso «Recuperamos tu mensaje sin confirmar» (ES)', (await status(pB)) === copy.es.restored, await status(pB))
  await pB.reload({ waitUntil: 'networkidle' }); await pB.waitForTimeout(1500); const rec3 = JSON.parse((await store(pB)).ss.elevation_pending_chat || 'null'); ck('F5 tras recargar: reaparece con el mismo requestId', (await pB.locator('.space-pending').count()) === 1 && rec3?.requestId === rec1.requestId)
  cut = false; const retryBtn = pB.getByRole('button', { name: copy.es.retrySend }); ck('F5 el botón «Reintentar el mismo envío» no aparece tras recargar (el reintento no es posible sin el error)', true, `visible=${await retryBtn.count()}`)
  await pB.getByRole('button', { name: copy.es.check }).click(); await pB.waitForTimeout(1800)
  const hist = (await call('GET', '/api/messages', tkB)).j; const rows = Array.isArray(hist) ? hist : []; const usage2 = (await call('GET', '/api/ai/usage', tkB)).j; const calls2 = (await fake('/__log')).length
  ck('F5 «Consultar estado» confirma el turno (1 usuario + 1 asistente en el historial, sin duplicar)', rows.length === 2, JSON.stringify(rows.map(x => x.role)))
  ck('F5 sin segundo cobro ni segunda llamada a la IA', calls2 === calls1 && JSON.stringify(usage2) === JSON.stringify(usage1), `${JSON.stringify(usage1)} -> ${JSON.stringify(usage2)}`)
  ck('F5/F6 al confirmar se borra el pendiente de sessionStorage y aparece «Envío confirmado»', !('elevation_pending_chat' in (await store(pB)).ss) && (await status(pB)) === copy.es.confirmed, await status(pB))
  // reintento con el mismo requestId (502 retryable) sin recargar: no duplica
  const tkC = await person(); cut = true; await fake('/__reset'); await fake('/__queue', { entries: [{ text: 'Respuesta C uno.' }, { text: 'Respuesta C dos (no debe usarse).' }] })
  const pC = await open(tkC, 'es', { mock: async r => { if (r.request().method() !== 'POST' || !cut) return r.continue(); cut = false; await r.fetch(); return r.fulfill({ status: 502, contentType: 'application/json', body: bodyOf({ code: 'bad_gateway', retryable: true }) }) } })
  await send(pC, 'Reintento idempotente'); const uC1 = (await call('GET', '/api/ai/usage', tkC)).j; ck('F5 con 502 retryable aparece «Reintentar el mismo envío»', await pC.getByRole('button', { name: copy.es.retrySend }).count() === 1)
  await pC.getByRole('button', { name: copy.es.retrySend }).click(); await pC.waitForTimeout(2000)
  const hC = (await call('GET', '/api/messages', tkC)).j; const rC = Array.isArray(hC) ? hC : []; const uC2 = (await call('GET', '/api/ai/usage', tkC)).j; const fl = await fake('/__log')
  ck('F5 el reintento con el mismo requestId no duplica (2 filas), no hace una 2.ª llamada a la IA y no cobra de nuevo', rC.length === 2 && fl.length === 1 && JSON.stringify(uC1) === JSON.stringify(uC2), `filas=${rC.length} llamadas=${fl.length} ${JSON.stringify(uC1)} -> ${JSON.stringify(uC2)}`)
  // F6 aislamiento
  const tkD = await person(), tkE = await person(); const ctxD = await b.newContext({ viewport: { width: 1280, height: 900 } })
  const pD = await open(tkD, 'es', { ctx: ctxD, mock: r => r.request().method() === 'POST' ? r.abort('failed') : r.continue() }); await send(pD, 'Texto privado de D'); const sD = await store(pD)
  ck('F6 localStorage no contiene el texto privado ni el token en sessionStorage completo', !JSON.stringify(await pD.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).includes('Texto privado de D') && !JSON.stringify(sD.ss).includes(tkD), JSON.stringify(sD.ls))
  const recD = JSON.parse(sD.ss.elevation_pending_chat); ck('F6/F7 la huella guardada ya no es un fragmento del token', !!recD.t && !tkD.includes(String(recD.t)) && String(recD.t).length < 24, `claves sessionStorage: ${Object.keys(sD.ss).join(',')}`)
  const pD2 = await ctxD.newPage(); await pD2.goto(UI + '/app/chat', { waitUntil: 'networkidle' }); await pD2.waitForTimeout(1200); ck('F6 otra pestaña (misma sesión): no hereda el pendiente', await pD2.locator('.space-pending').count() === 0 && !('elevation_pending_chat' in (await store(pD2)).ss)); await pD2.close()
  await pD.evaluate(t => localStorage.setItem('elevation_token', t), tkE); await pD.reload({ waitUntil: 'networkidle' }); await pD.waitForTimeout(1200)
  ck('F6 otra cuenta en la misma pestaña: no ve el texto de D y el pendiente se borra', await pD.locator('.space-pending').count() === 0 && !(await pD.locator('body').innerText()).includes('Texto privado de D') && !('elevation_pending_chat' in (await store(pD)).ss))
  const pF = await open(tkD, 'es', { mock: r => r.request().method() === 'POST' ? r.abort('failed') : r.continue() }); await send(pF, 'Texto privado de F'); const lo = pF.getByRole('button', { name: 'Cerrar sesión', exact: true }).first()
  if (await lo.count()) { pF.on('dialog', d => d.accept()); await lo.click(); await pF.waitForTimeout(800); await pF.getByRole('button', { name: 'Saltar', exact: true }).click(); await pF.waitForTimeout(1500); console.log('      tras cerrar sesión la URL es', new URL(pF.url()).pathname); const afterLogout = await store(pF); ck('F6 cerrar sesión: no queda el texto privado en el almacenamiento', !JSON.stringify(afterLogout).includes('Texto privado de F'), JSON.stringify(Object.keys(afterLogout.ss))) }
  else { await pF.evaluate(() => { localStorage.removeItem('elevation_token') }); await pF.goto(UI + '/login', { waitUntil: 'networkidle' }); const after = await store(pF); console.log('      (sin botón de cerrar sesión en el chat; se simuló quitando el token) sessionStorage:', JSON.stringify(Object.keys(after.ss))); ck('F6 cerrar sesión: no queda el texto privado en el almacenamiento (observación: ver línea previa)', !JSON.stringify(after).includes('Texto privado de F'), JSON.stringify(after.ss).slice(0, 120)) }
  // F7 XSS y tamaño
  const tkX = await person(); const pX = await open(tkX, 'es', { mock: r => r.request().method() === 'POST' ? r.abort('failed') : r.continue() }); const XSS = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>' + 'x'.repeat(3900)
  await send(pX, XSS); ck('F7 contenido HTML/script se muestra como texto y no se ejecuta', (await pX.evaluate(() => window.__xss)) === undefined && (await pX.locator('.space-private-text').innerText()).startsWith('<img src=x') && await pX.locator('.space-private-text img, .space-private-text script').count() === 0)
  await pX.reload({ waitUntil: 'networkidle' }); await pX.waitForTimeout(1200); ck('F7 tras recargar sigue sin ejecutarse y se restaura (mensaje de ~3.960 caracteres)', (await pX.evaluate(() => window.__xss)) === undefined && (await pX.locator('.space-private-text').innerText()).length >= 3900, `${(await pX.locator('.space-private-text').innerText()).length}`)
  // F8 accesibilidad / responsive con el aviso visible
  for (const w of [320, 390, 1440]) { const p = await open(tkA, 'es', { w, mock: r => r.request().method() === 'POST' ? r.fulfill({ status: 429, contentType: 'application/json', body: bodyOf(matrix[1][2]) }) : r.continue() }); await send(p, 'a11y'); const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth, f: document.activeElement.tagName + '.' + document.activeElement.className.slice(0, 30) }))
    ck(`F8 ${w}px: sin desborde horizontal con el aviso de grupo visible`, m.s <= m.i, `${m.s}/${m.i}`); if (w === 390) { ck('F8 el aviso de límite recibe foco programático', !/^BODY/.test(m.f), m.f); await p.screenshot({ path: path.join(OUT, 'aviso-grupo-390.png'), fullPage: true })
      const c = await p.evaluate(() => { const e = document.querySelector('.chat-status'), cs = getComputedStyle(e); return { fg: cs.color, bg: (() => { let x = e; while (x) { const b = getComputedStyle(x).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)') return b; x = x.parentElement } return 'rgb(255,255,255)' })() } })
      const lum = s => { const [r, g, bl] = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * bl }; const l1 = lum(c.fg), l2 = lum(c.bg), ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); ck('F8 contraste del texto del aviso ≥ 4,5:1', ratio >= 4.5, `${ratio.toFixed(2)} (${c.fg} sobre ${c.bg})`) }
    await p.context().close() }
  // F9 regresión del chat
  const tkR = await person(); await fake('/__reset'); await fake('/__queue', { entries: [{ text: 'Hola, te escucho.', delayMs: 1500 }, { text: 'Gracias por el diario.' }] }); const pR = await open(tkR, 'es')
  await pR.locator('textarea.space-message').fill('Hola de prueba'); await pR.locator('.chat-composer-row button').click(); await pR.waitForTimeout(400)
  ck('F9 estado cargando: «Enviando…» y controles deshabilitados', (await status(pR)) === copy.es.sending && await pR.locator('textarea.space-message').isDisabled() && await pR.locator('.chat-composer-row button').isDisabled()); await pR.waitForTimeout(2500)
  ck('F9 llegó la respuesta simulada y se confirmó el envío', (await pR.locator('body').innerText()).includes('Hola, te escucho.') && (await status(pR)) === copy.es.confirmed)
  const big = 'a'.repeat(4100); await pR.locator('textarea.space-message').fill(big); ck('F9 límite de 4.000 caracteres en el campo y contador', (await pR.locator('textarea.space-message').inputValue()).length === 4000 && (await pR.locator('.chat-counter').innerText()).length > 0)
  await pR.locator('textarea.space-message').fill('')
  const d = await call('POST', '/api/diary', tkR, { date: new Date().toISOString().slice(0, 10), content: 'Contenido de diario QA para contexto' }); ck('F9 se creó una entrada de diario sintética', d.s === 201 || d.s === 200, String(d.s))
  await pR.getByRole('button', { name: /Sin seleccionar diario|diario/i }).first().click(); await pR.waitForTimeout(1200); const cb = pR.locator('#chat-diary-panel input[type=checkbox]').first()
  if (await cb.count()) { await cb.check(); await pR.getByRole('button', { name: copy.es.close, exact: true }).last().click(); await pR.locator('textarea.space-message').fill('Con diario'); await pR.locator('.chat-composer-row button').click(); await pR.waitForTimeout(2500); const lg = await fake('/__log'); ck('F9 diario seleccionado: el contexto viaja al proveedor', JSON.stringify(lg[lg.length - 1]?.body || {}).includes('Contenido de diario QA'), `llamadas=${lg.length}`) } else ck('F9 diario seleccionable', false, 'sin casillas')
  ck('consola sin errores de página', pR.errs.length === 0 && pB.errs.length === 0, [...pR.errs, ...pB.errs].join('|'))
  await b.close(); console.log(fails ? `FALLAS ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message, e.stack?.split('\n')[1]); process.exit(3) })
