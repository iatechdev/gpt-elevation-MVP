// [QA-Claude-5] ES-45 FASE A: tope de registro por IP en STAGING (autorizado por Mauricio en mi chat el 23-nov-2026 y por Infra: hasta 31 registros, solo qa-sint-*, TRUST_PROXY_HOPS=1; bajas sin purga).
// Uso: STG=$STG node qa/qa5-es45-abuso-staging.cjs
const crypto = require('crypto'); const API = process.env.STG; const MAX = Number(process.env.MAX || 33)
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 300) : '')) } }
const info = (...a) => console.log('INFO ', ...a); const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b, h = {}) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}), ...h }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j, retry: r.headers.get('retry-after'), rl: r.headers.get('ratelimit-remaining') } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const mails = []; let first429 = null, n201 = 0; const log = []
  for (let i = 1; i <= MAX; i++) { const email = `qa-sint-ab-${crypto.randomBytes(4).toString('hex')}@example.test`; const r = await call(null, 'POST', '/api/register', { name: 'Persona Sintetica Abuso', email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); log.push(r.status); if (r.status === 201) { n201++; mails.push(email) } if (r.status === 429) { first429 = i; info('429 en el intento', i, 'retry-after:', r.retry, 'cuerpo:', JSON.stringify(r.body)); break } if (r.status >= 500) info('5xx en intento', i, r.status) }
  info('estados en orden:', log.join(','), '| cuentas creadas:', n201)
  check('R1 staging: el tope por IP llega a 429 antes del intento 33 (límite de 30/h por IP; el resto de la cuota ya lo gastaron mis cuentas previas)', first429 !== null && first429 <= 31, 'primer 429 en ' + first429)
  check('R1 staging: ninguna respuesta 5xx durante la secuencia', !log.some((s) => s >= 500), log.join(','))
  const sp = [await call(null, 'POST', '/api/register', { name: 'x', email: `qa-sint-ab-${crypto.randomBytes(4).toString('hex')}@example.test`, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }, { 'x-forwarded-for': '203.0.113.' + (1 + Math.floor(Math.random() * 200)) }),
    await call(null, 'POST', '/api/register', { name: 'x', email: `qa-sint-ab-${crypto.randomBytes(4).toString('hex')}@example.test`, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }, { 'x-forwarded-for': '198.51.100.7, 203.0.113.9', 'x-real-ip': '192.0.2.5' })]
  check('R5 staging: X-Forwarded-For / X-Real-IP falsificados NO evaden el tope tras el proxy de Railway (TRUST_PROXY_HOPS=1)', sp.every((r) => r.status === 429), sp.map((r) => r.status).join(','))
  const h = await call(null, 'GET', '/api/health'); check('staging sigue respondiendo (/api/health 200)', h.status === 200)
  // bajas: una por cuenta, con el ritmo del límite de login (10/min por IP)
  let done = 0, fail = []
  for (const email of mails) { await sleep(7000); const l = await call(null, 'POST', '/api/login', { email, password: pass }); if (l.status !== 200) { fail.push(email + ' login ' + l.status); continue } const d = await call(l.body.token, 'POST', '/api/account/deletion-requests', { confirm: true }); if ([200, 202].includes(d.status)) done++; else fail.push(email + ' baja ' + d.status) }
  info('bajas solicitadas:', done, 'de', mails.length, fail.length ? 'FALLOS: ' + JSON.stringify(fail) : ''); check(`todas las cuentas de la prueba (${mails.length}) quedaron con la baja solicitada`, done === mails.length && fail.length === 0, JSON.stringify(fail))
  console.log(`ABUSO STAGING: ${ok} correctas, ${bad} fallos`); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
