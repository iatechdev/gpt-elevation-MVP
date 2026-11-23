// [QA-Claude-5] ES-45 Fase 0: ABUSO Y LÍMITES DEL REGISTRO ABIERTO (POST /api/register y /api/login) con backend real, límites de producción (sin sobrescrituras) y PostgreSQL desechable.
// Uso: MODE=hostile|limit API=http://127.0.0.1:8410 node qa/qa5-es45-abuso.cjs   (reinicia el backend con restart45.sh prod entre modos: el contador por IP es de memoria)
const crypto = require('crypto'); const API = process.env.API; const MODE = process.env.MODE || 'hostile'
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'; const em = () => `qa5-a-${crypto.randomBytes(4).toString('hex')}@example.test`
const raw = async (p, body, headers = {}, method = 'POST') => { const t0 = Date.now(); try { const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...headers }, body }); let j = null; const txt = await r.text(); try { j = JSON.parse(txt) } catch {} return { status: r.status, body: j, txt, ms: Date.now() - t0 } } catch (e) { return { status: 0, err: e.message, ms: Date.now() - t0 } } }
const reg = (o, h) => raw('/api/register', JSON.stringify({ name: 'Persona Abuso', email: em(), password: pass, acceptedTerms: true, termsVersion: '2026-11-v2', ...o }), h)
;(async () => {
  if (MODE === 'hostile') {
    const hostile = {
      'nombre de 101 caracteres': { name: 'a'.repeat(101) }, 'nombre con NUL': { name: 'Ana\u0000Gomez' }, 'nombre con ZWSP': { name: 'Ana​Gomez' }, 'nombre con RLO': { name: 'Ana‮Gomez' }, 'nombre vacío': { name: '   ' }, 'nombre numérico (tipo)': { name: 12345 }, 'nombre objeto': { name: { a: 1 } },
      'correo de 255 caracteres': { email: 'a'.repeat(243) + '@example.test' }, 'correo con salto de línea': { email: 'a@example.test\nBcc: x@y.z' }, 'correo sin arroba': { email: 'noesuncorreo' },
      'contraseña débil': { password: 'abc' }, 'contraseña de 10 000 caracteres': { password: 'Aa1!' + 'x'.repeat(10000) }, 'contraseña arreglo': { password: ['a'] },
      'sin aceptar términos': { acceptedTerms: false }, 'versión de términos vieja': { termsVersion: '2020-01-v1' }, 'términos como cadena': { acceptedTerms: 'yes' },
    }
    for (const [label, o] of Object.entries(hostile)) { const r = await reg(o); check(`R4 registro hostil «${label}» → 4xx (sin 5xx ni cuenta)`, r.status >= 400 && r.status < 500 && r.status !== 429, r.status + ' ' + (r.txt || r.err || '').slice(0, 120)) }
    for (const [label, body] of Object.entries({ 'JSON malformado': '{"name":', 'cuerpo vacío': '', 'JSON no objeto': '[1,2,3]', 'null': 'null' })) { const r = await raw('/api/register', body); check(`R4 «${label}» → 4xx`, r.status >= 400 && r.status < 500, r.status + ' ' + (r.txt || r.err || '').slice(0, 100)) }
    const big = await raw('/api/register', JSON.stringify({ name: 'x', email: em(), password: pass, pad: 'x'.repeat(2 * 1024 * 1024) })); check('R4 cuerpo de 2 MB → rechazado (4xx, p. ej. 413) y el servidor sigue vivo', big.status >= 400 && big.status < 500 && (await raw('/api/health', undefined, {}, 'GET')).status === 200, big.status + ' ' + (big.txt || big.err || '').slice(0, 100))
  } else if (MODE === 'timing') {
    const mail = em(); const a = await reg({ email: mail }), b = await reg({ email: mail }); check('R4 correo repetido: segundo registro 400 sin 5xx', a.status === 201 && b.status === 400, a.status + '/' + b.status)
    // R3 tiempos existente vs nuevo (sin enumeración por tiempo): 5 de cada uno
    const ts = async (dup) => { const v = []; for (let i = 0; i < 5; i++) v.push((await reg(dup ? { email: mail } : {})).ms); return v.sort((x, y) => x - y)[2] }
    const tn = await ts(false), td = await ts(true); info('R3 mediana de tiempo registro nuevo vs duplicado:', tn, td, 'ms'); check('R3 «correo ya registrado» no es distinguible por tiempo (diferencia < max(150 ms, 50 %))', Math.abs(tn - td) < Math.max(150, 0.5 * Math.max(tn, td)), `${tn}/${td}`)
    const e1 = await reg({ email: mail }); info('R3 mensaje de duplicado:', JSON.stringify(e1.body)); info('R3 (decisión de producto conocida) «ya registrado» sigue distinguible por mensaje: permite enumerar correos dentro del tope por IP')
    // R6 login: tope por minuto, bloqueo por cuenta, mensajes sin enumeración
    const user = em(); await reg({ email: user }); const mk = (email) => raw('/api/login', JSON.stringify({ email, password: 'Mala-' + crypto.randomBytes(3).toString('hex') + 'A1!' }))
    const rs = []; for (let i = 0; i < 12; i++) rs.push((await mk(user)).status); info('R6 login con contraseña mala x12 (misma cuenta):', rs.join(','))
    check('R6 login: tras fallos repetidos hay límite (429) o bloqueo de cuenta (423/403), no 5xx', rs.some((s) => [429, 423, 403].includes(s)) && !rs.some((s) => s >= 500), rs.join(','))
    const ghost = await mk(em()); const real = await mk(user); info('R6 mensajes: inexistente →', ghost.status, JSON.stringify(ghost.body), '| existente →', real.status, JSON.stringify(real.body))
  } else {
    // R1 tope por IP: 30 por hora; el intento 31 recibe 429. R2 concurrencia. XFF falsificado.
    const salud0 = await raw('/api/health', undefined, {}, 'GET'); const rs = await Promise.all(Array.from({ length: 40 }, () => reg({})))
    const cnt = rs.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a }, {}); info('R1/R2 40 registros SIMULTÁNEOS desde una IP:', JSON.stringify(cnt))
    check('R1 tope por IP: como máximo 30 cuentas creadas por hora desde una IP (201)', (cnt[201] || 0) <= 30, JSON.stringify(cnt))
    check('R2 ninguna respuesta 5xx salvo 503 server_busy (cola acotada) y 429', Object.keys(cnt).every((s) => Number(s) < 500 || s === '503'), JSON.stringify(cnt))
    const hp = await Promise.all(Array.from({ length: 5 }, () => raw('/api/health', undefined, {}, 'GET'))); check('R2 /api/health sigue respondiendo durante y después de la ráfaga', hp.every((r) => r.status === 200), hp.map((r) => r.status + '/' + r.ms + 'ms').join(' '))
    const after = await reg({}); check('R1 el intento siguiente (ya agotado el tope) recibe 429', after.status === 429, after.status + ' ' + (after.txt || '').slice(0, 100))
    const spoof = await reg({}, { 'x-forwarded-for': '203.0.113.' + Math.floor(Math.random() * 200 + 1) }); check('R5 X-Forwarded-For falsificado NO evade el tope (sin proxy de confianza configurado)', spoof.status === 429, spoof.status + ' ' + (spoof.txt || '').slice(0, 100))
    const spoof2 = await reg({}, { 'x-forwarded-for': '198.51.100.7, 203.0.113.9', 'x-real-ip': '192.0.2.5' }); check('R5 cadena X-Forwarded-For y X-Real-IP falsificados tampoco evaden', spoof2.status === 429, spoof2.status)
    const lg = await raw('/api/login', JSON.stringify({ email: em(), password: 'x' })); info('login mientras el registro está agotado (limitadores independientes):', lg.status)
    info('cuentas creadas en la ráfaga:', cnt[201] || 0)
  }
  console.log(`ABUSO ${MODE}: ${ok} correctas, ${bad} fallos`); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
