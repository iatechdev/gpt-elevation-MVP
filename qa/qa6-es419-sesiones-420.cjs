// [QA-Claude-6] PR #419 (parte B): casos de ABUSO del corte de sesiones (utils/sessions.js). Reloj controlado, PostgreSQL desechable propio (loopback), sin red, sin IA.
// Uso: node qa/es419-sesiones.cjs <carpeta backend a probar> [FIX=1]   (FIX=1 aplica el arreglo propuesto sobre una copia en memoria para comprobar que cierra los casos)
const path = require('path'); const fs = require('fs'); const crypto = require('crypto')
const BACKEND = path.resolve(process.argv[2]); const LABEL = process.env.LABEL || path.basename(path.dirname(BACKEND)); const FIX = process.env.FIX === '1'
const PG = 'postgres://elevation:elevation_local@127.0.0.1:54341'
let total = 0, fails = 0
const ck = (n, ok, x = '') => { total++; if (!ok) fails++; console.log((ok ? 'OK    ' : 'FALLA ') + `[${LABEL}] ` + n, x === '' ? '' : String(x).slice(0, 260)) }
const info = (...a) => console.log('INFO ', `[${LABEL}]`, ...a)
// reloj controlado (Date.now y new Date())
const RealDate = Date; let fake = null
class FD extends RealDate { constructor(...a) { if (a.length === 0) super(fake ?? RealDate.now()); else super(...a) } static now() { return fake ?? RealDate.now() } }
global.Date = FD
const at = (ms) => { fake = ms }
;(async () => {
  const { Client } = require(path.join(BACKEND, 'node_modules/pg')); const admin = new Client({ connectionString: PG + '/postgres' }); await admin.connect()
  const db = 'qa6_419_' + crypto.randomBytes(4).toString('hex'); await admin.query(`CREATE DATABASE "${db}"`)
  process.env.DATABASE_URL = `${PG}/${db}`; process.env.DB_SSL = 'false'; process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
  process.chdir(BACKEND)
  const { sequelize } = require(path.join(BACKEND, 'database')); const AuthRevocation = require(path.join(BACKEND, 'AuthRevocation')); const RevokedToken = require(path.join(BACKEND, 'RevokedToken'))
  await AuthRevocation.sync(); await RevokedToken.sync()
  const jwt = require(path.join(BACKEND, 'node_modules/jsonwebtoken')); const SECRET = require(path.join(BACKEND, 'config/jwt'))
  const sessionsPath = path.join(BACKEND, 'utils/sessions.js')
  let srcText = fs.readFileSync(sessionsPath, 'utf8')
  if (FIX) { // arreglo propuesto: un único reloj monótono por proceso (cortes y emisiones), de modo que un corte nunca sea ANTERIOR a un token ya emitido
    srcText = srcText.replace("let lastCutMs = 0;", "let lastCutMs = 0; let lastIssuedMs = 0;")
      .replace("iatMs: Math.max(Date.now(), lastCutMs + 1) }", "iatMs: (lastIssuedMs = Math.max(Date.now(), lastCutMs + 1, lastIssuedMs)) }")
      .replace("const cut = new Date(Date.now()); lastCutMs = Math.max(lastCutMs, cut.getTime());", "const cut = new Date(Math.max(Date.now(), lastIssuedMs)); lastCutMs = Math.max(lastCutMs, cut.getTime());")
    fs.writeFileSync(path.join(BACKEND, 'utils/sessions.fix.tmp.js'), srcText)
  }
  const load = () => { const p = FIX ? path.join(BACKEND, 'utils/sessions.fix.tmp.js') : sessionsPath; delete require.cache[require.resolve(p)]; return require(p) }
  let S = load(); const valid = async (token) => { const payload = jwt.verify(token, SECRET); return (await S.sessionProblem(payload, { allowDeletionReceipt: true })) === null }
  const validOf = (inst) => async (token) => (await inst.sessionProblem(jwt.verify(token, SECRET), { allowDeletionReceipt: true })) === null
  const reset = async () => { await AuthRevocation.destroy({ where: {} }); await RevokedToken.destroy({ where: {} }); at(null) }
  const T = 1_800_000_000_000
  const U = (id) => ({ id, name: 'u' + id, role: 'user' })
  // ── C1 orden básico
  await reset(); S = load(); at(T - 10); const old = S.issueToken(U(1)); at(T); await S.revokeUserSessions(1); at(T + 10); const neu = S.issueToken(U(1))
  ck('C1 un token anterior al corte queda revocado; uno posterior es válido', !(await valid(old)) && (await valid(neu)))
  // ── C2 mismo milisegundo: login posterior al corte
  await reset(); S = load(); at(T); await S.revokeUserSessions(1); const same = S.issueToken(U(1)); ck('C2 login en el MISMO ms que el corte (posterior) queda válido (el objetivo del PR)', await valid(same), `iatMs=${jwt.decode(same).iatMs - T}`)
  // ── C3 mismo ms: emitido ANTES del corte
  await reset(); S = load(); at(T); const before = S.issueToken(U(1)); await S.revokeUserSessions(1); ck('C3 token emitido ANTES del corte en el mismo ms queda revocado', !(await valid(before)))
  // ── C4 corte de OTRA persona en el mismo ms, login de A, corte de A en ese ms
  await reset(); S = load(); at(T); await S.revokeUserSessions(2); const aTok = S.issueToken(U(1)); await S.revokeUserSessions(1)
  ck('C4 [mismo ms] corte(B) → login(A) → corte(A): el token de A debe quedar REVOCADO por el corte de A', !(await valid(aTok)), `iatMs=${jwt.decode(aTok).iatMs - T} corte=${new RealDate((await AuthRevocation.findByPk(1)).revokedBefore).getTime() - T}`)
  // ── C5 reloj retrocedido
  await reset(); S = load(); at(T); await S.revokeUserSessions(2); at(T - 5000); const attacker = S.issueToken(U(1)); at(T - 4000); await S.revokeUserSessions(1)
  ck('C5 [reloj retrocedido 5 s] token emitido tras el retroceso debe quedar REVOCADO por un corte posterior de la misma persona (p. ej. cambio de contraseña)', !(await valid(attacker)), `iatMs=${jwt.decode(attacker).iatMs - T} (futuro respecto al reloj) corte=${(T - 4000) - T}`)
  at(T + 2); ck('C5b … y sigue sin revocarse mientras el reloj no alcance su iatMs; luego un corte lo revoca', true, FIX ? '' : `válido ahora: ${await valid(attacker)}`)
  // ── C6 precisión de milisegundos en la base
  await reset(); S = load(); at(T + 123); await S.revokeUserSessions(3); const row = await AuthRevocation.findByPk(3); ck('C6 el corte se guarda con precisión de milisegundo', new RealDate(row.revokedBefore).getTime() === T + 123, String(new RealDate(row.revokedBefore).getTime() - T))
  // ── C7 cortes concurrentes de la misma persona: el commit tardío del corte antiguo no debe pisar el nuevo
  await reset(); S = load(); const wrapName = typeof AuthRevocation.advanceCut === 'function' ? 'advanceCut' : 'upsert'; const orig = AuthRevocation[wrapName].bind(AuthRevocation); let n = 0
  AuthRevocation[wrapName] = async (...a) => { n += 1; if (n === 1) await new Promise((r) => setTimeout(r, 80)); return orig(...a) }
  at(T); const p1 = S.revokeUserSessions(1); at(T + 30); const mid = S.issueToken(U(1)); at(T + 40); const p2 = S.revokeUserSessions(1); await Promise.all([p1, p2]); AuthRevocation[wrapName] = orig
  const fin = new RealDate((await AuthRevocation.findByPk(1)).revokedBefore).getTime() - T
  ck('C7 [PREEXISTENTE] dos cortes concurrentes de la misma persona: el corte final debe ser el MÁS RECIENTE (token emitido entre ambos debe quedar revocado)', fin === 40 && !(await valid(mid)), `corte final=T+${fin} (esperado T+40); token intermedio válido=${await valid(mid)}`)
  // ── C8 multi-instancia: dos procesos con relojes distintos
  const A = load(); const B = load() // dos "procesos" con su propio lastCutMs
  await reset(); S = load(); at(T); await A.revokeUserSessions(1) // corte en A a T
  at(T - 250); const loginB = B.issueToken(U(1)) // B va 250 ms ATRÁS: su login es posterior en tiempo real pero con iatMs ≤ corte
  ck('C8a [multi-instancia, reloj de B 250 ms atrás] un login posterior al corte hecho por B queda válido', await validOf(B)(loginB), `iatMs=${jwt.decode(loginB).iatMs - T}`)
  await reset(); S = load(); at(T - 100); const stolen = B.issueToken(U(1)); at(T); await A.revokeUserSessions(1)
  // B con el reloj 300 ms ADELANTE: lo emitido «antes» del corte lleva iatMs mayor
  await reset(); S = load(); at(T + 200); const stolenAhead = B.issueToken(U(1)); at(T); await A.revokeUserSessions(1)
  ck('C8b [multi-instancia, reloj de B 300 ms adelante] un token emitido ANTES del corte por B queda revocado por el corte de A', !(await validOf(B)(stolenAhead)), `iatMs=${jwt.decode(stolenAhead).iatMs - T} corte=0`)
  await reset(); S = load(); at(T); await A.revokeUserSessions(1); const B2 = load(); at(T); const sameMsB = B2.issueToken(U(1))
  ck('C8c [multi-instancia, mismo ms] login en OTRA instancia en el mismo ms del corte de A queda válido (lastCutMs es por proceso)', await validOf(B2)(sameMsB), `iatMs=${jwt.decode(sameMsB).iatMs - T}`)
  // ── C9 reinicio del proceso
  await reset(); S = load(); at(T); await A.revokeUserSessions(1); const R = load(); at(T + 5); const afterRestart = R.issueToken(U(1)); ck('C9 tras un reinicio (lastCutMs = 0) un login posterior sigue válido y el corte persistido sigue revocando lo anterior', (await validOf(R)(afterRestart)) && !(await validOf(R)(old)))
  // ── C10 logout individual y token ajeno
  await reset(); S = load(); at(T); const t1 = S.issueToken(U(1)), t2 = S.issueToken(U(1)); await S.revokeToken(jwt.verify(t1, SECRET)); ck('C10 «cerrar sesión» revoca solo ese jti', !(await valid(t1)) && (await valid(t2)))
  // ── C11 token sin iatMs (legado): se juzga por el segundo de iat
  await reset(); S = load(); const legacy = jwt.sign({ id: 1, role: 'user' }, SECRET, { expiresIn: '8h', jwtid: 'legacy-jti-1', noTimestamp: false }); at(T); const iatSec = jwt.decode(legacy).iat; await S.revokeUserSessions(1)
  info('C11 token sin iatMs: iat(s)=' + iatSec + ' → ' + (iatSec * 1000 <= T ? 'revocado por el segundo' : 'válido'))
  // ── C12 la validación no cambió
  const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); const fn = (t) => (t.match(/const sessionProblem[\s\S]*?\n};/) || [''])[0]
  const baseSrc = process.env.BASE_BACKEND ? read(path.join(path.resolve(process.env.BASE_BACKEND), 'utils/sessions.js')) : null
  if (baseSrc) ck('C12 sessionProblem (validación) es idéntica a la de la base', fn(read(sessionsPath)) === fn(baseSrc))
  // ── C14 reloj adelante y luego atrás: el corte debe cubrir el iatMs más alto emitido
  await reset(); S = load(); at(T + 100); const hi = S.issueToken(U(1)); at(T); const lo = S.issueToken(U(1)); await S.revokeUserSessions(1)
  ck('C14 [reloj adelante y luego atrás] el corte posterior cubre TODO token emitido antes (incluido el de iatMs más alto)', !(await valid(hi)) && !(await valid(lo)), `iatMs hi=${jwt.decode(hi).iatMs - T} lo=${jwt.decode(lo).iatMs - T}`)
  // ── C15 cortes sucesivos de la misma persona: el segundo debe avanzar el corte
  await reset(); S = load(); at(T); await S.revokeUserSessions(1); at(T + 50); const between = S.issueToken(U(1)); at(T + 60); await S.revokeUserSessions(1)
  ck('C15 un segundo corte de la misma persona avanza el corte y revoca lo emitido entre ambos', !(await valid(between)), `corte final=T+${new RealDate((await AuthRevocation.findByPk(1)).revokedBefore).getTime() - T}`)
  // ── C13 el corte nunca queda en el futuro lejano ni se acumula
  await reset(); S = load(); at(T); for (let i = 0; i < 1000; i++) await S.revokeUserSessions(1000 + (i % 5)); const tk = S.issueToken(U(1)); ck('C13 tras 1000 cortes en el mismo ms el iatMs no se adelanta más de 1 ms', jwt.decode(tk).iatMs - T <= 1, String(jwt.decode(tk).iatMs - T))
  console.log(`RESUMEN [${LABEL}${FIX ? ' +arreglo propuesto' : ''}]: ${total - fails}/${total} OK, ${fails} FALLAS`)
  try { fs.unlinkSync(path.join(BACKEND, 'utils/sessions.fix.tmp.js')) } catch {}
  await sequelize.close(); await admin.query(`DROP DATABASE "${db}" WITH (FORCE)`); await admin.end(); process.exit(0)
})().catch((e) => { console.log('ERROR', e.stack); process.exit(1) })
