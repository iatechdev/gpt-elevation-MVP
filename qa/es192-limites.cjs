// QA-Claude-2 — ES-192 (PR #145) I6: límites POR DEFECTO de aceptación y de invitaciones por invitador.
// Requiere un backend recién arrancado SIN las variables INVITATION_* (estado en memoria limpio). Env: BACKEND, DATABASE_URL, API_DEF.
const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg'); const crypto = require('crypto')
const API = process.env.API_DEF; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt } }
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const tag = Date.now().toString(36), pw = 'Sint3tica-QA-pass1!'; const email = `qa2-i6-${tag}@example.test`
  await call('POST', '/api/register', null, { name: 'i6', email, password: pw }); await db.query('UPDATE "Users" SET role=$1 WHERE email=$2', ['admin', email]); await sleep(500)
  const tk = (await call('POST', '/api/login', null, { email, password: pw })).j?.token
  const lim = []; for (let i = 0; i < 13; i++) lim.push((await call('POST', '/api/invitations/accept', null, { token: crypto.randomBytes(32).toString('base64url'), name: 'x', password: pw })).s)
  console.log('INFO I6 13 intentos de aceptación seguidos:', lim.join(','))
  ck('I6 los primeros 10 → 400 y el 11.º en adelante → 429 rate_limited', lim.slice(0, 10).every(s => s === 400) && lim.slice(10).every(s => s === 429), lim.join(','))
  let n201 = 0, n429 = 0
  for (let i = 0; i < 33; i++) { const r = await call('POST', '/api/admin/invitations', tk, { email: `lim${i}-${tag}@example.test`, role: 'user' }); if (r.s === 201) n201++; if (r.s === 429) n429++ }
  ck('I6 el invitador queda limitado a 30 invitaciones por hora (429 después)', n201 === 30 && n429 === 3, `201=${n201} 429=${n429}`)
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
