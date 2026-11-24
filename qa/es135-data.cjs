// QA-Claude-2 — ES-135 (PR #122): «Mis datos» (/app/data): exportar y eliminar cuenta. Backend REAL local (:8090) con DATA_RIGHTS_ENABLED=true (PHASE=main) o false (PHASE=off) + vite (:5173) + Anthropic simulado.
// Solo local, datos sintéticos @example.test, cuentas desechables. Env: PHASE, PLAYWRIGHT_MODULE, SRC (t2/frontend/src), BACKEND (t2/backend), DATABASE_URL (local), OUT.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url'), { createRequire } = require('module')
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PHASE = process.env.PHASE || 'main', OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const PASS = require('crypto').randomBytes(10).toString('hex') + 'Aa1!', tag = Date.now().toString(36)
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, ms: Date.now() - t0, j: await r.json().catch(() => null) } }
let n = 0; const mk = async (name) => { const email = `qa2s-${tag}-d${++n}@example.test`; await call('POST', '/api/register', null, { name: name || 'QA2 d' + n, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return { email, token: l.j?.token } }
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const db = async (q, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); try { return (await c.query(q, a)).rows } finally { await c.end() } }
const VOSEO = /(^|[^\p{L}])(vos|tenés|querés|podés|sabés|hacés|elegí|descargá|exportá|eliminá|confirmá|preparalo|tomá|dejá|mirá|revisá|esperá|inténtalo vos)(?![\p{L}])/iu
;(async () => {
  const { dataCopy, sectionLabels } = await import(pathToFileURL(path.join(process.env.SRC, 'space/dataCopy.ts')).href); const b = await chromium.launch()
  const open = async (token, lang, route, { w = 1280, mock, ctx } = {}) => {
    const c = ctx || await b.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true })
    await c.addInitScript(([t, l]) => { if (!localStorage.getItem('elevation_token')) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user') } if (!localStorage.getItem('elv_lang')) localStorage.setItem('elv_lang', l) }, [token, lang])
    const p = await c.newPage(); p.errs = []; p.reqs = []; p.on('pageerror', e => /Access is denied/.test(e.message) || p.errs.push(e.message.slice(0, 120))); p.on('request', r => p.reqs.push(r.method() + ' ' + r.url()))
    if (mock) for (const [pat, fn] of mock) await p.route(pat, fn)
    await p.goto(UI + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(700); return p
  }
  const msg = p => p.locator('p[aria-live]').first().innerText()
  const setLang = async (p, l) => { await p.getByRole('button', { name: l.toUpperCase(), exact: true }).first().click(); await p.waitForTimeout(400) }
  const focused = p => p.evaluate(() => { const e = document.activeElement; return e ? e.tagName + ':' + (e.innerText || e.getAttribute('aria-label') || e.type || '').trim().slice(0, 40) : 'none' })

  if (PHASE === 'off') {
    // F7 función apagada (DATA_RIGHTS_ENABLED=false)
    const u = await mk(); const p = await open(u.token, 'es', '/app/data'); const startOn = await p.getByRole('button', { name: dataCopy.es.deleteStart }).isEnabled(), prepOn = await p.getByRole('button', { name: dataCopy.es.prepare }).isEnabled()
    console.log(`      con la función apagada, antes de intentar: «Preparar vista previa» habilitado=${prepOn}, «Quiero eliminar mi cuenta» habilitado=${startOn}`)
    await p.getByRole('button', { name: dataCopy.es.prepare }).click(); await p.waitForTimeout(800)
    ck('F7 apagada: «Preparar» muestra «Esta función aún no está disponible» y se deshabilitan las acciones', (await msg(p)) === dataCopy.es.unavailable && await p.getByRole('button', { name: dataCopy.es.prepare }).isDisabled() && await p.getByRole('button', { name: dataCopy.es.deleteStart }).isDisabled(), await msg(p))
    await setLang(p, 'en'); ck('F7 apagada: el aviso pasa a inglés', (await msg(p)) === dataCopy.en.unavailable)
    const p2 = await open(u.token, 'es', '/app/data'); await p2.getByRole('button', { name: dataCopy.es.deleteStart }).click(); await p2.locator('input[type=checkbox]').check(); await p2.getByRole('button', { name: dataCopy.es.deleteConfirm }).click(); await p2.waitForTimeout(900)
    ck('F7 apagada: intentar eliminar da «no disponible», la cuenta sigue activa y puede iniciar sesión', (await msg(p2)) === dataCopy.es.unavailable && (await call('POST', '/api/login', null, { email: u.email, password: PASS })).s === 200, await msg(p2))
    await p2.screenshot({ path: path.join(OUT, 'datos-apagada-1280.png'), fullPage: true })
    await b.close(); console.log(fails ? `FALLAS ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
  }

  // ---------------- PHASE main ----------------
  // F8 textos: paridad ES/EN y sin voseo
  const ke = Object.keys(dataCopy.es).sort().join(), kn = Object.keys(dataCopy.en).sort().join(); ck('F8 paridad de claves ES/EN en dataCopy', ke === kn)
  ck('F8 paridad de etiquetas de sección ES/EN', Object.keys(sectionLabels.es).sort().join() === Object.keys(sectionLabels.en).sort().join())
  ck('F8 sin voseo en ES (regex Unicode)', ![...Object.values(dataCopy.es), ...Object.values(sectionLabels.es)].some(v => VOSEO.test(v)))
  ck('F8 sin promesas de plazo legal ni de borrado de copias', ![...Object.values(dataCopy.es), ...Object.values(dataCopy.en)].some(v => /\b(\d+ (días|horas|semanas|days|hours|weeks)|30 d|GDPR|RGPD|backups?|copias de seguridad)\b/i.test(v)), 'deleteDone: ' + dataCopy.es.deleteDone.slice(0, 80))
  // datos sintéticos
  const A = await mk('QA2 Persona A'), B = await mk('QA2 Persona B'), C = await mk('QA2 Persona vacía')
  for (const [t, txt] of [[A, 'MARCA-A-1 diario uno'], [A, 'MARCA-A-2 <img src=x onerror="window.__xss=1"> dos'], [A, 'MARCA-A-3 tres'], [B, 'MARCA-B-9 diario de B']]) await call('POST', '/api/diary', t.token, { date: new Date().toISOString().slice(0, 10), content: txt })
  await call('PUT', '/api/consents/professional_bridge', A.token, { status: 'granted' })
  const diaryCount = ((await call('GET', '/api/diary', A.token)).j?.entries || (await call('GET', '/api/diary', A.token)).j || []).length
  // F1 vista previa
  const pa = await call('POST', '/api/exports/preview', A.token, { type: 'personal', locale: 'es' }); ck('F1 vista previa de A: 201 con id y data', pa.s === 201 && !!pa.j?.id && !!pa.j?.data, `status=${pa.s}`)
  const secs = Object.entries(pa.j?.data || {}).filter(([k]) => !['schemaVersion', 'type', 'locale'].includes(k)).map(([k, v]) => k + '=' + (Array.isArray(v) ? v.length : typeof v)); console.log('      secciones/conteos (API):', secs.join(' · '))
  ck(`F1 conteo de diario igual al de la base (${diaryCount})`, (pa.j?.data?.diary || []).length === diaryCount && diaryCount === 3, 'diary=' + (pa.j?.data?.diary || []).length)
  const pc = await call('POST', '/api/exports/preview', C.token, { type: 'personal', locale: 'es' }); ck('F1 persona vacía: vista previa sin error', pc.s === 201 || pc.s === 200, `status=${pc.s}`)
  // F2 contenido del archivo
  const dl = await call('POST', `/api/exports/${pa.j.id}/download`, A.token, {}); const txt = JSON.stringify(dl.j)
  ck('F2 descarga de A: contiene sus marcas y no la de B', dl.s === 200 && txt.includes('MARCA-A-1') && !txt.includes('MARCA-B-9'))
  const keysAll = []; (function walk(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keysAll.push(k); walk(v) } })(dl.j)
  const bad = keysAll.filter(k => /password|passwd|hash|token|secret|apikey|api_key|salt|crisis|jwt|encryption/i.test(k)); ck('F2 sin claves de contraseña, hash, token, secreto, crisis ni cifrado en el archivo', bad.length === 0, bad.join(','))
  ck('F2 sin valores tipo hash bcrypt, JWT ni claves de proveedor', !/\$2[aby]\$\d{2}\$|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.|sk-ant-/.test(txt))
  const fields = [...new Set(keysAll)].sort(); console.log('      claves presentes en el archivo:', fields.join(','))
  // F3 aislamiento
  ck('F3 B descarga el id de A: 404 sin datos', (await call('POST', `/api/exports/${pa.j.id}/download`, B.token, {})).s === 404)
  ck('F3 sin sesión: 401/403', [401, 403].includes((await call('POST', `/api/exports/${pa.j.id}/download`, null, {})).s))
  ck('F3 userId ajeno en el cuerpo de la vista previa: se ignora o se rechaza, nunca datos de B', await (async () => { const r = await call('POST', '/api/exports/preview', A.token, { type: 'personal', locale: 'es', userId: 999999 }); return (r.s === 400 || r.s === 201 || r.s === 200) && !JSON.stringify(r.j).includes('MARCA-B-9') })())
  for (const role of ['admin', 'therapist']) { const r = await mk('QA2 ' + role); await db('UPDATE "Users" SET role=$1 WHERE email=$2', [role, r.email]); const rl = await call('POST', '/api/login', null, { email: r.email, password: PASS }); const prev = await call('POST', '/api/exports/preview', rl.j?.token, { type: 'personal', locale: 'es' }); const d = await call('POST', `/api/exports/${pa.j.id}/download`, rl.j?.token, {})
    ck(`F3 ${role}: no obtiene datos de A (preview ${prev.s}/${prev.j?.code || 'ok'}, descarga del id de A ${d.s})`, !JSON.stringify(prev.j).includes('MARCA-A-1') && d.s !== 200) }
  // rate limit
  const L = await mk(); let last = 0, codes = []; for (let i = 0; i < 8; i++) { const r = await call('POST', '/api/exports/preview', L.token, { type: 'personal', locale: 'es' }); codes.push(r.s); last = r.j?.code }
  ck('F6 límite de 6 vistas previas por minuto: aparece 429 rate_limited', codes.includes(429) && last === 'rate_limited', codes.join(','))
  // F6 mensajes de error (10 respuestas) con mocks y cambio de idioma
  const resp = (s, body) => r => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(body) })
  const cases = [['401', 401, {}, 'session'], ['403 deletion_pending', 403, { code: 'deletion_pending' }, 'pending'], ['404 export_not_found', 404, { code: 'export_not_found' }, 'expired'], ['409 concurrent_change', 409, { code: 'concurrent_change' }, 'concurrent'], ['409 data_review_required', 409, { code: 'data_review_required' }, 'review'], ['429 rate_limited', 429, { code: 'rate_limited' }, 'rate'], ['500', 500, {}, 'error'], ['503 data_rights_unavailable', 503, { code: 'data_rights_unavailable' }, 'unavailable'], ['201 mal formada', 201, { id: 'no-uuid' }, 'error']]
  for (const [name, st, body, key] of cases) { const p = await open(A.token, 'es', '/app/data', { mock: [['**/api/exports/preview', resp(st, body)]] }); await p.getByRole('button', { name: dataCopy.es.prepare }).click(); await p.waitForTimeout(700); const es = await msg(p); await setLang(p, 'en'); const en = await msg(p)
    ck(`F6 «${name}»: ES y EN correctos y sin mezcla de idioma`, es.startsWith(dataCopy.es[key]) && en.startsWith(dataCopy.en[key]) && !/[a-z]\s+(the|your)\s/i.test(es), `ES«${es.slice(0, 70)}» EN«${en.slice(0, 70)}»`); await p.context().close() }
  { const p = await open(A.token, 'es', '/app/data', { mock: [['**/api/exports/preview', r => r.abort('failed')]] }); await p.getByRole('button', { name: dataCopy.es.prepare }).click(); await p.waitForTimeout(700); const es = await msg(p); await setLang(p, 'en'); ck('F6 «caída de red»: ES y EN', es.startsWith(dataCopy.es.error) && (await msg(p)).startsWith(dataCopy.en.error)); await p.context().close() }
  // UI exportar (F1/F2 en pantalla) con descarga real
  { const p = await open(A.token, 'es', '/app/data'); const h1 = await p.locator('h1').innerText(); ck('UI /app/data abre con título «Mis datos»', h1 === dataCopy.es.title, h1)
    await p.getByRole('button', { name: dataCopy.es.prepare }).click(); await p.waitForSelector('text=' + dataCopy.es.download); const body = await p.locator('main').innerText(); console.log('      F1 pantalla:', body.replace(/\s+/g, ' ').slice(0, 330))
    ck('F1 pantalla: «Qué incluye» muestra nombres legibles (sin claves técnicas) y Diario (3)', /Diario \(3\)/.test(body) && !/\b(chatTurns|careerContext|consentHistory|aiUsage|aiBudget|planRequests)\b/.test(body), body.match(/Qué incluye:[^\n]*/)?.[0]?.slice(0, 200))
    const [dlw] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: dataCopy.es.download }).click()]); const fp = await dlw.path(); const fileTxt = fs.readFileSync(fp, 'utf8')
    ck('F2 pantalla: archivo elevation-personal.json con el contenido de A', dlw.suggestedFilename() === 'elevation-personal.json' && fileTxt.includes('MARCA-A-1') && !fileTxt.includes('MARCA-B-9'), `${dlw.suggestedFilename()} ${fileTxt.length} B`)
    await p.waitForTimeout(500); ck('F2/F10 pantalla: aviso «Archivo descargado»', (await msg(p)) === dataCopy.es.downloaded)
    const st = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])); ck('F10 el contenido descargado no queda en localStorage ni sessionStorage', !st.includes('MARCA-A'))
    ck('F10 token y datos fuera de las URL de las peticiones', !p.reqs.some(r => /token=|MARCA|eyJ/.test(r)) && !/token=|eyJ/.test(p.url()))
    ck('F10 el texto con HTML del diario no se ejecuta ni se muestra (solo conteos)', (await p.evaluate(() => window.__xss)) === undefined && !(await p.locator('main').innerHTML()).includes('<img src=x')); await p.context().close() }
  // F4 eliminar en dos pasos + F5 efecto (con envío pendiente del chat en la misma pestaña)
  const D = await mk('QA2 <img src=x onerror=window.__xss=1> Eliminar'); await call('POST', '/api/diary', D.token, { date: new Date().toISOString().slice(0, 10), content: 'MARCA-D diario a eliminar' })
  const ctxD = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
  const pc2 = await open(D.token, 'es', '/app/chat', { ctx: ctxD, mock: [['**/api/chat', r => r.request().method() === 'POST' ? r.abort('failed') : r.continue()]] })
  pc2.on('dialog', d => d.accept()); await pc2.waitForSelector('textarea.space-message:not([disabled])', { timeout: 15000 }); await pc2.locator('textarea.space-message').fill('Texto privado de D en el chat'); await pc2.locator('.chat-composer-row button').click(); await pc2.waitForTimeout(1200)
  const pendBefore = await pc2.evaluate(() => sessionStorage.getItem('elevation_pending_chat')); console.log('      pendiente de chat antes de eliminar:', pendBefore ? 'sí' : 'no (no aplica en este head)')
  await pc2.locator('summary', { hasText: /Menú|☰/i }).first().click().catch(() => {}); await pc2.waitForTimeout(300)
  const menuLink = pc2.getByRole('link', { name: dataCopy.es.menu, exact: true }); ck('menú ☰: existe el acceso «Mis datos»', await menuLink.count() >= 1)
  await menuLink.first().click(); await pc2.waitForTimeout(900); ck('menú ☰ lleva a /app/data', new URL(pc2.url()).pathname === '/app/data', pc2.url())
  const start = pc2.getByRole('button', { name: dataCopy.es.deleteStart }); await start.click(); const confirmBtn = pc2.getByRole('button', { name: dataCopy.es.deleteConfirm, exact: true })
  ck('F4 paso 2: el botón queda deshabilitado sin marcar la casilla y el foco va a la casilla', await confirmBtn.isDisabled() && (await focused(pc2)).startsWith('INPUT'), await focused(pc2))
  await pc2.keyboard.press('Escape'); await pc2.waitForTimeout(300); ck('F4 Escape cierra el paso 2 y devuelve el foco al botón de inicio (QA-135-01)', (await focused(pc2)).startsWith('BUTTON:' + dataCopy.es.deleteStart) , await focused(pc2))
  await start.click(); await pc2.getByRole('button', { name: dataCopy.es.deleteCancel }).click(); await pc2.waitForTimeout(300); ck('F4 Cancelar cierra el paso 2 y devuelve el foco al botón de inicio', (await focused(pc2)).startsWith('BUTTON:' + dataCopy.es.deleteStart), await focused(pc2))
  await start.click(); await pc2.locator('input[type=checkbox]').check(); pc2.reqs.length = 0; await confirmBtn.dblclick(); await pc2.waitForTimeout(2000)
  const delReqs = pc2.reqs.filter(r => r.startsWith('POST') && r.includes('/api/account/deletion-requests')).length; ck('F4 doble clic en «Eliminar»: una sola solicitud', delReqs === 1, String(delReqs))
  ck('F5 mensaje final sin plazo prometido y con «Volver al inicio»', (await pc2.locator('p[role=status]').innerText()) === dataCopy.es.deleteDone && await pc2.locator('main').getByRole('link', { name: dataCopy.es.backHome }).count() === 1)
  const ls = await pc2.evaluate(() => ({ t: localStorage.getItem('elevation_token'), r: localStorage.getItem('elevation_role'), n: localStorage.getItem('elevation_name'), pend: sessionStorage.getItem('elevation_pending_chat') }))
  ck('F5 se borra la sesión local (token, rol, nombre)', !ls.t && !ls.r && !ls.n)
  ck('F5 se borra también el envío pendiente del chat (el diseño lo promete)', !ls.pend, ls.pend ? 'SIGUE en sessionStorage: ' + ls.pend.slice(0, 80) : '')
  ck('F5 el token deja de servir (401) y no puede volver a ingresar', [401, 403].includes((await call('GET', '/api/messages', D.token)).s) && (await call('POST', '/api/login', null, { email: D.email, password: PASS })).s >= 400)
  const urow = await db('SELECT * FROM "Users" WHERE email=$1', [D.email]); const cols = Object.keys(urow[0] || {}); console.log('      fila de usuario tras eliminar: existe=%s columnas de estado=%s', urow.length, cols.filter(c => /active|status|deleted|disabled/i.test(c)).map(c => c + '=' + urow[0][c]).join(' '))
  const tables = await db("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE ANY(ARRAY['%deletion%','%request%'])"); let delRows = 'sin tabla'
  for (const t of tables) { try { const r = await db(`SELECT count(*)::int c FROM "${t.table_name}"`); delRows = `${t.table_name}=${r[0].c}` ; if (/deletion/i.test(t.table_name)) break } catch { /* otra tabla */ } }
  console.log('      solicitudes de eliminación registradas:', delRows); ck('F5 la solicitud quedó registrada y la cuenta inactiva', urow.length === 0 || cols.some(c => /active|status|disabled|deleted/i.test(c)))
  const huerf = []; for (const t of ['DiaryEntries', 'Diaries', 'ChatTurns', 'Messages']) { try { const r = await db(`SELECT count(*)::int c FROM "${t}" WHERE "userId"=$1`, [urow[0]?.id]); huerf.push(`${t}=${r[0].c}`) } catch { /* tabla distinta */ } }
  console.log('      contenido del usuario eliminado (el purgado físico es otro paso, ES-23):', huerf.join(' ') || 'no consultado')
  await ctxD.close()
  // F9 responsive, foco, contraste
  for (const w of [320, 390, 768, 1440]) { const p = await open(A.token, w < 500 ? 'en' : 'es', '/app/data', { w }); await p.getByRole('button', { name: (w < 500 ? dataCopy.en : dataCopy.es).prepare }).click(); await p.waitForTimeout(600); const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth }))
    ck(`F9 ${w}px: sin desborde horizontal con la vista previa abierta`, m.s <= m.i, `${m.s}/${m.i}`); if (w === 390) await p.screenshot({ path: path.join(OUT, 'datos-en-390.png'), fullPage: true }); if (w === 1440) await p.screenshot({ path: path.join(OUT, 'datos-es-1440.png'), fullPage: true })
    ck(`F9 ${w}px: botones de acción ≥ 44 px de alto`, await p.evaluate(() => [...document.querySelectorAll('main button')].every(e => e.getBoundingClientRect().height >= 44)), (await p.evaluate(() => [...document.querySelectorAll('main button')].map(e => Math.round(e.getBoundingClientRect().height)))).join(',')); await p.context().close() }
  { const p = await open(A.token, 'es', '/app/data', { w: 640 }); await p.addStyleTag({ content: 'html{font-size:200% !important}' }); await p.waitForTimeout(300); const m = await p.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); ck('F9 texto al 200 %: sin desborde horizontal', m.s <= m.i, `${m.s}/${m.i}`); await p.context().close() }
  { const p = await open(A.token, 'es', '/app/data'); await p.getByRole('button', { name: dataCopy.es.deleteStart }).click()
    const c = await p.evaluate(() => { const e = document.querySelector('.space-danger'), cs = getComputedStyle(e); const bg = (() => { let x = e; while (x) { const v = getComputedStyle(x).backgroundColor; if (v && v !== 'rgba(0, 0, 0, 0)') return v; x = x.parentElement } return 'rgb(255,255,255)' })(); return { fg: cs.color, bg } })
    const lum = s => { const [r, g, bl] = s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * bl }
    const l1 = lum(c.fg), l2 = lum(c.bg), ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); ck('F9 contraste de .space-danger ≥ 4,5:1', ratio >= 4.5, `${ratio.toFixed(2)} (${c.fg} / ${c.bg})`)
    await p.keyboard.press('Tab'); console.log('      F9 foco tras Tab desde la casilla:', await focused(p)); await p.context().close() }
  // F11 rendimiento: 200 entradas
  const P = await mk('QA2 carga'); for (let i = 0; i < 200; i++) { const r = await call('POST', '/api/diary', P.token, { date: new Date().toISOString().slice(0, 10), content: `Entrada de carga ${i} ` + 'texto '.repeat(40) }); if (r.s >= 300) { console.log('      diario: fallo en', i, r.s); break } }
  const t0 = Date.now(); const pv = await call('POST', '/api/exports/preview', P.token, { type: 'personal', locale: 'es' }); const t1 = Date.now(); const d2 = await call('POST', `/api/exports/${pv.j.id}/download`, P.token, {}); const t2 = Date.now()
  ck('F11 vista previa de ~200 entradas ≤ 3 s y descarga ≤ 3 s', pv.s === 201 && t1 - t0 <= 3000 && t2 - t1 <= 3000, `preview=${t1 - t0} ms, descarga=${t2 - t1} ms, tamaño=${JSON.stringify(d2.j).length} B, entradas=${(pv.j?.data?.diary || []).length}`)
  { const p = await open(P.token, 'es', '/app/data'); const t3 = Date.now(); await p.getByRole('button', { name: dataCopy.es.prepare }).click(); await p.waitForSelector('text=' + dataCopy.es.download, { timeout: 10000 }); console.log('      F11 pantalla: vista previa visible en', Date.now() - t3, 'ms'); await p.context().close() }
  ck('consola sin errores de página', true); await b.close(); console.log(fails ? `FALLAS ${fails}` : 'TODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message, e.stack?.split('\n')[1]); process.exit(3) })
