// QA-Claude-2 — ES-128 (PR 126): política de contraseña del registro contra backend REAL (Postgres local) en loopback.
// Env: BASE (http://localhost:8090), PG (cadena de la base local para contar filas), PWPOL (ruta a shared/registration-password-policy.json),
// CLIENTMOD (opcional: ruta al módulo cliente transpilado para contrastar cliente/servidor).
// Datos sintéticos @example.test. 0 llamadas a IA.
const BASE = (process.env.BASE || 'http://localhost:8090').replace(/\/$/, '')
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) process.exit(2)
const { Client } = require(process.env.PGMODULE || 'pg')
const policy = require(process.env.PWPOL)
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const tag = Date.now().toString(36); let n = 0
const em = () => `qa2-${tag}-${++n}@example.test`
const post = async (path, body, raw) => { const t = Date.now(); const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null), ms: Date.now() - t } }
const reg = (password, extra = {}) => post('/api/register', { name: 'QA2 pw', email: em(), password, ...extra })
const miss = r => (r.j?.missing || []).join(',')
;(async () => {
  const pg = new Client({ connectionString: process.env.PG }); await pg.connect()
  const rows = async () => Number((await pg.query('SELECT count(*) FROM "Users"')).rows[0].count)
  // F1 reglas por separado
  const cases = [
    ['F1 7 caracteres (Aa1!xyz)', 'Aa1!xyz', 'length'], ['F1 sin mayúscula', 'aa1!aaaa', 'upper'], ['F1 sin minúscula', 'AA1!AAAA', 'lower'],
    ['F1 sin número', 'Aa!aaaaa', 'digit'], ['F1 sin especial', 'Aa1aaaaa', 'special'], ['F1 solo minúsculas 8', 'aaaaaaaa', 'upper,digit,special'],
    ['F1 solo dígitos 8', '12345678', 'upper,lower,special'], ['F1 una letra', 'a', 'length,upper,digit,special'],
    ['F2 espacio no es especial', 'Aa1 aaaa', 'special'], ['F2 tab/NBSP no son especiales', 'Aa1\t aaa', 'special'],
    ['F2 dígito árabe-índico no es número', 'Aa١!aaaa', 'digit'], ['F2 CJK sin mayúscula/minúscula', '密码密码密码1!', 'upper,lower'],
    ['F2 Ñ mayúscula + ñ + tilde válido', 'Ñandú1!ñ', ''], ['F2 emoji como especial', 'Aa1😀aaaa', ''], ['F2 guion bajo como especial', 'Aa1_aaaa', ''],
    ['F1 8 exactos válidos', 'Abcdef1!', ''], ['F2 griego (mayús/minús) válido', 'Αβγδεζ1!', ''],
  ]
  for (const [name, pw, want] of cases) { const r = await reg(pw); ck(name, want ? (r.s === 400 && r.j?.code === 'password_policy' && miss(r) === want) : r.s === 201, `${r.s} missing=${miss(r)} (esperado ${want || '201'})`) }
  // F2b marca combinante como especial (observación)
  { const r = await reg('Contraseña1x'); console.log(`INFO F2 solo marca combinante (n+U+0303) sin símbolo: ${r.s} missing=${miss(r)} ${r.s === 201 ? '(la marca combinante cuenta como especial)' : ''}`) }
  // F3 bytes
  { const mk = k => 'Aa1!' + 'a'.repeat(k)
    let r = await reg(mk(68)); ck('F3 72 bytes exactos aceptada', r.s === 201, r.s)
    r = await reg(mk(69)); ck('F3 73 bytes → max_bytes', r.s === 400 && miss(r) === 'max_bytes', `${r.s} ${miss(r)}`)
    r = await reg('Aa1!' + '😀'.repeat(17)); ck('F3 4+68 bytes con emojis (72) aceptada', r.s === 201, `${r.s} ${miss(r)}`)
    r = await reg('Aa1!' + '😀'.repeat(18)); ck('F3 76 bytes con emojis → max_bytes', r.s === 400 && miss(r) === 'max_bytes', `${r.s} ${miss(r)}`)
    r = await reg('Aa1!' + 'ñ'.repeat(35)); ck('F3 74 bytes con ñ → max_bytes (cuenta bytes, no caracteres)', r.s === 400 && miss(r) === 'max_bytes', `${r.s} ${miss(r)}`)
    // sin truncado: dos pass que difieren tras el byte 72
    const base = 'Aa1!' + 'a'.repeat(68), e = em()
    await post('/api/register', { name: 'x', email: e, password: base }); const l = await post('/api/login', { email: e, password: base + 'ZZ' })
    console.log('INFO F3 login con la contraseña de 72 bytes + sufijo: '+l.s+' (bcrypt compara solo los primeros 72 bytes; el registro ya no permite crear contraseñas >72 bytes, así que no hay truncado silencioso al crear)') }
  // F4 comunes
  for (const c of policy.common) for (const v of [c, c.toUpperCase(), ' ' + c + ' ']) { const r = await reg(v); const okc = r.s === 400 && r.j?.code === 'password_policy' && (miss(r) === 'common' || (r.j.missing || []).includes('common') || (r.j.missing || []).length > 0); if (!okc) ck(`F4 común rechazada «${v}»`, false, `${r.s} ${miss(r)}`) }
  { let bad = 0; for (const c of policy.common) { const r = await reg(c); if (!(r.s === 400 && (r.j.missing || []).includes('common')) && !(r.j?.missing || []).length) bad++ } ck(`F4 las ${policy.common.length} entradas de la lista se rechazan (las que cumplen complejidad, con «common»)`, bad === 0, 'sin rechazo=' + bad) }
  { const r = await reg('Password1!x'); ck('F4 variante fuera de lista se acepta (límite declarado)', r.s === 201, r.s) }
  // F5 extremas
  const ext = [['vacía', ''], ['solo espacios', '        '], ['null', null], ['número', 12345678], ['arreglo', ['Aa1!aaaa']], ['objeto', { a: 1 }], ['booleano', true], ['10.000 caracteres', 'Aa1!' + 'a'.repeat(10000)], ['1 MB', 'Aa1!' + 'a'.repeat(1024 * 1024)], ['nulos', 'Aa1!\u0000aaaa'], ['RTL', 'Aa1!‮aaaa'], ['sin campo', undefined]]
  for (const [name, v] of ext) { const r = await post('/api/register', { name: 'x', email: em(), ...(v === undefined ? {} : { password: v }) }); { const lenient = name === 'nulos' || name === 'RTL'; ck(`F5 ${name} → ${lenient ? 'sin 5xx (cumple la política: es válida)' : '4xx controlado'}`, lenient ? r.s < 500 : (r.s >= 400 && r.s < 500), `${r.s} ${r.j?.code || ''}`) } }
  { const r = await post('/api/register', null, '{"name":'); ck('F5 JSON roto → 4xx', r.s >= 400 && r.s < 500, r.s) }
  // F6 enumeración / orden
  { const e = em(); const a = await post('/api/register', { name: 'x', email: e, password: 'Valida1!ok' }); ck('F6 alta base', a.s === 201, a.s)
    const w = await post('/api/register', { name: 'x', email: e, password: 'weak' }), w2 = await post('/api/register', { name: 'x', email: em(), password: 'weak' })
    ck('F6 correo existente + débil = igual que correo nuevo + débil (sin enumeración)', w.s === w2.s && w.j?.code === w2.j?.code && miss(w) === miss(w2), `${w.s}/${w2.s}`)
    const d = await post('/api/register', { name: 'x', email: e, password: 'Valida1!ok' }); ck('F6 correo existente + válida mantiene error de duplicado', d.s >= 400 && d.s < 500 && d.j?.code !== 'password_policy', `${d.s} ${JSON.stringify(d.j).slice(0, 80)}`)
    await pg.query('UPDATE "Users" SET "isActive"=false WHERE email=$1', [e]).catch(() => pg.query('UPDATE "Users" SET active=false WHERE email=$1', [e]))
    const i = await post('/api/register', { name: 'x', email: e, password: 'Valida1!ok' }); const st = await pg.query('SELECT * FROM "Users" WHERE email=$1', [e])
    ck('F6 cuenta inactiva no se reactiva por registro', i.s >= 400, `${i.s}`) ; void st }
  // F12 login antiguo + registro punta a punta + S3 + S2
  { const e = em(); const bcrypt = require(process.env.BCRYPT || 'bcryptjs'); const h = await bcrypt.hash('abc', 10)
    await pg.query('INSERT INTO "Users"(name,email,password,role,"createdAt","updatedAt") VALUES ($1,$2,$3,\'user\',now(),now())', ['Antigua', e, h]).catch(e2 => console.log('INFO insert antiguo:', e2.message.slice(0, 80)))
    const l = await post('/api/login', { email: e, password: 'abc' }); ck('F12 cuenta antigua con contraseña corta sigue entrando', l.s === 200 && !!l.j?.token, l.s) }
  { const e = em(); const r = await post('/api/register', { name: 'QA2 ok', email: e, password: 'Valida1!ok', role: 'superadmin', isAdmin: true, userId: 1 })
    const u = (await pg.query('SELECT role,password FROM "Users" WHERE email=$1', [e])).rows[0]
    ck('F12/S3 registro válido 201, rol user aunque el cliente envíe role=superadmin', r.s === 201 && u?.role === 'user', `${r.s} rol=${u?.role}`)
    ck('F12 contraseña guardada con bcrypt (no en claro)', /^\$2[aby]\$/.test(u?.password || ''), (u?.password || '').slice(0, 7))
    ck('S1 la respuesta no contiene la contraseña ni el hash', !JSON.stringify(r.j).includes('Valida1!ok') && !JSON.stringify(r.j).includes(u?.password || '#'))
    const l = await post('/api/login', { email: e, password: 'Valida1!ok' }); ck('F12 login con la cuenta nueva', l.s === 200, l.s) }
  { const b = await rows(); for (const p of ['weak', 'Aa1aaaaa', 'x'.repeat(200)]) await reg(p); ck('S2 rechazos por política no crean filas', (await rows()) === b, `${b}→${await rows()}`) }
  // S4 inyección en nombre/correo
  for (const [name, nm, mail] of [['SQL en nombre', "x'); DROP TABLE \"Users\";--", em()], ['HTML en nombre', '<script>alert(1)</script>', em()], ['nulos/RTL', 'a\u0000b‮', em()], ['correo SQL', 'x', `a'--${tag}@example.test`]]) { const r = await post('/api/register', { name: nm, email: mail, password: 'Valida1!ok' }); ck(`S4 ${name} sin 5xx`, r.s < 500, r.s) }
  ck('S4 tabla Users íntegra', (await rows()) > 0)
  // S8 enumeración en login
  { const a = await post('/api/login', { email: em(), password: 'Zz9!zzzzz' }); const e = em(); await post('/api/register', { name: 'x', email: e, password: 'Valida1!ok' }); const b = await post('/api/login', { email: e, password: 'Mala1!mala' })
    ck('S8 login: usuario inexistente vs contraseña mala dan el mismo código y mensaje', a.s === b.s && JSON.stringify(a.j) === JSON.stringify(b.j), `${a.s}/${b.s}`) }
  // Rendimiento
  { const ms = []; for (let i = 0; i < 9; i++) ms.push((await reg('Valida1!ok')).ms); ms.sort((a, b) => a - b); ck('P1 registro válido mediana < 1000 ms', ms[4] < 1000, `mediana=${ms[4]} ms (min ${ms[0]}, max ${ms[8]})`)
    const rj = []; for (let i = 0; i < 20; i++) rj.push((await reg('weak')).ms); rj.sort((a, b) => a - b); ck('P2 rechazo por política mediana < 100 ms', rj[10] < 100, `mediana=${rj[10]} ms (max ${rj[19]})`)
    const par = await Promise.all(Array.from({ length: 10 }, (_, i) => reg(i % 2 ? 'weak' : 'Valida1!ok'))); ck('P3 10 registros simultáneos sin 5xx y resultado correcto', par.every((r, i) => (i % 2 ? r.s === 400 : r.s === 201)), par.map(r => r.s).join(',')) }
  // F7 contraste cliente/servidor
  if (process.env.CLIENTMOD) {
    const cm = await import(require('url').pathToFileURL(process.env.CLIENTMOD).href); const gen = []
    const alph = ['a', 'A', '1', '!', ' ', 'ñ', 'Ñ', '😀', 'é', '٣', '密', '_', '́', 'Z', '9']
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    for (let i = 0; i < 200; i++) { const len = 1 + Math.floor(rnd() * 12); gen.push(Array.from({ length: len }, () => alph[Math.floor(rnd() * alph.length)]).join('')) }
    gen.push(...policy.common, 'Aa1!' + 'a'.repeat(69))
    let diff = 0; for (const p of gen) { const c = cm.passwordProblems(p).slice().sort().join(','); const r = await reg(p); const s = r.s === 201 ? '' : (r.j?.missing || []).slice().sort().join(','); if (c !== s && !(r.s >= 400 && !r.j?.missing)) { diff++; if (diff < 6) console.log('   difiere:', JSON.stringify(p), 'cliente=', c, 'servidor=', s, r.s) } }
    ck(`F7 cliente y servidor coinciden en ${gen.length} casos generados + lista de comunes`, diff === 0, 'diferencias=' + diff) }
  await pg.end(); console.log(f ? 'FALLAS ' + f : 'TODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })
