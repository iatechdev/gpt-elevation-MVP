// [QA-Claude] ES-184 · PR #286 · diálogo «Aprobar» de Solicitudes (copy ES/EN). Plan A1–A8 (Jira ES-184, comentario 12201). Servidor REAL + PostgreSQL desechable, datos sintéticos, 0 IA.
// Env: PLAYWRIGHT_MODULE, QA_SUT, DATABASE_URL, QA_JWT_SECRET, AXE, DIST, API_PORT, WEB_PORT, MODE, OUT
process.env.DB_SSL = 'false'
const E = process.env; const { chromium } = require(E.PLAYWRIGHT_MODULE); const fs = require('fs'), http = require('http'), path = require('path'), crypto = require('crypto'), { createRequire } = require('module')
const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg'); const jwt = req('jsonwebtoken')
const API = `http://localhost:${E.API_PORT || 8190}`, WEB = Number(E.WEB_PORT || 5273), MODE = E.MODE || 'pr', AXE = fs.readFileSync(E.AXE, 'utf8')
const results = []; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 700) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${MODE}] ` + n, String(x).slice(0, 320)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 900) }); console.log('INFO', `[${MODE}]`, n, String(x).slice(0, 420)) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const stamp = Date.now().toString(36); let seqn = 0
const DB = new Client({ connectionString: E.DATABASE_URL, ssl: false }); const q = async (s, a = []) => (await DB.query(s, a)).rows
const sign = (u, secret = E.QA_JWT_SECRET, opts = { expiresIn: '3h' }) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, secret, { ...opts, jwtid: crypto.randomBytes(8).toString('hex') })
const call = async (u, m, p, body) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch { /* */ } return { s: r.status, j: json, text } }
const mk = async (tag, role = 'user') => { seqn++; const email = `qa184p-${tag}-${stamp}-${seqn}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA184 ' + tag, email, password: crypto.randomBytes(12).toString('base64url') + 'aA1!' }) }); await q('update "Users" set role=$1, "onboardingCompleted"=true where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: sign(u) } }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' }
const serve = () => new Promise(res => { const s = http.createServer((qq, r) => { let p = path.join(E.DIST, decodeURIComponent(qq.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(E.DIST, 'index.html'); r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r) }); s.listen(WEB, () => res(s)) })
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + ':' + v.nodes.length)) }
let BR, SU, AD, USR, THE
const open = async (user, { lang = 'es', w = 1360, tab, routes, path: pth = '/admin/content' } = {}) => {
  const c = await BR.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); if (user) await c.addInitScript(tk => { localStorage.setItem('elevation_token', tk) }, user.token)
  const p = await c.newPage(); p.errs = []; p.dialogs = []; p.reqs = []; p.popups = []; p.on('pageerror', e => p.errs.push(e.message.slice(0, 140))); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text().slice(0, 160)) })
  p.on('dialog', d => { p.dialogs.push(d.type() + ':' + d.message()); d.dismiss().catch(() => {}) }); p.on('request', r => { const u = new URL(r.url()); if (u.origin === API) p.reqs.push({ m: r.method(), p: u.pathname + u.search, auth: !!r.headers()['authorization'] }) })
  c.on('page', np => { p.popupPages = (p.popupPages || []); p.popupPages.push(np) }); await c.route('https://example.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>simulado</title>' }))
  if (routes) await routes(p); await p.goto(`http://localhost:${WEB}${pth}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('h1', { timeout: 20000 }).catch(() => {})
  if (lang === 'en') await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await sleep(900)
  if (tab) { await p.getByRole('tab', { name: new RegExp('^' + tab) }).first().click().catch(() => {}); await sleep(1000) } return { c, p } }
const body = async p => (await p.locator('body').innerText()).replace(/\s+/g, ' ')
const T = { es: { v: 'Validaciones', a: 'Solicitudes', pl: 'Planes', tx: 'Textos públicos' }, en: { v: 'Validations', a: 'Applications', pl: 'Plans', tx: 'Public texts' } }
const sec = async (name, fn) => { try { await fn() } catch (e) { ck(`${name}: EXCEPCIÓN`, false, (e.stack || e.message).slice(0, 500)) } }
;(async () => {
  await DB.connect(); BR = await chromium.launch(); const srv = await serve(); SU = await mk('su', 'superadmin'); AD = await mk('ad', 'admin'); USR = await mk('user'); THE = await mk('the', 'therapist')
  const { makeSeeder } = req(path.join(E.QA_SUT, 'backend', 'test', 'support', 'seedRow.cjs')); const seed = makeSeeder(q)
  await q('delete from "ProfessionalApplications"'); await q('delete from "TherapistValidations"')
  const rnd = () => crypto.randomBytes(3).toString('hex')
  const app = (o = {}) => seed('ProfessionalApplications', { name: 'Persona ' + rnd(), email: `p-${rnd()}-${stamp}@example.test`, country: 'Chile', profession: 'Psicología', licenseNumber: 'REG-1', profileUrl: 'https://example.test/perfil', message: 'Mensaje de prueba', status: 'pending', consentAt: new Date(), ...o })
  const doc = async n => { const t = await mk('doc' + n, 'therapist'); return seed('TherapistValidations', { therapistId: t.id, documentType: 'titulo', documentName: `titulo-${n}.pdf`, documentPath: `therapist-docs/${t.id}/titulo-${n}.pdf`, status: 'pending' }) }
  const TXT = { es: 'Aprobar esta solicitud no crea ni activa una cuenta. Después, usa «Crear cuenta de profesional».', en: 'Approving this application does not create or activate an account. Use “Create professional account” afterward.' }
  const OLD = { es: 'Queda activa en la plataforma y puede recibir personas.', en: 'It becomes active on the platform and can receive people.' }
  const REJ = { es: 'El motivo lo verá la persona.', en: 'The person will see the reason.' }
  const a1 = await app({ name: 'Ana Lopez' }), a2 = await app({ name: 'Beto Dos' }), a3 = await app({ name: 'Cami Tres' }); const v1 = await doc(1)
  const usersBefore = (await q('select count(*)::int c from "Users"'))[0].c
  const sel = 'section[aria-labelledby="applications-title"]'
  // A1/A2/A5/A6: diálogos aprobar y rechazar, ES/EN × 320/390/1360
  for (const lang of ['es', 'en']) for (const w of [320, 390, 1360]) {
    const { c, p } = await open(SU, { lang, w, tab: T[lang].a }); const tg = `${lang}/${w}`
    const li = p.locator(`${sel} li`, { hasText: 'Ana Lopez' }).first(); await li.getByRole('button', { name: lang === 'es' ? 'Aprobar' : 'Approve', exact: true }).click(); await sleep(500)
    const dlg = p.getByRole('dialog'); const dt = (await dlg.innerText()).replace(/\s+/g, ' ')
    ck(`A1 ${tg} aprobar: texto nuevo exacto`, dt.includes(TXT[lang]), dt.slice(0, 200)); ck(`A1 ${tg} aprobar: sin el texto viejo`, !dt.includes(OLD[lang]) && !dt.includes(OLD.es))
    ck(`A5 ${tg} vocabulario`, !/terapeuta|therapist/i.test(dt)); if (lang === 'en') ck(`A5 ${tg} EN sin español`, !/[áíóúñ¿¡«»]/i.test(dt) && !/\b(Aprobar|Nota|Cancelar|solicitud)\b/.test(dt), dt.slice(0, 160))
    const ax = await axeRun(p); ck(`A6 ${tg} axe=0 con el diálogo`, ax.length === 0, ax.join(','))
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`A6 ${tg} sin desborde horizontal`, ov <= 0, ov)
    const box = await dlg.locator('.cg-hint').first().evaluate(e => ({ sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth })).catch(() => null); ck(`A6 ${tg} texto del aviso no truncado`, !box || (box.sh <= box.ch + 1 && box.sw <= box.cw + 1), JSON.stringify(box))
    await p.keyboard.press('Escape'); await sleep(400); ck(`A6 ${tg} Esc cierra el diálogo`, (await p.getByRole('dialog').count()) === 0)
    const foc = await p.evaluate(() => document.activeElement && (document.activeElement.textContent || '').trim()); ck(`A6 ${tg} foco vuelve al botón Aprobar`, /Aprobar|Approve/.test(foc || ''), foc)
    await li.getByRole('button', { name: lang === 'es' ? 'Rechazar' : 'Reject', exact: true }).click(); await sleep(500); const rt = (await p.getByRole('dialog').innerText()).replace(/\s+/g, ' ')
    ck(`A2 ${tg} rechazar conserva su texto`, rt.includes(REJ[lang]) && !rt.includes(TXT[lang]), rt.slice(0, 160)); await p.keyboard.press('Escape'); ck(`${tg} sin errores de consola`, p.errs.length === 0, p.errs.join('|')); await c.close() }
  // A3: aprobar contra el servidor real: no crea ni activa cuenta
  { const { c, p } = await open(SU, { lang: 'es', tab: 'Solicitudes' }); const li = p.locator(`${sel} li`, { hasText: 'Beto Dos' }).first(); await li.getByRole('button', { name: 'Aprobar', exact: true }).click(); await sleep(400)
    await p.locator('#application-note').fill('revisada'); await p.getByRole('button', { name: 'Confirmar aprobación', exact: true }).click(); await sleep(1500)
    const st = (await q('select status,"reviewNote" from "ProfessionalApplications" where id=$1', [a2.id]))[0]; const usersAfter = (await q('select count(*)::int c from "Users"'))[0].c; const withMail = (await q('select count(*)::int c from "Users" where email=(select email from "ProfessionalApplications" where id=$1)', [a2.id]))[0].c
    ck('A3 la solicitud queda aprobada con la nota', st && st.status === 'approved' && st.reviewNote === 'revisada', JSON.stringify(st)); ck('A3 NO se crea ninguna cuenta (el texto no miente)', usersAfter === usersBefore && withMail === 0, `antes=${usersBefore} despues=${usersAfter} conCorreo=${withMail}`)
    await p.getByRole('button', { name: 'Todas', exact: true }).click(); await sleep(1200); const rowTxt = (await p.locator(sel).innerText()).replace(/\s+/g, ' '); ck('A3 «Crear cuenta de profesional» sigue disponible', /Crear cuenta de profesional/.test(rowTxt), rowTxt.slice(0, 200))
    await p.getByRole('button', { name: /Crear cuenta de profesional/ }).first().click().catch(() => p.getByRole('link', { name: /Crear cuenta de profesional/ }).first().click()); await sleep(1200); ck('A3 lleva a /admin/users sin datos en la URL', new URL(p.url()).pathname === '/admin/users' && !new URL(p.url()).search, p.url()); await c.close() }
  // A4: Validaciones conserva su propio texto
  for (const lang of ['es', 'en']) { const { c, p } = await open(SU, { lang, tab: T[lang].v }); const li = p.locator('section[aria-labelledby="validations-title"] li').first(); await li.getByRole('button', { name: lang === 'es' ? 'Aprobar' : 'Approve', exact: true }).click(); await sleep(500)
    const dt = (await p.getByRole('dialog').innerText()).replace(/\s+/g, ' '); ck(`A4 ${lang} Validaciones conserva «${OLD[lang].slice(0, 30)}…»`, dt.includes(OLD[lang]) && !dt.includes(TXT[lang]), dt.slice(0, 200)); await c.close() }
  const sm = (await q('select status from "TherapistValidations" where id=$1', [v1.id]))[0].status; ck('A4 aprobar-abrir no cambió la validación sin confirmar', sm === 'pending', sm)
  console.log('RESUMEN ' + JSON.stringify({ modo: MODE, total: results.filter(r => 'ok' in r).length, fallas: f })); fs.writeFileSync(path.join(E.OUT || '.', `ES-184-286-${MODE}.json`), JSON.stringify(results, null, 1)); await BR.close(); srv.close(); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 600)); process.exit(3) })
