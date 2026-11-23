// [QA-Claude-5] PR #446 (ES-379): POST /api/admin/usuarios/:id/reset-link espera al envío y responde con emailSent. Backend REAL + PG desechable + proveedor de correo FALSO (qa/qa5-446-mail.cjs). Datos sintéticos.
// Uso: MODE=ok|none|nobase API=http://127.0.0.1:8402 DATABASE_URL=... NODE_PATH=... node qa/qa5-446.cjs   (el backend se arranca con restart446.sh <modo>; cred-reg.json de qa5-reg-seed.cjs)
const fs = require('fs'); const crypto = require('crypto'); const { Client } = require('pg'); const API = process.env.API; const MODE = process.env.MODE || 'ok'
const OUT = (process.env.QA_TOOLS || '.') + '/qa5/out'; const U = JSON.parse(fs.readFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred-reg.json', 'utf8')).users
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 380) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const text = await r.text(); let j = null; try { j = JSON.parse(text) } catch {} return { status: r.status, body: j, text, ms: Date.now() - t0 } }
const sql = async (q, a) => { const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); try { return (await c.query(q, a)).rows } finally { await c.end() } }
const mk = async (role = 'user', active = true) => { const email = `qa5-r-${crypto.randomBytes(3).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name: 'Persona Reset', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); await sql('UPDATE "Users" SET "onboardingCompleted"=true, role=$2, active=$3 WHERE email=$1', [email, role, active]); const id = (await sql('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; return { email, id } }
const live = async (id) => +(await sql('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1 AND "usedAt" IS NULL AND "expiresAt" > now()', [id]))[0].n
const total = async (id) => +(await sql('SELECT count(*)::int n FROM "PasswordResets" WHERE "UserId"=$1', [id]))[0].n
const outbox = () => (fs.existsSync(OUT + '/outbox.jsonl') ? fs.readFileSync(OUT + '/outbox.jsonl', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const tokenFrom = (m) => (/#token=([A-Za-z0-9_-]+)/.exec(m.text) || [])[1]
const link = (tk, id) => call(tk, 'POST', `/api/admin/usuarios/${id}/reset-link`, {})
;(async () => { const SA = U.superadmin.token, AD = U.admin.token
  info(`modo del backend: ${MODE}`)
  if (MODE === 'ok') {
    // 1) envío correcto
    fs.rmSync(OUT + '/mail-fail.flag', { force: true }); let u = await mk(); let n0 = outbox().length; let r = await link(SA, u.id)
    check('envío correcto: 202 {emailSent:true, expiresInMinutes:30, message ES/EN}', r.status === 202 && r.body.emailSent === true && r.body.expiresInMinutes === 30 && /enlace de restablecimiento.*correo/i.test(r.body.message) && /reset link/i.test(r.body.message), r.text)
    check('la respuesta NO contiene el token ni el enlace ni el correo de la cuenta', !/token|reset-password|@example\.test/i.test(r.text), r.text)
    const mails = outbox().slice(n0); check('el proveedor recibió UN mensaje, para el correo de la cuenta, con el enlace en el fragmento (#token=) y no en la ruta ni en la consulta', mails.length === 1 && mails[0].to === u.email && /reset-password#token=[A-Za-z0-9_-]{40,}/.test(mails[0].text), JSON.stringify(mails.map((m) => m.to)))
    const tk1 = tokenFrom(mails[0]); check('queda exactamente 1 enlace vivo y es el que se envió: confirmar con ese token funciona', (await live(u.id)) === 1 && (await call(null, 'POST', '/api/password-reset/confirm', { token: tk1, password: pass + 'x' })).status === 200, `${await live(u.id)}`)
    // 2) proveedor que lanza tras recibir el mensaje → el enlace se INVALIDA
    u = await mk(); fs.writeFileSync(OUT + '/mail-fail.flag', '1'); n0 = outbox().length; r = await link(SA, u.id); fs.rmSync(OUT + '/mail-fail.flag', { force: true })
    check('proveedor que lanza: 202 {emailSent:false} con mensaje ES/EN que dice que no se pudo enviar y que no quedó enlace', r.status === 202 && r.body.emailSent === false && !('expiresInMinutes' in r.body) && /No se pudo enviar el correo/.test(r.body.message) && /could not be sent/i.test(r.body.message), r.text)
    const tkF = tokenFrom(outbox().slice(n0)[0]); check('0 enlaces vivos tras el fallo (el creado se invalidó)', (await live(u.id)) === 0, `${await live(u.id)}`)
    const cf = await call(null, 'POST', '/api/password-reset/confirm', { token: tkF, password: pass + 'y' }); check(`confirmar con el token que se había creado da error (${cf.status} ${cf.body && cf.body.code}) y NO cambia la contraseña`, cf.status >= 400 && cf.status < 500, cf.text)
    check('la contraseña original sigue funcionando (login 200)', (await call(null, 'POST', '/api/login', { email: u.email, password: pass })).status === 200)
    // 3) un envío fallido invalida también el enlace bueno anterior (solo vale el último pedido)
    u = await mk(); n0 = outbox().length; await link(SA, u.id); const good = tokenFrom(outbox().slice(n0)[0]); fs.writeFileSync(OUT + '/mail-fail.flag', '1'); await link(SA, u.id); fs.rmSync(OUT + '/mail-fail.flag', { force: true })
    const cg = await call(null, 'POST', '/api/password-reset/confirm', { token: good, password: pass + 'z' }); info(`efecto lateral: tras un reintento FALLIDO, el enlace bueno anterior ya no sirve (confirmar → ${cg.status}); vivos ${await live(u.id)}`)
    // 4) concurrencia: 6 peticiones simultáneas → a lo sumo 1 enlace vivo; tope 3/h por cuenta
    u = await mk(); n0 = outbox().length; const rs = await Promise.all([1, 2, 3, 4, 5, 6].map(() => link(SA, u.id))); const sent = rs.filter((x) => x.body && x.body.emailSent === true).length, notSent = rs.filter((x) => x.body && x.body.emailSent === false).length
    check(`concurrencia (6 simultáneas): ${sent} enviadas y ${notSent} no (tope 3/h por cuenta); a lo sumo 1 enlace vivo (${await live(u.id)}) y ninguna respuesta 5xx`, sent === 3 && notSent === 3 && (await live(u.id)) === 1 && rs.every((x) => x.status === 202), JSON.stringify(rs.map((x) => x.status + ':' + (x.body && x.body.emailSent))))
    const sentMails = outbox().slice(n0); const lastTok = tokenFrom(sentMails[sentMails.length - 1]); const olds = sentMails.slice(0, -1).map(tokenFrom); const oldDead = (await Promise.all(olds.map((t) => call(null, 'POST', '/api/password-reset/confirm', { token: t, password: pass + 'q' })))).every((x) => x.status >= 400); check('de las 3 enviadas solo vale la ÚLTIMA: las anteriores dan error al confirmar', oldDead && (await live(u.id)) === 1)
    // 5) límite de 3/h: la 4.ª petición en serie → emailSent:false (texto impreciso: «no configurado o falló»)
    u = await mk(); const seq = []; for (let i = 0; i < 4; i++) seq.push((await link(SA, u.id)).body); check('límite 3/h por cuenta: 3 enviados y el 4.º emailSent:false', seq.slice(0, 3).every((b) => b.emailSent === true) && seq[3].emailSent === false, JSON.stringify(seq.map((b) => b.emailSent))); info(`4.ª petición (tope): «${seq[3].message}»`)
    const ina = await mk('user', false); const ri = await link(SA, ina.id); info(`cuenta INACTIVA: ${ri.status} ${JSON.stringify(ri.body)}`); check('cuenta inactiva: 202 emailSent:false y ningún enlace creado ni correo enviado', ri.status === 202 && ri.body.emailSent === false && (await total(ina.id)) === 0 && !outbox().some((m) => m.to === ina.email))
    // 6) ruta pública: misma respuesta para existente / inexistente / inactiva / con borrado pendiente
    const ex = await mk(); const del = await mk(); await sql('INSERT INTO "DeletionRequests" (id, "UserId", status, attempts, "createdAt", "updatedAt") VALUES ($1, $2, \'accepted\', 0, now(), now())', [crypto.randomUUID(), del.id]).catch((e) => info('no pude simular borrado pendiente:', e.message.slice(0, 80))); const reqs = []
    for (const [label, email] of [['existente', ex.email], ['inexistente', 'nadie-' + crypto.randomBytes(3).toString('hex') + '@example.test'], ['inactiva', ina.email], ['borrado pendiente', del.email]]) { const r2 = await call(null, 'POST', '/api/password-reset/request', { email }); reqs.push([label, r2.status, r2.text, r2.ms]) }
    check('ruta pública: 202 y cuerpo IDÉNTICO para existente, inexistente, inactiva y con borrado pendiente (sin enumeración)', reqs.every((x) => x[1] === 202 && x[2] === reqs[0][2]), JSON.stringify(reqs.map((x) => [x[0], x[1], x[2].slice(0, 40)])))
    info('tiempos de la ruta pública (ms):', reqs.map((x) => x[0] + '=' + x[3]).join(' '))
    await new Promise((r) => setTimeout(r, 800)); check('ruta pública: solo la cuenta existente y activa recibió correo; la inactiva y la de borrado pendiente no', outbox().some((m) => m.to === ex.email) && !outbox().some((m) => m.to === ina.email) && !outbox().some((m) => m.to === del.email))
    const rdel = await link(SA, del.id); check('cuenta con borrado pendiente (administración): 202 emailSent:false, sin enlace ni correo', rdel.status === 202 && rdel.body.emailSent === false && (await total(del.id)) === 0, rdel.text)
    const pubBody = JSON.stringify(reqs[0][2]); check('la ruta pública no devuelve emailSent ni minutos', !/emailSent|expiresInMinutes/.test(pubBody))
    // 7) auditoría sin token ni correo
    const aud = await call(SA, 'GET', '/api/superadmin/audit'); const audTxt = aud.text; info(`auditoría: GET /api/admin/audit → ${aud.status}, ${audTxt.length} caracteres, entradas user.reset_link: ${(audTxt.match(/user\.reset_link/g) || []).length}`)
    const allTokens = outbox().map(tokenFrom).filter(Boolean); check('la auditoría no contiene ningún token enviado ni ningún correo de cuenta sintética', aud.status === 200 && (audTxt.match(/user\.reset_link/g) || []).length >= 5 && !allTokens.some((t) => audTxt.includes(t)) && !/@example\.test/.test(audTxt), audTxt.slice(0, 200))
    // 8) permisos
    const ad = await link(AD, ex.id); check(`admin (no superadmin): 403 y no se crea enlace (${ad.status})`, ad.status === 403, ad.text); const un = await link(SA, 999999); check(`cuenta inexistente: 404 (${un.status})`, un.status === 404, un.text); const nl = await link(null, ex.id); check(`sin sesión: 401 (${nl.status})`, nl.status === 401); const us = await link(U.user.token, ex.id); check(`persona usuaria: 403 (${us.status})`, us.status === 403)
  }
  if (MODE === 'none' || MODE === 'nobase') {
    const u = await mk(); const n0 = outbox().length; const r = await link(SA, u.id)
    check(`${MODE === 'none' ? 'sin proveedor de correo' : 'sin base del enlace (APP_BASE_URL/FRONTEND_URL)'}: 202 {emailSent:false}, NO se crea ningún enlace (0 filas) y no sale correo`, r.status === 202 && r.body.emailSent === false && (await total(u.id)) === 0 && outbox().length === n0, r.text + ' filas ' + await total(u.id))
    const pub = await call(null, 'POST', '/api/password-reset/request', { email: u.email }); const pub2 = await call(null, 'POST', '/api/password-reset/request', { email: 'nadie@example.test' }); check('ruta pública sin proveedor/base: 202 idéntico para existente e inexistente', pub.status === 202 && pub.text === pub2.text, pub.text)
  }
  console.log(`#446 (${MODE}): ${ok} correctas, ${bad} fallos`) })().catch((e) => { console.error('ABORTA', e); process.exit(2) })
