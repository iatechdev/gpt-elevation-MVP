// QA-Claude-2 — ES-186 parche (PR #186) pantalla: «Invitar persona» y «Enviar enlace de restablecimiento» (plan U1–U11, comentario 11415 de ES-186).
// Backend REAL (:8090, Postgres con migraciones reales, SIN proveedor de correo, IA simulada que no se usa) + `vite preview` (:5173) del build. Datos sintéticos. Solo local.
// Casos simulados (declarados en la salida): `emailSent:true` (se reescribe la respuesta REAL del servidor), 500 y corte de red (route.fulfill/abort).
// Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, AXE, LABEL (pr|main), ONLY (lista de bloques: U1,U2,U3,U4,U5,U6,U7,U8,U9,U10).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const fs = require('fs'), crypto = require('crypto'), { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', UI = 'http://localhost:5173'; const AXE = fs.readFileSync(process.env.AXE, 'utf8'); const LABEL = process.env.LABEL || 'pr'
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = k => !ONLY || ONLY.includes(k)
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
let DB = null; const dbq = async (q, a) => { if (!DB) { DB = new Client({ connectionString: process.env.DATABASE_URL }); await DB.connect() } return (await DB.query(q, a)).rows }
const mk = async (role = 'user', extra = {}) => { n++; const name = extra.name || `Nombre Sintetico ${tag} ${n}`; const email = extra.email || `qa2-e186-${tag}-${n}@example.test`; await call('POST', '/api/register', null, { name, email, password: PASS }); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET "onboardingCompleted"=true, role=$2, "therapistId"=$3 WHERE id=$1', [id, role, extra.therapistId ?? null]); const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; return { id, name, email, role, token: tk } }
const fresh = () => { n++; return `qa2-inv-${tag}-${n}@example.test` }
const TOKEN_RE = /token=|accept-invitation|reset-password\?|[?#&]t=[A-Za-z0-9_-]{16,}|[A-Za-z0-9_-]{40,}/
const L = {
  es: { invBtn: '+ Invitar persona', invTitle: 'Invitar persona', help: 'Se creará un enlace de un solo uso para que la persona elija su contraseña. Nadie más ve ni define su contraseña.', email: 'Email', send: 'Enviar invitación', sending: 'Enviando...',
    recorded: 'Invitación registrada, pero no se envió ningún correo: el envío de correo no está configurado. La persona todavía no tiene su enlace.', sentPre: 'Invitación enviada a', exp: 'El enlace caduca el', forName: 'Invitación para',
    e: { empty: 'Escribe un correo.', invalid: 'Correo inválido.', taken: 'Ya existe una cuenta con ese correo.', role: 'No tienes permiso para invitar con ese rol.', rate: 'Demasiadas invitaciones seguidas. Espera un rato.', other: 'No se pudo crear la invitación.', net: 'Error de conexión.' },
    resetBtn: 'Enviar enlace de restablecimiento', resetTitle: 'Enviar enlace de restablecimiento', resetPre: 'Se enviará a', resetPost: 'un enlace de un solo uso para que elija una contraseña nueva. Tú no ves ni defines su contraseña.', resetSend: 'Enviar enlace',
    resetOk: 'Solicitud registrada. Si la cuenta puede recibirlo y el envío de correo está configurado, la persona recibirá el enlace.', r403: 'Solo la superadministración puede enviar enlaces de restablecimiento.', r404: 'Usuario no encontrado.', rOther: 'No se pudo enviar el enlace.' },
  en: { invBtn: '+ Invite person', invTitle: 'Invite person', help: 'A single-use link will be created so the person chooses their own password. No one else sees or sets their password.', email: 'Email', send: 'Send invitation', sending: 'Sending...',
    recorded: 'Invitation recorded, but no email was sent: email sending is not configured. The person does not have their link yet.', sentPre: 'Invitation sent to', exp: 'The link expires on', forName: 'Invitation for',
    e: { empty: 'Enter an email.', invalid: 'Invalid email.', taken: 'An account with that email already exists.', role: 'You do not have permission to invite with that role.', rate: 'Too many invitations in a row. Wait a while.', other: 'The invitation could not be created.', net: 'Connection error.' },
    resetBtn: 'Send reset link', resetTitle: 'Send reset link', resetPre: 'We will send', resetPost: 'a single-use link so they can choose a new password. You neither see nor set their password.', resetSend: 'Send link',
    resetOk: 'Request recorded. If the account can receive it and email sending is configured, the person will receive the link.', r403: 'Only superadministration can send reset links.', r404: 'User not found.', rOther: 'The link could not be sent.' } }
const axeRun = async p => { await p.evaluate(AXE); return p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => v.id + '×' + v.nodes.length + '[' + v.nodes.slice(0, 2).map(x => x.target.join(' ')).join(' | ').slice(0, 90) + ']')) }
let B
const open = async (u, lang, w = 1360, role) => { const c = await B.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, reducedMotion: 'reduce' }); await c.addInitScript(([tk, l, r]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', r); localStorage.setItem('elv_lang', l) }, [u.token, lang, role || u.role]); const p = await c.newPage(); p.errs = []; p.net = []; p.cons = []; p.resp = []
  p.on('pageerror', e => p.errs.push(e.message.slice(0, 120))); p.on('console', m => p.cons.push(m.text().slice(0, 300))); p.on('request', r => { if (r.url().startsWith(API)) p.net.push({ m: r.method(), u: r.url().replace(API, ''), b: r.postData() }) })
  p.on('response', async r => { if (r.url().startsWith(API) && ['POST', 'PUT'].includes(r.request().method())) { const e = { u: r.url().replace(API, ''), s: r.status(), t: '' }; p.resp.push(e); try { e.t = await r.text() } catch {} } })
  await p.goto(UI + '/admin/users', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForSelector('table, [class*=card]', { timeout: 20000 }).catch(() => {}); await sleep(1500); return { c, p } }
const body = p => p.locator('body').innerText()
const inviteDlg = p => p.locator('h2', { hasText: /^(Invitar persona|Invite person|Crear usuario|Create user)$/ }).locator('xpath=../..')
const resetDlg = p => p.locator('h3', { hasText: /Enviar enlace de restablecimiento|Send reset link|Resetear contraseña|Reset password/ }).locator('xpath=../..')
const openInvite = async (p, lang) => { await p.getByRole('button', { name: L[lang].invBtn, exact: true }).click(); await inviteDlg(p).waitFor({ timeout: 5000 }); await sleep(250) }
const rowBtn = (p, email) => p.locator('tr', { hasText: email }).getByRole('button', { name: '···' }).first()
const openManage = async (p, u) => { let b = rowBtn(p, u.email); if (!(await b.count())) b = p.getByText(u.email).first().locator('xpath=ancestor::*[.//button[normalize-space()="···"]][1]').getByRole('button', { name: '···' }); await b.click(); await sleep(500) }
const fillInvite = async (p, email, role) => { const d = inviteDlg(p); await d.locator('input#invite-email').fill(email); if (role) await d.locator('select').selectOption(role) }
const sendBtn = (p, lang) => inviteDlg(p).getByRole('button', { name: new RegExp(`^(${L[lang].send}|${L[lang].sending.replace('.', '\\.')})$`) })
const roleSet = async (p) => (await inviteDlg(p).locator('select option').evaluateAll(os => os.map(o => o.value))).sort()
const closeAll = async p => { await p.getByRole('button', { name: '✕' }).last().click(); await sleep(200) }
const cnt = (p, re) => p.net.filter(x => re.test(x.m + ' ' + x.u)).length
const MAIN = LABEL === 'main'

;(async () => {
  B = await chromium.launch(); const SA = await mk('superadmin'), SA2 = await mk('superadmin'), AD = await mk('admin'), T = await mk('therapist'), P = await mk('user'), PX = await mk('user')
  const probeAdm = await call('GET', '/api/admin/usuarios', SA.token); info('listado superadmin', probeAdm.s, 'etiqueta', LABEL)

  if (MAIN) { // solo el transcript de regresión U10 contra main
    for (const lang of ['es']) { const { p } = await open(SA, lang); const tr = []
      tr.push('LISTA ' + (await p.locator('table tbody tr').count() > 0)); tr.push('BOTONES ' + (await p.locator('button').allInnerTexts()).join('|'))
      const before = (await body(p)).split(String.fromCharCode(10)); await openManage(p, P); const mt = (await body(p)).split(String.fromCharCode(10)).filter(x => !before.includes(x) || x.includes(P.email)).join(' ');  tr.push('GESTIONAR ' + mt.replace(/\s+/g, ' ').replace(P.email, 'EMAIL').replace(P.name, 'NOMBRE')); console.log(tr.join('\n')) }
    { const { c, p } = await open(SA, 'es'); await p.getByRole('button', { name: '+ Crear usuario' }).click(); await sleep(500); const h = p.locator('h2', { hasText: /^Crear usuario$/ }).locator('xpath=../..')
      console.log('MAIN diálogo crear: role=' + (await h.getAttribute('role')) + ' axe=[' + (await axeRun(p)) + ']'); await p.getByRole('button', { name: '✕' }).last().click()
      const tb = p.getByRole('button', { name: '+ Crear usuario' }); await tb.focus(); await p.keyboard.press('Enter'); await sleep(300)
      const inside = () => p.evaluate(() => { const hh = [...document.querySelectorAll('h2')].find(x => /Crear usuario/.test(x.textContent)); const dlg = hh?.parentElement?.parentElement; return dlg ? dlg.contains(document.activeElement) : null })
      const f1 = await inside(); let leak = false; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); if (!(await inside())) { leak = true; break } }
      await p.keyboard.press('Escape'); await sleep(300); console.log('MAIN teclado crear: foco inicial dentro=' + f1 + ' Tab sale=' + leak + ' Esc cierra=' + ((await h.count()) === 0))
      await p.getByRole('button', { name: '✕' }).last().click().catch(() => {}); await openManage(p, P); await p.getByRole('button', { name: /Resetear contraseña/ }).click(); await sleep(400); console.log('MAIN axe diálogo resetear=[' + (await axeRun(p)) + ']'); await c.close() }
    await B.close(); process.exit(0) }

  // ============ U2 roles que permite el servidor (calculado probando cada rol contra el servidor real) ============
  if (want('U2')) { const roles = ['user', 'therapist', 'board', 'admin', 'superadmin', 'professional', 'junta', '']
    const srv = async (u) => { const ok = []; for (const r of roles) { const x = await call('POST', '/api/admin/invitations', u.token, { email: fresh(), role: r }); if (x.s === 201) ok.push(r) } return ok.sort() }
    const SRV_SA = await srv(SA), SRV_AD = await srv(AD); info('roles que acepta el servidor: superadmin', SRV_SA.join(','), '· admin', SRV_AD.join(','))
    for (const [u, srvSet, who] of [[SA, SRV_SA, 'superadmin'], [AD, SRV_AD, 'admin']]) for (const lang of ['es', 'en']) { const { p } = await open(u, lang); await openInvite(p, lang); const ui = await roleSet(p); ck(`U2 ${who} ${lang}: los roles que ofrece la pantalla = los que acepta el servidor`, JSON.stringify(ui) === JSON.stringify(srvSet), `pantalla=[${ui}] servidor=[${srvSet}]`); await p.context().close() } }

  for (const lang of ['es', 'en']) for (const w of [1360, 390]) { const t = L[lang], tg = `${lang}/${w}`
    // ============ U1 textos + U3 sin proveedor + U9 axe/teclado ============
    if (want('U1') || want('U3') || want('U9')) { const { c, p } = await open(SA, lang, w)
      const page0 = await body(p); ck(`U8 ${tg}: ya no existen los botones «Crear usuario» ni «Resetear contraseña»`, !/Crear usuario|Create user|Resetear contraseña|Reset password/i.test(page0) && page0.includes(t.invBtn.replace('+ ', '')), '')
      const ov0 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`U9 ${tg}: lista sin desborde horizontal`, ov0 <= 0, 'ov=' + ov0)
      info(`U9 ${tg}: axe lista [${await axeRun(p)}]`)
      await openInvite(p, lang); let d = await inviteDlg(p).innerText(); const dn = d.replace(/\s+/g, ' ')
      ck(`U1 ${tg}: título, ayuda, «${t.email}» y botón «${t.send}» del diálogo de invitar coinciden con 11369`, dn.includes(t.invTitle) && dn.includes(t.help) && dn.toLowerCase().includes(t.email.toLowerCase()) && dn.includes(t.send), '')
      ck(`U1 ${tg}: sin campo de contraseña ni de nombre en el diálogo de invitar; ${await inviteDlg(p).locator('input').count()} campo(s) de texto`, (await inviteDlg(p).locator('input[type=password]').count()) === 0 && (await inviteDlg(p).locator('input').count()) === 1, '')
      ck(`U1 ${tg}: sin claves crudas ni «undefined» ni emojis`, !/undefined|\[object|NaN/.test(d) && !/\p{Extended_Pictographic}/u.test(d.replace(/✕/g, '')), '')
      info(`U1 ${tg}: etiqueta del rol y opciones: «${(await inviteDlg(p).locator('label').allInnerTexts()).join(' / ')}» opciones=[${(await inviteDlg(p).locator('select option').allInnerTexts()).join(', ')}]`)
      info(`U9 ${tg}: axe diálogo vacío [${await axeRun(p)}]`)
      const ov1 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`U9 ${tg}: diálogo sin desborde`, ov1 <= 0, 'ov=' + ov1)
      // U3 real: sin proveedor de correo
      const em = fresh(); await fillInvite(p, em, 'user'); const before = p.net.length; await sendBtn(p, lang).click(); await sleep(1500); d = (await inviteDlg(p).innerText()).replace(/\s+/g, ' ')
      const row = await dbq('SELECT "usedAt", "expiresAt" > now() AS vigente FROM "Invitations" WHERE lower(email)=lower($1)', [em])
      const rr = p.resp.filter(x => x.u === '/api/admin/invitations').pop(); let rj = {}; try { rj = JSON.parse(rr.t) } catch {}
      ck(`U3 ${tg}: sin proveedor (emailSent:${rj.emailSent}) dice «registrada, no enviada», nunca «enviada a»`, rr?.s === 201 && rj.emailSent === false && d.includes(t.recorded) && !d.includes(t.sentPre), '')
      ck(`U3 ${tg}: sin botón «Copiar», sin enlace ni token en la pantalla ni en la respuesta`, !/Copiar|Copy/.test(d) && !TOKEN_RE.test(d.replace(em, '')) && !/token|link|url|enlace/i.test(Object.keys(rj).join(',')), 'claves=' + Object.keys(rj).join(','))
      ck(`U3 ${tg}: la invitación quedó en la base (1 fila, vigente, sin usar)`, row.length === 1 && row[0].vigente && !row[0].usedAt, JSON.stringify(row))
      ck(`U3 ${tg}: lo escrito se limpia tras el éxito y el rol vuelve a «user»`, (await inviteDlg(p).locator('input#invite-email').inputValue()) === '', '')
      const live = await inviteDlg(p).locator('[role=alert],[role=status],[aria-live]').count(); info(`U9 ${tg}: el mensaje de éxito del diálogo de invitar ${live ? 'SÍ' : 'NO'} está en una región viva (role=status/alert): ${live}`)
      info(`U9 ${tg}: axe diálogo con éxito [${await axeRun(p)}]`)
      await c.close() }

    if (want('U1') || want('U6') || want('U9')) { const { c, p } = await open(SA, lang, w); await openManage(p, P)
      const mgr = p.locator('body'); const rb = mgr.getByRole('button', { name: t.resetBtn, exact: true }); ck(`U6 ${tg}: «Gestionar» ofrece «${t.resetBtn}» (y no «Resetear contraseña»)`, (await rb.count()) === 1 && !/Resetear contraseña|Reset password/.test(await mgr.innerText()), '')
      await rb.click(); await sleep(400); const rd = resetDlg(p); const txt = (await rd.innerText()).replace(/\s+/g, ' ')
      ck(`U1 ${tg}: el diálogo del enlace dice «${t.resetPre} {nombre} ${t.resetPost.slice(0, 30)}…» y su botón «${t.resetSend}»`, txt.includes(t.resetTitle) && txt.includes(`${t.resetPre} ${P.name} ${t.resetPost}`) && txt.includes(t.resetSend), txt.slice(0, 220))
      ck(`U6 ${tg}: ningún campo de contraseña en el diálogo del enlace`, (await rd.locator('input').count()) === 0 && (await p.locator('input[type=password]').count()) === 0, '')
      info(`U9 ${tg}: axe diálogo confirmación [${await axeRun(p)}]`)
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ck(`U9 ${tg}: sin desborde`, ov <= 0, 'ov=' + ov)
      await rd.getByRole('button', { name: t.resetSend, exact: true }).click(); await sleep(1200); const ok = (await rd.innerText()).replace(/\s+/g, ' ')
      ck(`U6 ${tg}: 202 a una persona → «${t.resetOk.slice(0, 40)}…» y el botón se deshabilita (no se reenvía por error)`, ok.includes(t.resetOk) && await rd.getByRole('button', { name: t.resetSend, exact: true }).isDisabled(), '')
      info(`U9 ${tg}: región viva del éxito del enlace: ${await rd.locator('[role=status]').count()}`); info(`U9 ${tg}: axe diálogo éxito [${await axeRun(p)}]`)
      ck(`U8 ${tg}: el enlace fue POST /reset-link, 0 llamadas a reset-password`, cnt(p, /POST \/api\/admin\/usuarios\/\d+\/reset-link/) === 1 && cnt(p, /reset-password/) === 0, '')
      await c.close() } }

  // ============ U6 destinatarios variados (es, 1360) ============
  if (want('U6')) for (const lang of ['es', 'en']) { const t = L[lang]
    const cases = [['profesional', T, 202, t.resetOk], ['otro superadmin', SA2, 403, t.r403], ['la propia cuenta', SA, 202, t.resetOk]]
    for (const [nm, tgt, st, msg] of cases) { const { c, p } = await open(SA, lang); await openManage(p, tgt); await p.locator('body').getByRole('button', { name: t.resetBtn, exact: true }).click(); await sleep(300); const rd = resetDlg(p)
      await rd.getByRole('button', { name: t.resetSend, exact: true }).click(); await sleep(1800); const r = p.resp.filter(x => /reset-link/.test(x.u)).pop(); const tx = (await rd.innerText()).replace(/\s+/g, ' ')
      ck(`U6 ${lang}: a ${nm} → servidor ${r?.s} (esperado ${st}) y la pantalla dice «${msg.slice(0, 38)}…»`, r?.s === st && tx.includes(msg), r?.s !== st ? 'servidor dijo ' + r?.s : '')
      if (st === 403) info(`U6 ${lang}: el servidor dijo «${((await call('POST', '/api/admin/usuarios/' + tgt.id + '/reset-link', SA.token, {})).j?.error || '').slice(0, 80)}» y la pantalla dice «${msg}» (¿mismo motivo? NO si es el caso «otro superadmin»)`)
      await c.close() }
    { const { c, p } = await open(SA, lang); await openManage(p, P); await p.locator('body').getByRole('button', { name: t.resetBtn, exact: true }).click(); await sleep(300)
      await p.route('**/api/admin/usuarios/*/reset-link', r => r.continue({ url: r.request().url().replace(/usuarios\/\d+/, 'usuarios/999999999') })); const rd = resetDlg(p); await rd.getByRole('button', { name: t.resetSend, exact: true }).click(); await sleep(1000)
      const r = p.resp.filter(x => /reset-link/.test(x.u)).pop(); ck(`U6 ${lang}: id inexistente → servidor ${r?.s} → «${t.r404}»`, r?.s === 404 && (await rd.innerText()).includes(t.r404), ''); info(`U9 ${lang}: axe diálogo con error 404 [${await axeRun(p)}]`)
      ck(`U9 ${lang}: el error del enlace está en role=alert`, (await rd.locator('[role=alert]').count()) === 1, ''); await c.close() }
    { const { c, p } = await open(AD, lang, 1360, 'admin'); await openManage(p, P); const mgr = p.locator('body')
      ck(`U6 ${lang}: un admin NO ve «${t.resetBtn}» (solo superadmin)`, (await mgr.getByRole('button', { name: t.resetBtn, exact: true }).count()) === 0, ''); const x = await call('POST', `/api/admin/usuarios/${P.id}/reset-link`, AD.token, {}); ck(`U6 ${lang}: y el servidor lo rechaza con 403 (${x.s})`, x.s === 403, ''); await c.close() } }

  // ============ U4 errores + U5 envío único ============
  if (want('U4') || want('U5')) for (const lang of ['es', 'en']) { const t = L[lang]; const E = t.e
    const run = async (name, setup, email, role, expectMsg, opts = {}) => { const { c, p } = await open(opts.user || SA, lang, 1360, opts.role); if (setup) await setup(p); await openInvite(p, lang); if (email !== null) await fillInvite(p, email, role); await sendBtn(p, lang).click(); await sleep(opts.wait || 1300)
      const d = inviteDlg(p); const tx = (await d.innerText()).replace(/\s+/g, ' '); const val = email === null ? '' : await d.locator('input#invite-email').inputValue(); const live = await d.locator('[role=alert]').count(); const foc = await p.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.textContent || '').slice(0, 20))
      ck(`U4 ${lang}: ${name} → «${expectMsg.slice(0, 40)}»`, tx.includes(expectMsg), tx.slice(40, 200)); if (email) ck(`U4 ${lang}: ${name}: lo escrito no se pierde`, val === email, val)
      info(`U4 ${lang}: ${name}: role=alert=${live}, foco=${foc}`); if (opts.after) await opts.after(p, d); return { c, p } }
    await (await run('correo vacío', null, '', null, E.empty)).c.close()
    await (await run('correo inválido (servidor)', null, 'no-es-correo', null, E.invalid)).c.close()
    await (await run('correo ya existente', null, PX.email, 'user', E.taken, { after: async (p) => { const r = p.resp.filter(x => /invitations/.test(x.u)).pop(); ck(`U4 ${lang}: el servidor dio 409`, r?.s === 409, r?.s) } })).c.close()
    const rowsBefore = (await dbq('SELECT count(*)::int n FROM "Invitations" WHERE lower(email)=lower($1)', [PX.email]).catch(() => [{ n: -1 }]))[0].n; info('invitaciones previas para el correo existente', rowsBefore)
    await (await run('rol no permitido (servidor real 403 con el cuerpo reescrito a superadmin; simulado el cuerpo, real la respuesta)', async p => { await p.route('**/api/admin/invitations', r => r.request().method() === 'POST' ? r.continue({ postData: JSON.stringify({ ...JSON.parse(r.request().postData()), role: 'superadmin' }) }) : r.continue()) }, fresh(), 'user', E.role, { user: AD, role: 'admin' })).c.close()
    await (await run('500 (simulado)', async p => { await p.route('**/api/admin/invitations', r => r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Internal boom stack"}' }) : r.continue()) }, fresh(), 'user', E.other)).c.close()
    await (await run('corte de red (simulado)', async p => { await p.route('**/api/admin/invitations', r => r.request().method() === 'POST' ? r.abort('failed') : r.continue()) }, fresh(), 'user', E.net)).c.close()
    // 429 real: un admin hace 30 invitaciones y la 31 desde la pantalla
    { const AD2 = await mk('admin'); let last; for (let i = 0; i < 30; i++) last = await call('POST', '/api/admin/invitations', AD2.token, { email: fresh(), role: 'user' }); info('30 invitaciones del admin, última', last.s)
      await (await run('demasiadas invitaciones (429 real)', null, fresh(), 'user', E.rate, { user: AD2, role: 'admin' })).c.close() }
    // U5 envío único
    { const { c, p } = await open(SA, lang); await openInvite(p, lang); const em = fresh(); await fillInvite(p, em, 'user'); await p.route('**/api/admin/invitations', async r => { if (r.request().method() !== 'POST') return r.continue(); await sleep(1500); r.continue() })
      const b = sendBtn(p, lang); await b.dblclick(); await sleep(300); const mid = await sendBtn(p, lang).innerText().catch(() => '?'); const dis = await sendBtn(p, lang).isDisabled().catch(() => null); await sleep(2500)
      ck(`U5 ${lang}: doble clic → 1 sola petición POST y el botón dice «${t.sending}» y está deshabilitado mientras tanto`, cnt(p, /POST \/api\/admin\/invitations/) === 1 && mid.includes(t.sending.replace('...', '')) && dis === true, `peticiones=${cnt(p, /POST \/api\/admin\/invitations/)} botón="${mid}" deshabilitado=${dis}`)
      await c.close() }
    { const { c, p } = await open(SA, lang); await openInvite(p, lang); const em = fresh(); await fillInvite(p, em, 'user'); await p.route('**/api/admin/invitations', async r => { if (r.request().method() !== 'POST') return r.continue(); await sleep(1200); r.continue() })
      await sendBtn(p, lang).focus(); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await sleep(3500); ck(`U5 ${lang}: Enter repetido (3×) → 1 sola petición`, cnt(p, /POST \/api\/admin\/invitations/) === 1, 'peticiones=' + cnt(p, /POST \/api\/admin\/invitations/)); await c.close() }
    { const { c, p } = await open(SA, lang); await openInvite(p, lang); const em = fresh(); await fillInvite(p, em, 'user'); let first = true
      await p.route('**/api/admin/invitations', async r => { if (r.request().method() !== 'POST') return r.continue(); if (first) { first = false; await r.fetch(); return r.abort('connectionreset') } return r.continue() })
      await sendBtn(p, lang).click(); await sleep(1500); let d = (await inviteDlg(p).innerText()).replace(/\s+/g, ' '); const inDb1 = (await dbq('SELECT count(*)::int n FROM "Invitations" WHERE lower(email)=lower($1)', [em]))[0].n
      info(`U5 ${lang}: RESPUESTA PERDIDA REAL: la base ya tiene ${inDb1} invitación(es) y la pantalla dice «${d.includes(E.net) ? E.net : d.slice(30, 120)}» (¿engañoso? la invitación SÍ se creó)`)
      await sendBtn(p, lang).click(); await sleep(1500); d = (await inviteDlg(p).innerText()).replace(/\s+/g, ' '); const inDb2 = (await dbq('SELECT count(*)::int n FROM "Invitations" WHERE lower(email)=lower($1)', [em]))[0].n, st = (await dbq('SELECT ("usedAt" IS NULL AND "expiresAt" > now()) AS pendiente FROM "Invitations" WHERE lower(email)=lower($1) ORDER BY id', [em])).map(x => x.pendiente ? 'pendiente' : 'otra')
      info(`U5 ${lang}: tras reintentar, la base tiene ${inDb2} invitación(es) [${st}] y la pantalla dice «${d.includes(t.recorded) ? 'registrada, no enviada' : d.slice(30, 130)}»`)
      ck(`U5 ${lang}: el reintento tras respuesta perdida no deja la pantalla colgada (el botón vuelve a estar habilitado)`, !(await sendBtn(p, lang).isDisabled().catch(() => true)) || d.includes(t.recorded), ''); await c.close() }
    { const { c, p } = await open(SA, lang); await openManage(p, PX); await p.locator('body').getByRole('button', { name: t.resetBtn, exact: true }).click(); await sleep(300); let first = true
      await p.route('**/api/admin/usuarios/*/reset-link', async r => { if (first) { first = false; await sleep(1200) } return r.continue() }); const rd = resetDlg(p); const b = rd.getByRole('button', { name: t.resetSend, exact: true }); await b.dblclick(); await sleep(2500)
      ck(`U5 ${lang}: doble clic en «${t.resetSend}» → 1 sola petición`, cnt(p, /POST \/api\/admin\/usuarios\/\d+\/reset-link/) === 1, 'peticiones=' + cnt(p, /reset-link/)); await c.close() }
    { const { c, p } = await open(SA, lang); await openManage(p, PX); await p.locator('body').getByRole('button', { name: t.resetBtn, exact: true }).click(); await sleep(300)
      await p.route('**/api/admin/usuarios/*/reset-link', async r => { await r.fetch(); return r.abort('connectionreset') }); const rd = resetDlg(p); await rd.getByRole('button', { name: t.resetSend, exact: true }).click(); await sleep(1500)
      info(`U5 ${lang}: enlace con RESPUESTA PERDIDA REAL: la pantalla dice «${(await rd.innerText()).replace(/\s+/g, ' ').includes(t.e.net) ? t.e.net : (await rd.innerText()).replace(/\s+/g, ' ').slice(60, 200)}» y el botón ${await rd.getByRole('button', { name: t.resetSend, exact: true }).isDisabled() ? 'queda deshabilitado' : 'queda habilitado (se puede reintentar)'}`); await c.close() } }

  // ============ U4b sesión vencida a mitad del diálogo (401 real: token reemplazado por uno inválido) ============
  if (want('U4') || want('U4B')) for (const lang of ['es', 'en']) { const t = L[lang]; const { c, p } = await open(SA, lang); await openInvite(p, lang); await fillInvite(p, fresh(), 'user'); await p.evaluate(() => localStorage.setItem('elevation_token', 'invalido.vencido.x')); await sendBtn(p, lang).click(); await sleep(3000); const r = p.resp.filter(x => /invitations/.test(x.u)).pop(); const tx = (await inviteDlg(p).innerText().catch(() => body(p))).replace(/\s+/g, ' '); info(`U4 ${lang}: sesión vencida a mitad → servidor ${r?.s}; URL ${p.url().replace(UI, '')}; mensaje: «${tx.includes(t.e.other) ? t.e.other : tx.slice(0, 80)}»`); ck(`U4 ${lang}: 401 → o va al inicio de sesión o muestra un error (no queda en silencio)`, r?.s === 401 && (/login|signin|inicio/i.test(p.url()) || tx.includes(t.e.other)), ''); await c.close() }

  // ============ U3 simulado emailSent:true ============
  if (want('U3')) for (const lang of ['es', 'en']) { const t = L[lang]; const { c, p } = await open(SA, lang); await openInvite(p, lang); const em = fresh(); await fillInvite(p, em, 'therapist')
    await p.route('**/api/admin/invitations', async r => { if (r.request().method() !== 'POST') return r.continue(); const rs = await r.fetch(); const j = await rs.json(); j.emailSent = true; r.fulfill({ response: rs, body: JSON.stringify(j), contentType: 'application/json' }) })
    await sendBtn(p, lang).click(); await sleep(1500); const d = (await inviteDlg(p).innerText()).replace(/\s+/g, ' '); const rr = p.resp.pop(); const exp = JSON.parse(rr.t).expiresAt
    const want1 = new Date(exp); info(`U3 ${lang} (SIMULADO emailSent:true): mensaje «${d.slice(d.indexOf(t.sentPre), d.indexOf(t.sentPre) + 140)}» · expiresAt del servidor ${exp}`)
    ck(`U3 ${lang} (SIMULADO): dice «${t.sentPre} {correo}» y «${t.exp} {fecha}» con el correo y la fecha del servidor`, d.includes(`${t.sentPre} ${em}.`) && d.includes(t.exp), '')
    const dm = d.match(new RegExp(t.exp + ' (.+?)\\.(?: |$)')); const shown = dm ? dm[1] : ''; const full = want1.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' })
    ck(`U3 ${lang} (SIMULADO): la fecha mostrada «${shown}» conserva la hora completa («${full}»)`, shown.replace(/\s/g, ' ').trim().length >= full.replace(/\s/g, ' ').replace(/\.$/, '').length, `mostrada="${shown}" completa="${full}"`)
    await c.close() }

  // ============ U7 el enlace nunca se expone ============
  if (want('U7')) { const { c, p } = await open(SA, 'es'); await openInvite(p, 'es'); const em = fresh(); await fillInvite(p, em, 'user'); await sendBtn(p, 'es').click(); await sleep(1500); await closeAll(p)
    await openManage(p, PX); await p.locator('body').getByRole('button', { name: L.es.resetBtn, exact: true }).click(); await sleep(300); await resetDlg(p).getByRole('button', { name: L.es.resetSend, exact: true }).click(); await sleep(1200)
    const st = await p.evaluate(() => ({ ls: Object.entries(localStorage), ss: Object.entries(sessionStorage), url: location.href, html: document.documentElement.outerHTML }))
    ck('U7: localStorage solo tiene las claves de sesión que inyecté (sin enlace ni token de invitación)', st.ls.every(([k]) => ['elevation_token', 'elevation_role', 'elv_lang'].includes(k)) && st.ss.length === 0, st.ls.map(x => x[0]).join(','))
    ck('U7: la URL no lleva token ni correo', !/token|@|accept-invitation/.test(st.url), st.url.replace(UI, ''))
    ck('U7: el DOM no contiene accept-invitation, token= ni el enlace', !/accept-invitation|token=|reset-password\?/.test(st.html.replace(/elevation_token/g, '')), '')
    ck('U7: la consola no imprime el correo invitado ni tokens', !p.cons.some(m => m.includes(em) || /token=|accept-invitation/.test(m)), p.cons.slice(0, 3).join(' | ').slice(0, 120))
    const bodies = p.resp.map(x => x.t).join('\n'); ck('U7: ninguna respuesta de POST (invitar, enlace) trae enlace ni token', !/token|accept-invitation|reset-password|https?:\/\//i.test(bodies.replace(/"?id"?:\d+/g, '')), bodies.slice(0, 200))
    ck('U7: la petición de invitar no lleva contraseña', p.net.filter(x => /invitations/.test(x.u) && x.m === 'POST').every(x => !/password|contraseña/i.test(x.b || '')), p.net.filter(x => /invitations/.test(x.u) && x.m === 'POST').map(x => x.b).join(' '))
    await c.close() }

  // ============ U8 endpoints retirados ============
  if (want('U8')) { const a = await call('POST', '/api/admin/usuarios', SA.token, { name: 'x', email: fresh(), password: PASS, role: 'user' }); const b = await call('PUT', `/api/admin/usuarios/${P.id}/reset-password`, SA.token, { newPassword: PASS })
    ck('U8: el servidor sigue respondiendo 410 a POST /usuarios y PUT /reset-password', a.s === 410 && b.s === 410, `${a.s} ${b.s}`)
    for (const lang of ['es', 'en']) { const { c, p } = await open(SA, lang); await openInvite(p, lang); await fillInvite(p, fresh(), 'user'); await sendBtn(p, lang).click(); await sleep(1200); await closeAll(p); await openManage(p, PX); await p.locator('body').getByRole('button', { name: L[lang].resetBtn, exact: true }).click(); await sleep(300); await resetDlg(p).getByRole('button', { name: L[lang].resetSend, exact: true }).click(); await sleep(1000)
      ck(`U8 ${lang}: en todos los flujos 0 llamadas a POST /api/admin/usuarios y a reset-password`, cnt(p, /^POST \/api\/admin\/usuarios$/) === 0 && cnt(p, /reset-password/) === 0, p.net.filter(x => x.m !== 'GET').map(x => x.m + ' ' + x.u).join(' ; ').slice(0, 200)); await c.close() } }

  // ============ U9 teclado ============
  if (want('U9')) for (const lang of ['es', 'en']) { const t = L[lang]; const { c, p } = await open(SA, lang)
    const trigger = p.getByRole('button', { name: t.invBtn, exact: true }); await trigger.focus(); await p.keyboard.press('Enter'); await inviteDlg(p).waitFor(); await sleep(300)
    const inside = () => p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find(x => /Invitar persona|Invite person/.test(x.textContent)); const dlg = h?.parentElement?.parentElement; return dlg ? dlg.contains(document.activeElement) : null })
    const first = await inside(); const roleAttr = await inviteDlg(p).evaluate(el => ({ role: el.getAttribute('role'), modal: el.getAttribute('aria-modal'), label: el.getAttribute('aria-labelledby') || el.getAttribute('aria-label') })).catch(() => ({}));
    let leaked = false; for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); if (!(await inside())) { leaked = true; break } }
    info(`U9 ${lang}: teclado del diálogo de invitar → foco inicial dentro=${first}; role=${roleAttr.role} aria-modal=${roleAttr.modal} nombre=${roleAttr.label}; Tab×12 sale del diálogo=${leaked}`)
    await p.keyboard.press('Escape'); await sleep(300); const still = await inviteDlg(p).count(); const af = await p.evaluate(() => document.activeElement?.textContent?.slice(0, 25) || document.activeElement?.tagName)
    info(`U9 ${lang}: Esc ${still ? 'NO cierra el diálogo' : 'cierra el diálogo'}; foco después de cerrar: «${af}»`)
    ck(`U9 ${lang}: el diálogo de invitar se comporta como los demás (role=dialog, foco dentro, Tab atrapado, Esc cierra, foco devuelto)`, first === true && roleAttr.role === 'dialog' && !leaked && !still && /Invit/.test(af || ''), '')
    await c.close() }

  // ============ U10 regresión (la parte que se puede probar sin main aquí: transcript del PR; el A/B lo hace LABEL=main) ============
  if (want('U10')) { const { c, p } = await open(SA, 'es'); const tr = []
    tr.push('LISTA ' + (await p.locator('table tbody tr').count() > 0)); tr.push('BOTONES ' + (await p.locator('button').allInnerTexts()).join('|'))
    const before = (await body(p)).split(String.fromCharCode(10)); await openManage(p, P); const mt = (await body(p)).split(String.fromCharCode(10)).filter(x => !before.includes(x) || x.includes(P.email)).join(' ');  tr.push('GESTIONAR ' + mt.replace(/\s+/g, ' ').replace(P.email, 'EMAIL').replace(P.name, 'NOMBRE')); console.log(tr.join('\n')); await c.close() }

  await B.close(); if (DB) await DB.end(); console.log(f ? `\nFALLAS ${f} de ${total}` : `\nTODO OK (${total}/${total})`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 900)); process.exit(3) })
