// QA-Claude-2 — ES-188 (PR #274): catálogo de habilidades (avisos de conflicto, «habilidades en uso», enlaces a campos que faltan). Backend REAL (:8090, PostgreSQL con migraciones reales),
// catálogo y personas SINTÉTICOS, 0 IA. Todo REAL (sesión, roles, concurrencia entre dos administradores, 409 del servidor). Solo se simula la pérdida de la respuesta (F5b) con route.fetch + abort.
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, AXE, DIST (build del PR o de main de control), LABEL, ONLY (S1,F3,F2,F4,F5,F1,A1a,A1b,R1), AXEOUT.
// Orden de estados del servidor: v1 publicada (3 habilidades completas; evaluaciones vigentes sembradas) -> v2 borrador (copia). F3 (con una habilidad incompleta) -> F2 -> F4 -> F5 -> F1 (publica v2).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', LABEL = process.env.LABEL || 'pr', AXE = fs.readFileSync(process.env.AXE, 'utf8'), ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + `[${LABEL}] ` + n, x) }; const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL }); const dbq = async (q, a) => (await DB.query(q, a)).rows
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }; const DIR = process.env.DIST
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { let p; try { p = path.join(DIR, decodeURIComponent(q.url.split('?')[0])) } catch { p = DIR } if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(DIR, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }).listen(5173, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length + '[' + v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' ' + n.html.slice(0, 70)).join(' | ') + ']')) }
let BR; const tag = Date.now().toString(36); let n = 0; const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!'
const mk = async (role, name) => { n++; const email = `qa2-p274-${tag}-${n}@example.test`; const r = await call('POST', '/api/register', null, { name: 'x', email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET name=$3, "onboardingCompleted"=true, role=$2, active=true WHERE id=$1', [id, role, name]); const login = (await call('POST', '/api/login', null, { email, password: PASS })).j; return { id, name, email, role, token: login?.token } }
const open = async (U, { lang = 'es', w = 1360, h = 900, scheme = 'light', url = '/admin/skill-catalog', hdrRole, dialogs, noWait, cpu } = {}) => {
  const c = await BR.newContext({ viewport: { width: w, height: h }, colorScheme: scheme }); await c.addInitScript(([tk, l, nm, rl]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', rl); localStorage.setItem('elevation_name', nm) } localStorage.setItem('elv_lang', l); window.__cls = 0; try { new PerformanceObserver(x => { for (const e of x.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch {} }, [U?.token, lang, U?.name || 'x', hdrRole || U?.role || 'admin'])
  const p = await c.newPage(); p.errs = []; p.cons = []; p.reqs = []; p.dlg = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.cons.push(m.text().slice(0, 120)) })
  p.on('request', r => { if (/localhost:8090/.test(r.url())) p.reqs.push({ m: r.method(), u: new URL(r.url()).pathname, b: r.postData() }) }); p.on('dialog', d => { p.dlg.push(d.message()); if (dialogs === 'accept') d.accept(); else d.dismiss() })
  if (cpu) { const cdp = await c.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await p.goto('http://localhost:5173' + url, { waitUntil: 'domcontentloaded', timeout: 60000 }); if (!noWait) { await p.waitForSelector('main h1, main h2, main button', { timeout: 30000 }).catch(() => {}); await sleep(1500) } p.c = c; return p }
const txt = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const act = p => p.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, role: a.getAttribute('role'), txt: (a.textContent || '').slice(0, 60) } : null })
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const full = (es, en, extra = {}) => ({ type: 'transversal', labels: { es, en }, rubric: { levels: { 1: { es: 'Nivel 1 sintético', en: 'Synthetic level 1' }, 2: { es: 'Nivel 2 sintético', en: 'Synthetic level 2' }, 3: { es: 'Nivel 3 sintético', en: 'Synthetic level 3' }, 4: { es: 'Nivel 4 sintético', en: 'Synthetic level 4' } }, source: 'Fuente sintética', verifiedBy: 'QA sintético', verifiedAt: '2026-01-10' }, territories: ['dir'], ...extra })
const CAT = '/api/admin/skill-catalog'; let AD, AD2, SA, P1, P2, T, JN, V1, V2

;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve()
  P1 = await mk('user', 'PERSONA-1-274'); P2 = await mk('user', 'PERSONA-2-274'); T = await mk('therapist', 'PROF-274'); JN = await mk('board', 'JUNTA-274'); AD = await mk('admin', 'ADMIN-274'); AD2 = await mk('admin', 'ADMIN2-274'); SA = await mk('superadmin', 'SUPER-274')
  // ── Estado base: v1 publicada y v2 borrador ──
  const d1 = await call('POST', CAT, AD.token, {}); V1 = d1.j.id
  for (const [k, es, en] of [['comunicacion_clara', 'Comunicación clara', 'Clear communication'], ['analisis_datos', 'Análisis de datos', 'Data analysis'], ['liderazgo_qa', 'Liderazgo QA', 'QA leadership']]) { const r = await call('PUT', `${CAT}/${V1}/skills/${k}`, AD.token, full(es, en)); if (r.s !== 200) throw new Error('semilla ' + k + ' ' + r.s + r.tx) }
  const pub = await call('POST', `${CAT}/${V1}/publish`, AD.token, {}); if (pub.s !== 200) throw new Error('publicar v1 ' + pub.s + pub.tx)
  const ins = (uid, key) => dbq(`INSERT INTO "SkillAssessments" ("UserId","skillKey",track,level,state,"catalogVersion","rubricHash","evidenceRefs",confidence,"confidenceReasonCode","confidenceRuleVersion",rationale,authoring,status,"requestId","createdAt","updatedAt") VALUES ($1,$2,'self',2,'initial',1,$3,'[]','low','x',1,NULL,'person','current',$4,now(),now())`, [uid, key, 'a'.repeat(64), 'rq-' + crypto.randomBytes(6).toString('hex')])
  await ins(P1.id, 'analisis_datos'); await ins(P2.id, 'analisis_datos'); await ins(P1.id, 'liderazgo_qa')
  const d2 = await call('POST', CAT, AD.token, {}); V2 = d2.j.id; info('v1', V1, 'v2 borrador', V2)
  const pageV2 = `/admin/skill-catalog/${V2}`, skillUrl = k => `${pageV2}/skills/${k}`

  // ── S1 rol verificado en el servidor ──
  if (want('S1')) {
    for (const [nm, U] of [['persona', P1], ['profesional', T], ['junta', JN]]) { for (const [m, pth, b] of [['GET', CAT], ['GET', `${CAT}/${V2}`], ['GET', `${CAT}/territories`], ['POST', CAT, {}], ['PUT', `${CAT}/${V2}/skills/comunicacion_clara`, full('X', 'X')], ['DELETE', `${CAT}/${V2}/skills/comunicacion_clara`], ['POST', `${CAT}/${V2}/publish`, {}]]) { const r = await call(m, pth, U.token, b); ck(`S1 API ${nm} ${m} ${pth.replace(CAT, '')} -> 401/403`, [401, 403].includes(r.s), r.s) } }
    for (const [m, pth] of [['GET', CAT], ['PUT', `${CAT}/${V2}/skills/comunicacion_clara`]]) { const r = await call(m, pth, null, m === 'PUT' ? full('X', 'X') : undefined); ck(`S1 API sin sesión ${m} -> 401/403`, [401, 403].includes(r.s), r.s) }
    for (const [nm, U] of [['administrador', AD], ['superadmin', SA]]) { const r = await call('GET', CAT, U.token); ck(`S1 API ${nm} lista -> 200`, r.s === 200, r.s) }
    const before = await dbq(`SELECT count(*)::int c FROM "SkillDefinitions"`); const after = (await call('PUT', `${CAT}/${V2}/skills/comunicacion_clara`, P1.token, full('HACK', 'HACK'))).s
    ck('S1 persona NO pudo cambiar el catálogo (la etiqueta sigue)', (await dbq(`SELECT labels FROM "SkillDefinitions" WHERE "catalogId"=$1 AND "skillKey"='comunicacion_clara'`, [V2]))[0].labels.es === 'Comunicación clara', after)
    for (const [nm, U] of [['persona', P1], ['profesional', T], ['junta', JN]]) for (const lang of ['es', 'en']) { const p = await open(U, { lang, hdrRole: U.role, url: `/admin/skill-catalog/${V2}` }); const tx = await txt(p); ck(`S1 UI ${nm} ${lang}: pantalla sin acceso, sin datos del catálogo ni llamadas al catálogo`, !/Comunicación clara|Clear communication|analisis_datos|Publicar/.test(tx) && !p.reqs.some(r => /skill-catalog/.test(r.u)) && /acceso|access/i.test(tx), tx.slice(0, 90)); await p.c.close() }
    // rol manipulado en el cliente: token de persona con elevation_role=admin
    { const p = await open(P1, { hdrRole: 'admin', url: `/admin/skill-catalog/${V2}` }); const tx = await txt(p); ck('S1 token de persona con elevation_role=admin: el servidor niega (sin lista del catálogo en pantalla)', !/Comunicación clara|analisis_datos/.test(tx), tx.slice(0, 120)); const bad = p.reqs.filter(r => /skill-catalog/.test(r.u)); info('S1 llamadas al catálogo con rol manipulado:', bad.map(r => r.m + ' ' + r.u).join(',') || 'ninguna'); await p.c.close() }
    { const p = await open(null, { url: '/admin/skill-catalog' }); ck('S1 sin sesión -> /login', /\/login/.test(p.url()), p.url()); await p.c.close() }
    // token revocado
    { const U = await mk('admin', 'ADMIN-REV'); const ok = (await call('GET', CAT, U.token)).s; await call('POST', '/api/logout-all', U.token, {}); const r = await call('GET', CAT, U.token); ck('S1 token REVOCADO -> 401 (antes 200)', ok === 200 && r.s === 401, `${ok}->${r.s}`) }
  }

  // ── F3 «Faltan datos»: traducción y enlace al campo ──
  const M1 = async () => { await call('PUT', `${CAT}/${V2}/skills/skill_incompleta`, AD.token, { type: 'domain', labels: { es: 'Habilidad incompleta' }, rubric: { levels: {} } }) }
  if (want('F3') || want('A1a')) await M1()
  if (want('F3')) {
    const miss = (await call('GET', `${CAT}/${V2}`, AD.token)).j.skills.find(s => s.skillKey === 'skill_incompleta').missing; info('F3 faltantes del servidor:', miss.length, miss.join(','))
    const ANCH = { 'labels.en': 'skcat-label-en', 'rubric.source': 'skcat-source', 'rubric.verifiedBy': 'skcat-verifiedBy', 'rubric.verifiedAt': 'skcat-date' }; for (const l of [1, 2, 3, 4]) for (const c of ['es', 'en']) ANCH[`rubric.levels.${l}.${c}`] = `skcat-l${l}${c}`
    const ES = { 'labels.en': 'Nombre (EN)', 'rubric.source': 'Fuente', 'rubric.verifiedBy': 'Verificada por', 'rubric.verifiedAt': 'Fecha de verificación' }; for (const l of [1, 2, 3, 4]) for (const c of ['es', 'en']) ES[`rubric.levels.${l}.${c}`] = `Nivel ${l} (${c.toUpperCase()})`
    const EN = { 'labels.en': 'Name (EN)', 'rubric.source': 'Source', 'rubric.verifiedBy': 'Verified by', 'rubric.verifiedAt': 'Verification date' }; for (const l of [1, 2, 3, 4]) for (const c of ['es', 'en']) EN[`rubric.levels.${l}.${c}`] = `Level ${l} (${c.toUpperCase()})`
    ck('F3 el servidor reporta exactamente las rutas esperadas (12)', miss.length === 12 && miss.every(m => ANCH[m]), miss.length)
    for (const lang of ['es', 'en']) {
      const p = await open(AD, { lang, url: pageV2 }); await p.getByRole('button', { name: lang === 'es' ? /^Publicar…/ : /^Publish…/ }).click(); await sleep(600)
      const links = await p.evaluate(() => [...document.querySelectorAll('a.skcat-link')].map(a => ({ t: a.textContent.trim(), h: a.getAttribute('href') })))
      ck(`F3 ${lang}: 12 enlaces, cada ruta del servidor traducida a frase (sin rutas crudas) y con ancla al campo`, links.length === 12 && miss.every(m => links.some(l => l.t === (lang === 'es' ? ES : EN)[m] && l.h.endsWith('#' + ANCH[m]))) && !links.some(l => /rubric\.|labels\./.test(l.t)), links.map(l => l.t).join('|'))
      await p.c.close()
    }
    // clic y teclado: el foco llega al campo exacto (incluidos los niveles 3 y 4, que están plegados)
    for (const [mode, lang] of [['clic', 'es'], ['teclado', 'es'], ['clic', 'en']]) { let okAll = true; const bad = []
      for (const m of miss) { const p = await open(AD, { lang, url: pageV2, noWait: true }); await p.waitForSelector('main h1', { timeout: 20000 }); await sleep(400); await p.getByRole('button', { name: lang === 'es' ? /^Publicar…/ : /^Publish…/ }).click(); await sleep(400)
        const lab = (lang === 'es' ? ES : EN)[m]; const a = p.getByRole('link', { name: lab, exact: true })
        if (mode === 'clic') await a.click(); else { await a.focus(); await p.keyboard.press('Enter') }
        await sleep(900); const ac = await act(p); const hash = new URL(p.url()).hash; const vis = await p.evaluate(id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight }, ANCH[m])
        if (!(ac && ac.id === ANCH[m] && hash === '#' + ANCH[m] && vis && /skills\/skill_incompleta/.test(p.url()))) { okAll = false; bad.push(`${m}->${ac && ac.id}/${hash}/vis=${vis}`) } await p.c.close() }
      ck(`F3 ${mode} ${lang}: el enlace abre el editor de la habilidad y deja el FOCO en el campo exacto, visible (12 de 12)`, okAll, bad.join(' ; ')) }
    { const p = await open(AD, { url: skillUrl('skill_incompleta') + '#inexistente' }); ck('F3 ancla inexistente no rompe la pantalla (sin errores, editor visible)', (await txt(p)).includes('Habilidad incompleta') && p.errs.length === 0, p.errs.join('|')); await p.c.close() }
    { const p = await open(AD, { url: skillUrl('skill_incompleta') + '#skcat-l4en' }); const d = await p.evaluate(() => ({ open: document.querySelector('details.skcat-more')?.open, id: document.activeElement.id })); ck('F3 ancla directa #skcat-l4en: «Niveles 3 y 4» se abre y el campo recibe el foco', d.open === true && d.id === 'skcat-l4en', JSON.stringify(d)); await p.c.close() }
    { const p = await open(AD, { url: skillUrl('comunicacion_clara') }); ck('F3 habilidad completa: sin enlaces ni «Obligatorio para publicar»', !(await txt(p)).includes('Obligatorio para publicar'), ''); await p.c.close() }
  }
  // A1 en el momento M1 (habilidad incompleta presente)
  const axeStates = async (lbl, rows) => { const out = []; for (const [lang, w, scheme] of [['es', 1360, 'light'], ['es', 1360, 'dark'], ['en', 1360, 'light'], ['en', 1360, 'dark'], ['es', 390, 'light'], ['es', 390, 'dark'], ['en', 390, 'light'], ['en', 390, 'dark'], ['es', 320, 'light'], ['es', 320, 'dark'], ['en', 320, 'light'], ['en', 320, 'dark']]) for (const [name, fn] of rows) { const p = await open(AD, { lang, w, scheme, h: w > 500 ? 900 : 800, url: fn.url }); try { if (fn.setup) await fn.setup(p, lang); const v = await axeRun(p); const ov = w < 500 ? await overflow(p) : 0; out.push({ k: `${name} ${lang}/${w}/${scheme}`, v, ov }) } catch (e) { out.push({ k: `${name} ${lang}/${w}/${scheme}`, v: ['EXC ' + e.message.slice(0, 80)], ov: 0 }) } await p.c.close() } return out }
  const report = (lbl, res) => { const ids = {}; for (const r of res) for (const v of r.v) { const id = v.split(':')[0]; ids[id] = (ids[id] || 0) + 1 }; const bad = res.filter(r => r.v.length); ck(`${lbl}: axe 2.2 AA ${res.length} combinaciones: 0 violaciones`, bad.length === 0, bad.slice(0, 5).map(r => r.k + ' ' + r.v.join(',').slice(0, 160)).join(' || ') + ' ids=' + JSON.stringify(ids)); const ov = res.filter(r => r.ov > 0); ck(`${lbl}: sin desborde horizontal (≤ 390 px, sin emulación móvil)`, ov.length === 0, ov.slice(0, 4).map(r => r.k + ' +' + r.ov).join(', ')); if (process.env.AXEOUT) fs.appendFileSync(process.env.AXEOUT, JSON.stringify({ lbl, LABEL, res }) + '\n') }
  if (want('A1a')) {
    const pubClick = async (p, lang) => { await p.getByRole('button', { name: lang === 'es' ? /^Publicar…/ : /^Publish…/ }).click(); await sleep(500) }
    report('A1a lista, versión, habilidad completa, habilidad incompleta, panel «falta»', await axeStates('A1a', [['lista', { url: '/admin/skill-catalog' }], ['borrador', { url: pageV2 }], ['habilidad', { url: skillUrl('comunicacion_clara') }], ['incompleta', { url: skillUrl('skill_incompleta') }], ['panel-falta', { url: pageV2, setup: pubClick }]]))
  }
  await call('DELETE', `${CAT}/${V2}/skills/skill_incompleta`, AD.token)

  // ── F2 conflicto entre dos administradores ──
  if (want('F2')) {
    const key = 'comunicacion_clara'; const stale = await open(AD, { url: skillUrl(key) }); const other = await open(AD2, { url: skillUrl(key) })
    const getLabel = async () => (await dbq(`SELECT labels, rubric FROM "SkillDefinitions" WHERE "catalogId"=$1 AND "skillKey"=$2`, [V2, key]))[0]
    // la otra persona guarda primero
    await other.locator('#skcat-label-es').fill('Comunicación clara (otra persona)'); await other.getByRole('button', { name: 'Guardar' }).click(); await sleep(1500)
    const put1 = other.reqs.filter(r => r.m === 'PUT'); ck('F2 la 2.ª persona guarda: 200 y envía expectedUpdatedAt', put1.length === 1 && /expectedUpdatedAt/.test(put1[0].b || '') && (await getLabel()).labels.es === 'Comunicación clara (otra persona)', put1.map(r => (r.b || '').slice(-70)).join())
    // la 1.ª (versión vieja) escribe y guarda
    await stale.locator('#skcat-l1es').fill('Nivel 1 escrito por la persona con versión vieja'); const reqsBefore = stale.reqs.length; await stale.getByRole('button', { name: 'Guardar' }).click(); await sleep(1800)
    const a = await stale.evaluate(() => { const all = [...document.querySelectorAll('.skcat-error[role=alert]')]; const el = all.find(x => /Otra persona/.test(x.innerText)); return { n: all.length, texts: all.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 60)), text: el?.innerText.replace(/\s+/g, ' '), focused: all.some(x => x === document.activeElement || x.contains(document.activeElement)), l1: document.getElementById('skcat-l1es')?.value, lab: document.getElementById('skcat-label-es')?.value } })
    ck('F2 versión vieja: aviso «Otra persona guardó…» con foco, SIN pisar al servidor', /Otra persona guardó esta habilidad/.test(a.text || '') && a.focused && (await getLabel()).labels.es === 'Comunicación clara (otra persona)' && (await getLabel()).rubric.levels['1'].es === 'Nivel 1 sintético', JSON.stringify(a).slice(0, 220))
    ck('F2 lo escrito por la persona NO se pierde al aparecer el aviso (el campo conserva su texto)', a.l1 === 'Nivel 1 escrito por la persona con versión vieja', a.l1)
    const putN = stale.reqs.slice(reqsBefore).filter(r => r.m === 'PUT').length; ck('F2 un solo envío (sin reintento silencioso)', putN === 1, putN)
    // «Cargar lo guardado»
    await stale.getByRole('button', { name: 'Cargar lo guardado' }).click(); await sleep(800)
    const b = await stale.evaluate(() => ({ lab: document.getElementById('skcat-label-es').value, l1: document.getElementById('skcat-l1es').value, alert: !!document.querySelector('.skcat-error[role=alert]'), save: document.querySelector('button[type=submit]').disabled }))
    ck('F2 «Cargar lo guardado» adopta la versión vigente (nombre de la otra persona), cierra el aviso y deja Guardar sin cambios pendientes', b.lab === 'Comunicación clara (otra persona)' && b.l1 === 'Nivel 1 sintético' && !b.alert && b.save === true, JSON.stringify(b))
    await stale.locator('#skcat-l1es').fill('Nivel 1 reintentado tras cargar'); await stale.getByRole('button', { name: 'Guardar' }).click(); await sleep(1500)
    ck('F2 tras cargar, el reintento guarda (200) con la versión nueva', (await getLabel()).rubric.levels['1'].es === 'Nivel 1 reintentado tras cargar', '')
    // doble clic rápido: un solo PUT
    const dbl = await open(AD, { url: skillUrl(key) }); await dbl.locator('#skcat-l2es').fill('Nivel 2 doble clic'); const n0 = dbl.reqs.filter(r => r.m === 'PUT').length; await dbl.getByRole('button', { name: 'Guardar' }).dblclick(); await sleep(1800)
    ck('F2 doble clic en Guardar: un solo PUT', dbl.reqs.filter(r => r.m === 'PUT').length - n0 === 1, dbl.reqs.filter(r => r.m === 'PUT').length - n0)
    // habilidad quitada por otra persona
    const rem = await open(AD, { url: skillUrl('liderazgo_qa') }); await call('DELETE', `${CAT}/${V2}/skills/liderazgo_qa`, AD2.token); await rem.locator('#skcat-l1es').fill('texto con la habilidad ya quitada'); await rem.getByRole('button', { name: 'Guardar' }).click(); await sleep(1500)
    const c = await rem.evaluate(() => { const all = [...document.querySelectorAll('.skcat-error[role=alert]')]; return { n: all.length, all: all.map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 90)), text: all.map(x => x.innerText).join(' ') } }); info('F2 avisos visibles con la habilidad quitada:', c.n, JSON.stringify(c.all)); info('F2 avisos visibles con conflicto de versión:', a.n, JSON.stringify(a.texts))
    ck('F2 habilidad quitada por otra persona: aviso «quitó esta habilidad» (no un error genérico)', /quitó esta habilidad/.test(c.text || ''), c.text)
    await rem.getByRole('button', { name: 'Volver al borrador' }).last().click(); await sleep(900); ck('F2 en ese aviso, el botón devuelve al borrador', new URL(rem.url()).pathname === pageV2, rem.url())
    ck('F2 la habilidad quitada NO reapareció en el servidor', (await dbq(`SELECT 1 FROM "SkillDefinitions" WHERE "catalogId"=$1 AND "skillKey"='liderazgo_qa'`, [V2])).length === 0, '')
    // en inglés
    { const e1 = await open(AD, { lang: 'en', url: skillUrl('analisis_datos') }); await call('PUT', `${CAT}/${V2}/skills/analisis_datos`, AD2.token, full('Data analysis (changed)', 'Data analysis')); await e1.locator('#skcat-l1en').fill('x en'); await e1.getByRole('button', { name: 'Save' }).click(); await sleep(1500); const t2 = await txt(e1); ck('F2 EN: aviso en inglés y botón «Load what was saved»', /Someone else saved this skill/.test(t2) && /Load what was saved/.test(t2), ''); await e1.c.close() }
    for (const p of [stale, other, dbl, rem]) await p.c.close()
    // restituir la habilidad quitada
    await call('PUT', `${CAT}/${V2}/skills/liderazgo_qa`, AD.token, full('Liderazgo QA', 'QA leadership'))
    await call('PUT', `${CAT}/${V2}/skills/analisis_datos`, AD.token, full('Análisis de datos', 'Data analysis'))
  }

  // ── F4 validaciones ──
  if (want('F4')) {
    const key = 'comunicacion_clara'; const put = (b) => call('PUT', `${CAT}/${V2}/skills/${key}`, AD.token, b)
    const cases = [['nivel de 301 caracteres', { ...full('A', 'A'), rubric: { ...full('A', 'A').rubric, levels: { 1: { es: 'x'.repeat(301) } } } }], ['fecha futura', { ...full('A', 'A'), rubric: { ...full('A', 'A').rubric, verifiedAt: '2999-01-01' } }], ['territorio desconocido', { ...full('A', 'A'), territories: ['zzz'] }], ['territorio repetido', { ...full('A', 'A'), territories: ['dir', 'dir'] }], ['más territorios que los definidos', { ...full('A', 'A'), territories: ['dir', 'con', 'com', 'ing', 'inn', 'x6'] }], ['tipo inválido', { ...full('A', 'A'), type: 'otro' }], ['campo extra', { ...full('A', 'A'), extra: 1 }], ['nombre de 81', { ...full('x'.repeat(81), 'A') }], ['__proto__', JSON.parse('{"__proto__":{"a":1},"type":"domain"}')], ['cuerpo arreglo', []], ['nombre numérico', { ...full(5, 'A') }]]
    for (const [nm, b] of cases) { const r = await put(b); ck(`F4 ${nm} -> 400 (no 5xx) y no cambia nada`, r.s === 400, r.s + ' ' + (r.j?.code || '')) }
    ck('F4 tras todas las entradas inválidas la habilidad sigue intacta', (await dbq(`SELECT labels FROM "SkillDefinitions" WHERE "catalogId"=$1 AND "skillKey"=$2`, [V2, key]))[0].labels.es === 'Comunicación clara (otra persona)', '')
    for (const k of ['new', 'AB', 'a', '1abc', 'con-guion', 'x'.repeat(49), 'con espacio', '__proto__']) { const r = await call('PUT', `${CAT}/${V2}/skills/${encodeURIComponent(k)}`, AD.token, full('A', 'A')); ck(`F4 clave «${k.slice(0, 20)}» -> 4xx`, r.s >= 400 && r.s < 500, r.s + ' ' + (r.j?.code || '')) }
    for (const id of ['abc', '0', '-1', '99999999', '1.5', "1;DROP"]) { const r = await call('GET', `${CAT}/${encodeURIComponent(id)}`, AD.token); ck(`F4 id «${id}» -> 4xx`, r.s >= 400 && r.s < 500, r.s) }
    { const r = await put({ ...full('<img src=x onerror=window.__x=1>', 'EN <script>window.__x=1</script>') }); ck('F4 HTML en el nombre se acepta como texto', r.s === 200, r.s) }
    { const p = await open(AD, { url: pageV2 }); const d = await p.evaluate(() => ({ x: window.__x, img: document.querySelectorAll('main img').length, scr: document.querySelectorAll('main script').length, t: document.body.innerText.includes('<img src=x')})); ck('F4 el HTML aparece como TEXTO en la lista (sin ejecutar ni crear elementos)', !d.x && d.img === 0 && d.scr === 0 && d.t, JSON.stringify(d)); await p.c.close() }
    await put(full('Comunicación clara', 'Clear communication'))
    // UI: validaciones en el formulario
    { const p = await open(AD, { url: pageV2 + '/skills/new' }); await p.locator('#skcat-key').fill('new'); await p.locator('#skcat-label-es').fill('Prueba'); await p.getByRole('button', { name: 'Guardar' }).click(); await sleep(700); const r1 = await p.evaluate(() => document.querySelector('#skcat-key-h')?.innerText); const reqs = p.reqs.filter(r => r.m === 'PUT').length
      await p.locator('#skcat-key').fill('Clave Inválida'); await p.getByRole('button', { name: 'Guardar' }).click(); await sleep(500); const r2 = await p.evaluate(() => document.querySelector('#skcat-key-h')?.innerText)
      ck('F4 UI: clave «new» o inválida: error de clave y NO se envía', /no es válida|Clave/.test(r1 || '') && /no es válida/.test(r2 || '') && reqs === 0, `${r1} || ${r2} PUT=${reqs}`)
      await p.locator('#skcat-key').fill('prueba_ui'); await p.locator('#skcat-l1es').fill('y'.repeat(301)); await p.getByRole('button', { name: 'Guardar' }).click(); await sleep(500); const r3 = await p.evaluate(() => document.querySelector('#skcat-l1es-h')?.innerText); ck('F4 UI: nivel de 301 caracteres: error «hasta 300» y NO se envía', /300/.test(r3 || '') && p.reqs.filter(r => r.m === 'PUT').length === 0, r3)
      await p.locator('#skcat-l1es').fill('ok'); await p.locator('#skcat-date').fill('2999-01-01'); await p.getByRole('button', { name: 'Guardar' }).click(); await sleep(500); const r4 = await p.evaluate(() => document.querySelector('#skcat-date-h')?.innerText); ck('F4 UI: fecha futura: error de fecha y NO se envía', /fecha/i.test(r4 || '') && p.reqs.filter(r => r.m === 'PUT').length === 0, r4); await p.c.close() }
    { const tr = (await call('GET', `${CAT}/territories`, AD.token)); const ids = (tr.j?.territories || []).map(x => x.id + ':' + x.status).join(','); info('F4 territorios que lee el servidor:', ids); const p = await open(AD, { url: skillUrl('comunicacion_clara') }); const boxes = await p.locator('fieldset.skcat-territories input[type=checkbox]').count(); info('F4 casillas de territorio en pantalla:', boxes, '(servidor define', (tr.j?.territories || []).filter(x => x.status === 'defined').length, 'y', (tr.j?.territories || []).length, 'en total)'); ck('F4 las casillas de la pantalla coinciden con los territorios DEFINIDOS que lee el servidor', boxes === (tr.j?.territories || []).filter(x => x.status === 'defined').length, `${boxes} vs ${(tr.j?.territories || []).filter(x => x.status === 'defined').length}`); await p.c.close() }
  }

  // ── F5 guardia al salir, guardado incierto, rúbrica no decide ──
  if (want('F5')) {
    const key = 'comunicacion_clara'
    { const p = await open(AD, { url: skillUrl(key), dialogs: 'dismiss' }); await p.locator('#skcat-label-es').fill('Cambio sin guardar'); await p.getByRole('button', { name: 'Volver al borrador' }).first().click(); await sleep(600); ck('F5 con cambios: al salir pregunta, «Cancelar» conserva la pantalla y el texto', p.dlg.length === 1 && /sin guardar/.test(p.dlg[0]) && /skills\/comunicacion_clara/.test(p.url()) && (await p.locator('#skcat-label-es').inputValue()) === 'Cambio sin guardar', p.dlg.join('|'))
      await p.goBack().catch(() => {}); await sleep(600); ck('F5 «Atrás» del navegador con cambios también pregunta', p.dlg.length >= 2 && /skills\/comunicacion_clara/.test(p.url()), p.dlg.length + ' ' + p.url()); await p.c.close() }
    { const p = await open(AD, { url: skillUrl(key), dialogs: 'accept' }); await p.locator('#skcat-label-es').fill('Cambio que se descarta'); await p.getByRole('button', { name: 'Volver al borrador' }).first().click(); await sleep(800); ck('F5 aceptando salir se va al borrador', new URL(p.url()).pathname === pageV2 && p.dlg.length === 1, p.url()); await p.c.close() }
    { const p = await open(AD, { url: skillUrl(key), dialogs: 'dismiss' }); await p.getByRole('button', { name: 'Volver al borrador' }).first().click(); await sleep(600); ck('F5 sin cambios: no pregunta', p.dlg.length === 0 && new URL(p.url()).pathname === pageV2, p.dlg.length); await p.c.close() }
    // guardado incierto (pérdida de la respuesta): el servidor aplica, el cliente no lo sabe
    { const p = await open(AD, { url: skillUrl(key) }); let first = true; await p.route('**/api/admin/skill-catalog/*/skills/*', async route => { if (route.request().method() === 'PUT' && first) { first = false; await route.fetch(); await route.abort('connectionreset') } else await route.continue() })
      await p.locator('#skcat-l3es').fill('Nivel 3 con respuesta perdida'); await p.getByRole('button', { name: 'Guardar' }).click(); await sleep(1500); const e1 = await p.evaluate(() => ({ alert: document.querySelector('[role=alert]')?.innerText, l3: document.getElementById('skcat-l3es')?.value }))
      const served = (await dbq(`SELECT rubric FROM "SkillDefinitions" WHERE "catalogId"=$1 AND "skillKey"=$2`, [V2, key]))[0].rubric.levels['3'].es
      ck('F5b respuesta perdida: el servidor guardó, la pantalla avisa (no se cree guardado) y conserva el texto', served === 'Nivel 3 con respuesta perdida' && !!e1.alert && e1.l3 === 'Nivel 3 con respuesta perdida', JSON.stringify(e1).slice(0, 200))
      await p.getByRole('button', { name: 'Guardar' }).click().catch(() => {}); await sleep(1500); const e2 = await p.evaluate(() => ({ alert: document.querySelector('.skcat-error[role=alert]')?.innerText.replace(/\s+/g, ' '), l3: document.getElementById('skcat-l3es')?.value })); info('F5b reintento tras respuesta perdida:', JSON.stringify(e2).slice(0, 220))
      ck('F5b el reintento NO pisa en silencio: o guarda sin pérdida, o avisa de conflicto con opción de cargar lo guardado', served === 'Nivel 3 con respuesta perdida' && (!e2.alert || /Otra persona|conflict|guardó/.test(e2.alert)), JSON.stringify(e2).slice(0, 200)); await p.c.close() }
    for (const lang of ['es', 'en']) { const p = await open(AD, { lang, url: skillUrl(key) }); const t1 = await txt(p); ck(`F5 ${lang}: nota «la rúbrica describe criterios; no decide el nivel» visible, sin puntuaciones ni conversión de escalas`, (lang === 'es' ? /no decide el nivel de ninguna persona/ : /does not decide anyone/).test(t1) && !/puntaje|puntuación|score|porcentaje|%/i.test(t1), ''); await p.c.close() }
    { const p = await open(AD, { url: pageV2 }); await p.getByRole('button', { name: /^Publicar…/ }).click(); await sleep(500); const t3 = await txt(p); ck('F5 publicar con revisión: muestra versión, efecto («la anterior se archiva») y botón explícito', /Publicar la versión 2/.test(t3) && /se archiva/.test(t3) && (await p.getByRole('button', { name: /Publicar versión 2/ }).count()) === 1, ''); await p.c.close() }
  }

  // ── F1 «habilidades en uso» ──
  if (want('F1')) {
    const p = await open(AD, { url: pageV2 }); const rowBtn = k => p.locator('tr', { has: p.locator(`code:text-is("${k}")`) }).getByRole('button')
    // quitar analisis_datos por la pantalla (diálogo), liderazgo_qa por la API (otra persona)
    await rowBtn('analisis_datos').click(); await sleep(900); await p.getByRole('button', { name: 'Quitar del borrador' }).click(); await sleep(500); await p.getByRole('button', { name: 'Sí, quitar' }).click(); await sleep(1300)
    await call('DELETE', `${CAT}/${V2}/skills/liderazgo_qa`, AD2.token); await p.goto('http://localhost:5173' + pageV2); await sleep(1500)
    ck('F1 la pantalla deja QUITAR del borrador una habilidad usada (el aviso va al publicar, el borrador sí se edita)', !(await txt(p)).includes('analisis_datos') && (await dbq(`SELECT count(*)::int c FROM "SkillDefinitions" WHERE "catalogId"=$1`, [V2]))[0].c === 1, '')
    await p.getByRole('button', { name: /^Publicar…/ }).click(); await sleep(500); await p.getByRole('button', { name: /^Publicar versión 2/ }).click(); await sleep(1800)
    const a = await p.evaluate(() => { const el = document.querySelector('.skcat-error[role=alert]'); return { text: el?.innerText.replace(/\s+/g, ' '), li: [...(el?.querySelectorAll('li') || [])].map(l => l.innerText.replace(/\s+/g, ' ')), focused: el === document.activeElement } })
    ck('F1 al publicar, el aviso «No se puede publicar: … niveles registrados» aparece con FOCO y role=alert', /No se puede publicar/.test(a.text || '') && a.focused, JSON.stringify(a).slice(0, 260))
    ck('F1 lista las habilidades usadas con el número de personas DISTINTAS (analisis_datos 2, liderazgo_qa 1) y sin identificarlas', a.li.some(l => /analisis_datos.*2 persona/.test(l)) && a.li.some(l => /liderazgo_qa.*1 persona/.test(l)) && !new RegExp(`${P1.email}|${P2.email}|PERSONA-1|PERSONA-2`).test(a.text || ''), a.li.join(' | '))
    ck('F1 el servidor NO publicó: v2 sigue borrador y v1 vigente', (await dbq(`SELECT status FROM "SkillCatalogs" WHERE id=$1`, [V2]))[0].status === 'draft' && (await dbq(`SELECT status FROM "SkillCatalogs" WHERE id=$1`, [V1]))[0].status === 'published', '')
    // el foco no se repite al volver a pintar: se mueve el foco y se cambia de idioma (re-render)
    await p.getByRole('button', { name: 'Volver al borrador' }).focus(); await p.getByRole('button', { name: 'EN' }).click(); await sleep(700); const f1 = await act(p)
    ck('F1 foco UNA sola vez: al re-pintar (cambio de idioma) el aviso NO roba el foco', f1 && f1.txt.trim() === 'EN' && !/alert/.test(f1.role || ''), JSON.stringify(f1))
    const en = await p.evaluate(() => document.querySelector('.skcat-error[role=alert]')?.innerText.replace(/\s+/g, ' ')); ck('F1 EN: aviso en inglés («Cannot publish… people»)', /Cannot publish/.test(en || '') && /2 people/.test(en || '') && /1 people/.test(en || ''), en)
    ck('F1 sin errores de consola ni de página', p.errs.length === 0 && p.cons.length === 0, p.errs.concat(p.cons).join('|'))
    await p.getByRole('button', { name: 'ES' }).click()
    // reincorporar las habilidades (sin la clave en el borrador) y publicar: ahora sí
    for (const [k, es, en2] of [['analisis_datos', 'Análisis de datos', 'Data analysis'], ['liderazgo_qa', 'Liderazgo QA', 'QA leadership']]) await call('PUT', `${CAT}/${V2}/skills/${k}`, AD.token, full(es, en2))
    await p.goto('http://localhost:5173' + pageV2); await sleep(1200); await p.getByRole('button', { name: /^Publicar…/ }).click(); await sleep(500); ck('F1 al volver a incluirlas desaparece el aviso y se puede publicar', (await p.locator('.skcat-error[role=alert]').count()) === 0 && await p.getByRole('button', { name: /^Publicar versión 2/ }).isEnabled(), '')
    await p.getByRole('button', { name: /^Publicar versión 2/ }).click(); await sleep(1800)
    ck('F1 publicar: v2 vigente y v1 archivada', (await dbq(`SELECT status FROM "SkillCatalogs" WHERE id=$1`, [V2]))[0].status === 'published' && (await dbq(`SELECT status FROM "SkillCatalogs" WHERE id=$1`, [V1]))[0].status === 'archived', (await txt(p)).slice(0, 100)); await p.c.close()
  }
  // A1b: estados con avisos (conflicto y «en uso») — necesitan un borrador nuevo (v3)
  if (want('A1b')) {
    const d3 = await call('POST', CAT, AD.token, {}); const V3 = d3.j.id; const pageV3 = `/admin/skill-catalog/${V3}`
    await call('DELETE', `${CAT}/${V3}/skills/analisis_datos`, AD.token); await call('DELETE', `${CAT}/${V3}/skills/liderazgo_qa`, AD.token)
    const inUse = async (p, lang) => { await p.getByRole('button', { name: lang === 'es' ? /^Publicar…/ : /^Publish…/ }).click(); await sleep(400); await p.getByRole('button', { name: lang === 'es' ? /^Publicar versión/ : /^Publish version/ }).click(); await sleep(1500) }
    const conflict = async (p, lang) => { await call('PUT', `${CAT}/${V3}/skills/comunicacion_clara`, AD2.token, full('Comunicación clara', 'Clear communication', { territories: ['con'] })); await p.locator('#skcat-l1es').fill('texto nuevo ' + Date.now()); await p.getByRole('button', { name: lang === 'es' ? 'Guardar' : 'Save' }).click(); await sleep(1500) }
    report('A1b avisos «en uso» y de conflicto', await axeStates('A1b', [['en-uso', { url: pageV3, setup: inUse }], ['conflicto', { url: `${pageV3}/skills/comunicacion_clara`, setup: conflict }]]))
  }

  // ── R1 CLS y contenido útil (390 px, CPU ×4, 10 corridas) ──
  if (want('R1')) {
    const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
    for (const [nm, url] of [['lista', '/admin/skill-catalog'], ['borrador', pageV2], ['habilidad', skillUrl('comunicacion_clara')]]) { const cls = [], t = []
      for (let i = 0; i < 10; i++) { const t0 = Date.now(); const p = await open(AD, { w: 390, h: 844, url, cpu: 4, noWait: true }); await p.waitForSelector('main h1', { timeout: 60000 }).catch(() => {}); await p.waitForSelector('main table, main form, main p[role=status], main button', { timeout: 60000 }).catch(() => {}); t.push(Date.now() - t0); await sleep(2200); cls.push(+(await p.evaluate(() => window.__cls)).toFixed(3)); await p.c.close() }
      console.log('PERF', LABEL, nm, 'contenido útil mediana', med(t), 'ms | CLS mediana', med(cls).toFixed(3), 'máx', Math.max(...cls).toFixed(3)); ck(`R1 ${nm} CLS mediana ≤ 0,1`, med(cls) <= 0.1, med(cls).toFixed(3)) }
  }
  console.log(`RESUMEN [${LABEL}]: ${total - f}/${total} OK, ${f} FALLAS`); await BR.close(); srv.close(); await DB.end(); process.exit(0)
})().catch(async e => { console.log('EXCEPCION', e.stack || e.message); try { await BR?.close() } catch {} process.exit(1) })
