// [QA-Claude] ES-221 · PR #305 · SERVIDOR: registro sin oráculo de cuenta inactiva, tiempo equivalente, límite por IP (30/h). Plan R1–R13 (Jira ES-221, comentario 12284; «Ejecuta» de Infra).
// Servidor REAL (backend de la cabeza fusionado con main, o main para la línea base) + PostgreSQL desechable con migraciones, datos sintéticos, 0 IA.
// Env: QA_SUT, DATABASE_URL, QA_API (default http://localhost:8190), MODE (pr|main), CASES (func,timing,limit,proxy,conc,perf,hostile), EXPECT_MAX (tope esperado del límite, default 30), PROXY (none|hops1-fixed|hops1-varied|none-varied), OUT
process.env.DB_SSL = 'false'
const E = process.env; const fs = require('fs'), path = require('path'), { createRequire } = require('module')
const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const { Client } = req('pg')
const API = E.QA_API || 'http://localhost:8190', MODE = E.MODE || 'pr'; const CASES = (E.CASES || 'func').split(','); const MAX = Number(E.EXPECT_MAX || 30)
const results = []; let f = 0
const ck = (n, ok, x = '') => { if (!ok) f++; results.push({ n, ok: !!ok, x: String(x).slice(0, 600) }); console.log((ok ? 'OK   ' : 'FALLA ') + `[${MODE}] ` + n, String(x).slice(0, 300)) }
const info = (n, x) => { results.push({ n, info: String(x).slice(0, 900) }); console.log('INFO', `[${MODE}]`, n, String(x).slice(0, 500)) }
const DB = new Client({ connectionString: E.DATABASE_URL, ssl: false }); const q = async (s, a = []) => (await DB.query(s, a)).rows
const PW = 'Sintetica-Clave-2026!'; const V = '2026-11-v1'; let seq = 0; const stamp = Date.now().toString(36)
const mail = (tag = 'u') => `es221-${tag}-${stamp}-${++seq}@example.invalid`
let xffMode = E.PROXY || 'none'; let xffN = 0
const xffHeader = () => { xffN++; if (xffMode === 'none-varied') return { 'x-forwarded-for': `198.51.100.${xffN % 250}` }; if (xffMode === 'hops1-fixed') return { 'x-forwarded-for': `10.9.${xffN % 250}.${xffN % 200}, 203.0.113.9` }; if (xffMode === 'hops1-varied') return { 'x-forwarded-for': `10.9.0.1, 203.0.113.${(xffN % 250) + 1}` }; return {} }
const raw = async (m, p, body, { text, ct = 'application/json', extra = {} } = {}) => {
  const t0 = process.hrtime.bigint()
  const r = await fetch(API + p, { method: m, headers: { ...(ct ? { 'content-type': ct } : {}), ...xffHeader(), ...extra }, body: text !== undefined ? text : body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; let j = null; try { j = JSON.parse(t) } catch {}
  const h = {}; r.headers.forEach((v, k) => { h[k] = v }); return { s: r.status, j, t, h, ms }
}
const reg = (patch = {}, email = mail()) => raw('POST', '/api/register', { name: 'Persona Sintetica', email, password: PW, acceptedTerms: true, termsVersion: V, ...patch }).then(r => ({ ...r, email }))
const users = async () => Number((await q('select count(*) n from "Users"'))[0].n)
const urow = async email => (await q('select id, active, password, role, "termsVersion" from "Users" where lower(email)=lower($1)', [email]))[0]
const sec = async (n, fn) => { try { await fn() } catch (e) { ck(`${n}: EXCEPCIÓN`, false, (e.stack || e.message).slice(0, 400)) } }
const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]; const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))]
const skipH = k => /^(date|etag|ratelimit|x-ratelimit|retry-after|content-length|keep-alive|connection)/i.test(k)
const hdrSig = h => Object.keys(h).filter(k => !skipH(k)).sort().map(k => `${k}=${h[k]}`).join('|')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const mkInactive = async () => { const r = await reg(); await q('update "Users" set active=false where lower(email)=lower($1)', [r.email]); return r.email }
;(async () => {
  await DB.connect()
  if (CASES.includes('func')) {
    // R1 inactiva = activa
    await sec('R1', async () => {
      const act = (await reg()).email; const ina = await mkInactive(); const hashBefore = (await urow(ina)).password; const n0 = await users()
      const a = await reg({}, act); const i = await reg({}, ina)
      ck('R1 activa → 400 «El correo ya está registrado.»', a.s === 400 && a.j?.error === 'El correo ya está registrado.', `${a.s} ${a.t.slice(0, 120)}`)
      ck(`R1 inactiva responde IGUAL que activa (status ${i.s}, cuerpo y cabeceras)`, MODE === 'main' ? true : i.s === a.s && i.t === a.t && hdrSig(i.h) === hdrSig(a.h), `${i.s} ${i.t.slice(0, 120)} | ${hdrSig(i.h) === hdrSig(a.h)}`)
      info('R1 inactiva (esta versión)', `${i.s} ${i.t.slice(0, 160)}`)
      const u = await urow(ina); ck('R1 la cuenta inactiva sigue inactiva, misma contraseña y sin cuentas nuevas', u.active === false && u.password === hashBefore && (await users()) === n0, JSON.stringify({ active: u.active, same: u.password === hashBefore }))
      for (const [lab, e] of [['MAYÚSCULAS', ina.toUpperCase()], ['espacios', `  ${ina}  `], ['mixto', ina.replace('es221', 'Es221')]]) { const x = await reg({}, e); ck(`R1 ${lab}: igual que activa`, MODE === 'main' ? true : x.s === a.s && x.t === a.t, `${x.s} ${x.t.slice(0, 100)}`) }
      const nn = await reg(); ck('R1 correo nuevo → 201 (sigue distinguible, compromiso declarado)', nn.s === 201, `${nn.s} ${nn.t.slice(0, 100)}`)
    })
    // R2 lo que no cambia
    await sec('R2', async () => {
      const mailA = (await reg()).email; await q('update "Users" set active=false where lower(email)=lower($1)', [mailA])
      const l = await raw('POST', '/api/login', { email: mailA, password: PW }); ck('R2 login con clave correcta de cuenta inactiva = 403 «Cuenta inactiva» (sin cambio)', l.s === 403 && /inactiva|inactive/i.test(l.t), `${l.s} ${l.t.slice(0, 120)}`)
      const w = await raw('POST', '/api/login', { email: mailA, password: 'otra-Clave-9!' }); const nx = await raw('POST', '/api/login', { email: mail('nx'), password: 'otra-Clave-9!' }); ck('R2 login con clave mala: inactiva e inexistente responden igual', w.s === nx.s && w.t === nx.t, `${w.s}/${nx.s}`)
      const pr1 = await raw('POST', '/api/password-reset/request', { email: mailA }); const pr2 = await raw('POST', '/api/password-reset/request', { email: mail('nx') }); ck('R2 recuperar contraseña: inactiva e inexistente responden igual', pr1.s === pr2.s && pr1.t === pr2.t && pr1.s < 500, `${pr1.s}/${pr2.s}`)
    })
    // R3 orden aceptación → hash → correo y validaciones previas
    await sec('R3', async () => {
      const act = (await reg()).email; const ina = await mkInactive(); const n0 = await users(); const out = []
      for (const m of [act, ina, mail('new')]) out.push(await reg({ acceptedTerms: undefined, termsVersion: undefined }, m))
      ck('R3 sin aceptación: mismo cuerpo `terms_required` para existente, inactiva y nueva', out.every(r => r.s === 400 && r.j?.code === 'terms_required') && out[0].t === out[1].t && out[1].t === out[2].t, out.map(r => r.s + ' ' + r.j?.code).join(','))
      const weak = []; for (const m of [act, ina, mail('new')]) weak.push(await reg({ password: '123' }, m))
      ck('R3 contraseña débil: mismo status y cuerpo para existente, inactiva y nueva', weak.every(r => r.s === weak[0].s) && weak[0].t === weak[1].t && weak[1].t === weak[2].t, weak.map(r => r.s + ' ' + r.t.slice(0, 60)).join(' || '))
      const bad = []; for (const m of ['no-es-correo', 'a'.repeat(300) + '@example.invalid', 'x\u0000y@example.invalid']) bad.push(await reg({}, m))
      ck('R3 correo con forma inválida: 400 sin 500 y sin cuenta', bad.every(r => r.s === 400) && (await users()) === n0, bad.map(r => r.s).join(','))
    })
  }
  if (CASES.includes('timing')) await sec('R4', async () => {
    const act = (await reg()).email; const ina = await mkInactive(); const N = Number(E.TIMING_N || 40); const d = [], i = [], n = []
    for (let k = 0; k < 6; k++) { await reg({}, act); await reg({}, mail('w')) } // calentamiento
    for (let k = 0; k < N; k++) { const order = k % 3 === 0 ? [0, 1, 2] : k % 3 === 1 ? [1, 2, 0] : [2, 0, 1]; for (const o of order) { if (o === 0) d.push((await reg({}, act)).ms); else if (o === 1) i.push((await reg({}, ina)).ms); else n.push((await reg()).ms) } }
    const r1 = med(d) / med(n), r2 = med(i) / med(n); info('R4 tiempos (ms): dup activo / dup inactivo / nuevo', `med ${med(d).toFixed(1)}/${med(i).toFixed(1)}/${med(n).toFixed(1)} p90 ${pct(d, .9).toFixed(1)}/${pct(i, .9).toFixed(1)}/${pct(n, .9).toFixed(1)} razón dup/nuevo ${r1.toFixed(2)} inact/nuevo ${r2.toFixed(2)} n=${N}`)
    if (MODE === 'pr') { ck('R4 razón mediana dup activo / nuevo en [0,8; 1,25] (umbral aprobado)', r1 >= .8 && r1 <= 1.25, r1.toFixed(2)); ck('R4 razón mediana dup inactivo / nuevo en [0,8; 1,25]', r2 >= .8 && r2 <= 1.25, r2.toFixed(2)) } else ck('R4 control (main): el duplicado es MUCHO más rápido que el nuevo (razón < 0,5), así la prueba detecta el hueco', r1 < .5, r1.toFixed(2))
  })
  if (CASES.includes('limit')) await sec('R5', async () => {
    const act = (await reg()).email; let sent = 1; const log = []
    const one = async (patch, email) => { sent++; const r = await reg(patch, email); log.push(r.s); return r }
    // 24 previas (12 duplicados 400 + 12 nuevos 201) → cuenta 25 con la de arriba
    let n429 = -1; for (let k = 0; k < MAX + 8; k++) { const r = k % 2 ? await one({}, act) : await one({}); if (r.s === 429 && n429 < 0) { n429 = sent; break } }
    info('R5 secuencia de estados', log.join(','))
    ck(`R5 el 429 llega en la petición ${MAX + 1} (400 y 201 cuentan)`, n429 === MAX + 1, `primer 429 en ${n429}`)
    const lim = await reg(); ck('R5 429 con cuerpo ES y EN, sin 500', lim.s === 429 && /Demasiados intentos/.test(lim.t) && /Too many attempts/.test(lim.t), `${lim.s} ${lim.t.slice(0, 140)}`)
    info('R5 cabeceras del 429', Object.keys(lim.h).filter(k => /ratelimit|retry-after/i.test(k)).map(k => `${k}=${lim.h[k]}`).join(' '))
    const rl = lim.h['ratelimit-limit'] || (lim.h['ratelimit-policy'] || '').split(';')[0]; ck(`R5 cabecera de límite = ${MAX}`, String(rl).includes(String(MAX)), `${rl}`)
    const rs = Number(lim.h['ratelimit-reset'] || lim.h['retry-after'] || 0); ck('R5 reinicio ≈ 1 hora (≤ 3600 s y > 3000 s)', rs > 3000 && rs <= 3600, rs)
    const bad = await raw('POST', '/api/register', undefined, { text: '{}' }); ck('R5 cuerpo JSON sin campos con el límite agotado → 429 (el limitador va antes de validateBody; sin 500)', bad.s === 429, `${bad.s}`)
    const mal = await raw('POST', '/api/register', undefined, { text: '{"name":' }); info('R5 JSON malformado con el límite agotado (lo corta express.json antes del router: no cuenta ni se limita, sin oráculo)', `${mal.s} ${mal.t.slice(0, 80)}`)
    const hl = await raw('GET', '/api/health'); ck('R5 /api/health y el login no se ven afectados', hl.s === 200, `${hl.s}`); const lg = await raw('POST', '/api/login', { email: act, password: PW }); ck('R5 login de la cuenta existente sigue respondiendo 200', lg.s === 200, `${lg.s} ${lg.t.slice(0, 80)}`)
    const pw = await raw('POST', '/api/password-reset/request', { email: act }); ck('R5 recuperar contraseña no cuenta contra el límite de registro', pw.s < 429 || pw.s === 429 && false, `${pw.s}`)
  })
  if (CASES.includes('pilot')) await sec('R5p', async () => {
    for (let k = 0; k < 24; k++) await reg(k % 2 ? {} : {}, k % 2 ? mail() : mail()); const six = []; for (let k = 0; k < 6; k++) six.push((await reg()).s)
    ck('R5 piloto: 6 personas tras la misma IP con 24 peticiones previas → 6 × 201', six.every(s => s === 201), six.join(','))
    const o = await reg(); info('R5 petición 31', `${o.s}`); ck('R5 la 31 da 429', o.s === 429, `${o.s}`)
  })
  if (CASES.includes('proxy')) await sec('R6', async () => {
    const codes = []; for (let k = 0; k < 40; k++) codes.push((await reg()).s); const first429 = codes.indexOf(429) + 1
    info(`R6 [${xffMode}] 40 peticiones con XFF distintos: primer 429 en la petición`, `${first429 || 'ninguno'} | ${codes.join('')}`)
    if (xffMode === 'none-varied') ck('R6a sin TRUST_PROXY_HOPS: el cubo es UNO COMPARTIDO (el XFF se ignora) → 429 en la 31 aunque cada petición traiga otro XFF', first429 === 31, `${first429}`)
    if (xffMode === 'hops1-fixed') ck('R6b con TRUST_PROXY_HOPS=1 un XFF falseado a la izquierda NO evade el límite (429 en la 31)', first429 === 31, `${first429}`)
    if (xffMode === 'hops1-varied') ck('R6c con TRUST_PROXY_HOPS=1 y un cliente distinto por petición (XFF final distinto) → cubos separados, sin 429', first429 === 0, `${first429}`)
  })
  if (CASES.includes('conc')) await sec('R7', async () => {
    const same = mail('same'); const rs = await Promise.all(Array.from({ length: 10 }, () => reg({}, same))); const c = (await q('select count(*) n from "Users" where lower(email)=lower($1)', [same]))[0].n
    ck('R7 10 registros simultáneos del mismo correo → 1 cuenta, sin 500', Number(c) === 1 && !rs.some(r => r.s >= 500), `${c} cuentas; ${rs.map(r => r.s).join(',')}`)
    const many = await Promise.all(Array.from({ length: 40 }, () => reg())); const adm = many.filter(r => r.s !== 429).length, lim = many.filter(r => r.s === 429).length
    ck(`R7 40 simultáneos distintos con ${10} ya consumidas: admitidos = ${MAX - 10}, limitados = ${40 - (MAX - 10)}`, adm === MAX - 10 && lim === 40 - (MAX - 10) && !many.some(r => r.s >= 500), `adm ${adm} lim ${lim} estados ${[...new Set(many.map(r => r.s))]}`)
  })
  if (CASES.includes('perf')) await sec('R8', async () => {
    const act = (await reg()).email; const lat = async n => { const a = []; for (let k = 0; k < n; k++) { const t = process.hrtime.bigint(); await fetch(API + '/api/health'); a.push(Number(process.hrtime.bigint() - t) / 1e6); await sleep(40) } return a }
    const base = await lat(30); let stop = false; const during = []; const logins = []
    const sampler = (async () => { while (!stop) { const t = process.hrtime.bigint(); await fetch(API + '/api/health'); during.push(Number(process.hrtime.bigint() - t) / 1e6); await sleep(20) } })()
    const lsamp = (async () => { while (!stop) { const r = await raw('POST', '/api/login', { email: act, password: PW }); logins.push(r.ms); await sleep(1500) } })()
    const t0 = Date.now(); const burst = await Promise.all(Array.from({ length: 30 }, () => reg({}, E.BURST === 'new' ? mail() : act))); const dur = Date.now() - t0; stop = true; await sampler; await lsamp
    info('R8 ráfaga de', E.BURST === 'new' ? '30 correos NUEVOS' : '30 duplicados'); info('R8 línea base /health (ms) p50/p95', `${med(base).toFixed(1)}/${pct(base, .95).toFixed(1)}`); info('R8 durante ráfaga de 30 duplicados (ms) p50/p95/máx, muestras', `${med(during).toFixed(1)}/${pct(during, .95).toFixed(1)}/${Math.max(...during).toFixed(1)}, n=${during.length}; ráfaga completa en ${dur} ms; login(ms) ${logins.map(x => x.toFixed(0)).join(',')}`)
    ck('R8 p95 de /api/health durante la ráfaga < 1000 ms (umbral aprobado)', pct(during, .95) < 1000, pct(during, .95).toFixed(1)); ck('R8 la ráfaga no produce 500', !burst.some(r => r.s >= 500), [...new Set(burst.map(r => r.s))].join(','))
  })
  if (CASES.includes('hostile')) await sec('R11', async () => {
    const n0 = await users(); const act = (await reg()).email; const n1 = await users(); const bad = []
    const T = async (lab, patch, o) => { const nb = await users(); const r = o ? await raw('POST', '/api/register', undefined, o) : await reg(patch); if (!(r.s === 400 || r.s === 429) || (await users()) !== nb) bad.push(`${lab}:${r.s}`) }
    for (const [lab, v] of [['name objeto', { name: { a: 1 } }], ['name array', { name: ['x'] }], ['name vacío', { name: '' }], ['name larga', { name: 'x'.repeat(5000) }], ['email objeto', { email: { $ne: 1 } }], ['email array', { email: [act] }], ['email null', { email: null }], ['email SQL', { email: "' or 1=1--@example.invalid" }], ['email unicode', { email: 'ẹxample‮@example.invalid' }], ['password objeto', { password: { a: 1 } }], ['password array', { password: [PW] }], ['password larga', { password: 'A1!' + 'x'.repeat(2000) }], ['password vacía', { password: '' }], ['version SQL', { termsVersion: "'; drop table \"Users\"--" }], ['acceptedTerms string', { acceptedTerms: 'true' }], ['role', { role: 'superadmin' }]]) { if (lab === 'role') { const r = await reg(v); const u = await urow(r.email); if (!(r.s === 201 && u.role === 'user')) bad.push('role escalado') ; continue } await T(lab, v) }
    for (const [lab, o] of [['cuerpo array', { text: '[]' }], ['cuerpo null', { text: 'null' }], ['texto', { text: 'hola', ct: 'text/plain' }], ['JSON malformado', { text: '{"name":' }], ['sin content-type', { text: '{}', ct: null }], ['__proto__', { text: `{"name":"x","email":"${mail()}","password":"${PW}","__proto__":{"acceptedTerms":true,"termsVersion":"${V}"}}` }]]) await T(lab, null, o)
    ck('R11 entradas hostiles: 400/429, sin cuentas indebidas, 0 × 500', bad.length === 0, bad.join(' || '))
  })
  console.log('RESUMEN ' + JSON.stringify({ total: results.filter(r => 'ok' in r).length, fallas: f })); fs.writeFileSync(path.join(E.OUT || '.', `ES-221-${MODE}-${E.TAG || 'run'}.json`), JSON.stringify(results, null, 1)); await DB.end(); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCION', e.stack?.slice(0, 700)); process.exit(3) })
