// [QA-Claude-3] PR #423 (ES-366): versión de sesión por persona. DOS instancias del backend REAL sobre la misma base (8190 reloj +10 min, 8191 reloj −10 min) con qa/start-pair.sh. Datos sintéticos, 0 IA.
// Uso: bash qa/run.sh e423-sesiones.cjs main <db>   (la «build» no se usa; solo API)
const L = require('./lib3.cjs'); const { ck, info, mk, call, dbq, PASS, crypto } = L
const BP = process.env.API_B || 'http://localhost:8191'
const callB = async (m, p, t, b) => { const r = await fetch(BP + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.clone().json() } catch {} return { s: r.status, j } }
const login = async (U, c = call) => (await c('POST', '/api/login', null, { email: U.email, password: process.env.PW || PASS })).j?.token
const sess = (t, c = call) => c('GET', '/api/session', t).then(r => r.s)
const ver = async id => (await dbq('SELECT "sessionVersion" AS v, "revokedBefore" AS rb FROM "AuthRevocations" WHERE "UserId"=$1', [id]))[0]
const claims = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString())
;(async () => {
  await L.DB.connect()
  const A = await mk('user', 'A-423'), B = await mk('user', 'B-423'), AD = await mk('admin', 'AD-423'); const adT = await login(AD)
  // F1 login/logout
  { const t = await login(A); const c = claims(t); ck('F1 el login firma `sv` entero = 0 (sin fila previa) e iatMs', c.sv === 0 && Number.isFinite(c.iatMs), JSON.stringify({ sv: c.sv })); ck('F1 /session 200 en ambas instancias (reloj +10 y −10)', (await sess(t)) === 200 && (await sess(t, callB)) === 200, '')
    await call('POST', '/api/logout', t); ck('F1 tras logout: 401 en ambas instancias', (await sess(t)) === 401 && (await sess(t, callB)) === 401, ''); const t2 = await login(A, callB); ck('F1 login nuevo (instancia B) vale en A y B', (await sess(t2)) === 200 && (await sess(t2, callB)) === 200, '') }
  // F2 logout-all
  { const a1 = await login(A), a2 = await login(A, callB), b1 = await login(B); const r = await call('POST', '/api/logout-all', a1); const v1 = await ver(A.id)
    ck('F2 logout-all 200 y la versión sube a 1', r.s === 200 && v1.v === 1, JSON.stringify(v1)); ck('F2 ambas sesiones de A (emitidas en A y en B) → 401 en ambas instancias', (await Promise.all([sess(a1), sess(a2), sess(a1, callB), sess(a2, callB)])).every(s => s === 401), '')
    ck('F2 B intacta (200) en ambas instancias y sin fila de corte', (await sess(b1)) === 200 && (await sess(b1, callB)) === 200 && !(await ver(B.id)), ''); const a3 = await login(A, callB); ck('F2 login nuevo de A lleva sv=1 y vale en ambas', claims(a3).sv === 1 && (await sess(a3)) === 200 && (await sess(a3, callB)) === 200, '')
    const r2 = await callB('POST', '/api/logout-all', a3); ck('F2 segundo logout-all desde la OTRA instancia → versión 2 y a3 revocada en las dos', r2.s === 200 && (await ver(A.id)).v === 2 && (await sess(a3)) === 401 && (await sess(a3, callB)) === 401, '') }
  // F3 rol y estado
  { const U = await mk('user', 'R-423'); const t = await login(U); const r = await call('PUT', `/api/admin/usuarios/${U.id}`, adT, { role: 'therapist' }); info('cambio de rol →', r.s, JSON.stringify(r.j).slice(0, 80))
    ck('F3 cambio de rol: 200, versión sube y el token anterior queda revocado en ambas', r.s === 200 && (await ver(U.id))?.v === 1 && (await sess(t)) === 401 && (await sess(t, callB)) === 401, '')
    const t2 = await login(U, callB); ck('F3 login posterior vale en ambas', claims(t2).sv === 1 && (await sess(t2)) === 200 && (await sess(t2, callB)) === 200, '')
    const r2 = await call('PUT', `/api/admin/usuarios/${U.id}`, adT, { active: false }); const lg = await call('POST', '/api/login', null, { email: U.email, password: PASS }); ck('F3 desactivar: 200, token anterior 401 y no puede iniciar sesión', r2.s === 200 && (await sess(t2)) === 401 && (await sess(t2, callB)) === 401 && lg.s >= 400, `${r2.s}/${lg.s}`)
    const r3 = await call('PUT', `/api/admin/usuarios/${U.id}`, adT, { active: true }); const t3 = await login(U, callB); ck('F3 reactivar también corta (sv=3: rol=1, desactivar=2, reactivar=3), login nuevo vale y el viejo sigue 401', r3.s === 200 && claims(t3).sv === 3 && (await sess(t3)) === 200 && (await sess(t2)) === 401, `${r3.s} ${claims(t3).sv}`) }
  // F4 reset
  { const U = await mk('user', 'P-423'); const t = await login(U), tb = await login(U, callB); const tok = crypto.randomBytes(24).toString('hex'); await dbq(`INSERT INTO "PasswordResets"("UserId","tokenHash","expiresAt","createdAt","updatedAt") VALUES ($1,$2,now()+interval '30 minutes',now(),now())`, [U.id, crypto.createHash('sha256').update(tok).digest('hex')])
    const NP = crypto.randomBytes(8).toString('hex') + 'Zz9!'; const r = await callB('POST', '/api/password-reset/confirm', null, { token: tok, password: NP }); ck('F4 reset de contraseña 200', r.s === 200, `${r.s} ${JSON.stringify(r.j).slice(0, 80)}`)
    ck('F4 ambas sesiones previas → 401 en las dos instancias', (await Promise.all([sess(t), sess(tb), sess(t, callB), sess(tb, callB)])).every(s => s === 401), ''); const n1 = await call('POST', '/api/login', null, { email: U.email, password: NP }); ck('F4 login con la contraseña nueva vale (sv=1) y la anterior ya no', n1.s === 200 && claims(n1.j.token).sv === 1 && (await call('POST', '/api/login', null, { email: U.email, password: PASS })).s === 401, '') }
  // F5 60 ciclos con relojes desfasados (+10 / −10), corte en una instancia y comprobación en la otra
  { const U = await mk('user', 'C-423'), N = 60; let oldRev = 0, newOk = 0, crossOldRev = 0, crossNewOk = 0
    for (let i = 0; i < N; i++) { const [cutter, other] = i % 2 ? [call, callB] : [callB, call]
      const old = await login(U, other), old2 = await login(U, cutter); await cutter('POST', '/api/logout-all', old2); const nw = await login(U, other)
      const [a, b, c, d] = await Promise.all([sess(old, cutter), sess(old, other), sess(nw, cutter), sess(nw, other)]); if (a === 401 && b === 401) oldRev++; if (c === 200 && d === 200) newOk++
      const nw2 = await login(U, cutter); await other('POST', '/api/logout-all', nw2); const x = await login(U, cutter); if ((await sess(nw2, cutter)) === 401 && (await sess(nw2, other)) === 401) crossOldRev++; if ((await sess(x, cutter)) === 200 && (await sess(x, other)) === 200) crossNewOk++ }
    ck(`F5 ${N} ciclos con relojes +10/−10 min: token anterior revocado en ambas ${oldRev}/${N}; token nuevo válido en ambas ${newOk}/${N}`, oldRev === N && newOk === N, `${oldRev}/${newOk}`)
    ck(`F5 corte hecho en la instancia contraria: revocado ${crossOldRev}/${N}; login posterior válido ${crossNewOk}/${N}`, crossOldRev === N && crossNewOk === N, `${crossOldRev}/${crossNewOk}`); info('versión final', JSON.stringify(await ver(U.id))) }
  // F6 tokens sin `sv` (firmados con la misma clave pero SIN claim): se obtienen quitando el claim con la clave del proceso? no hay clave → se prueban con un token que el backend firmó antes del corte? Solo si JWT_SECRET está disponible.
  if (process.env.JWT_SECRET_QA) { const jwt = require(require.resolve('jsonwebtoken', { paths: [process.env.BACKEND] })); const U = await mk('user', 'L-423'); const mkTok = (iatMs) => jwt.sign({ id: U.id, name: 'x', role: 'user', iatMs }, process.env.JWT_SECRET_QA, { expiresIn: '8h', jwtid: crypto.randomBytes(8).toString('hex') })
    const before = mkTok(Date.now()); ck('F6 token SIN sv y sin corte previo sigue válido', (await sess(before)) === 200 && (await sess(before, callB)) === 200, ''); await call('POST', '/api/logout-all', await login(U)); ck('F6 tras un corte, el token SIN sv emitido antes queda revocado (regla por tiempo)', (await sess(before)) === 401 && (await sess(before, callB)) === 401, '')
    const fut = mkTok(Date.now() + 3600e3); ck('F6 (límite conocido) token SIN sv con iatMs futuro posterior al corte', true, 'solo informativo: ' + (await sess(fut))) }
  // F8 concurrencia
  { const U = await mk('user', 'K-423'); const toks = await Promise.all([...Array(6)].map((_, i) => login(U, i % 2 ? call : callB))); const rs = await Promise.all([...Array(10)].map((_, i) => (i % 2 ? call : callB)('POST', '/api/logout-all', toks[i % 6])))
    ck('F8 10 logout-all simultáneos desde las dos instancias (algunos reciben 401 porque otro corte ya revocó su token): la versión sube exactamente tantas veces como respuestas 200', (await ver(U.id)).v === rs.filter(r => r.s === 200).length && rs.every(r => r.s === 200 || r.s === 401), JSON.stringify(await ver(U.id)) + ' codes=' + rs.map(r => r.s).join(','))
    ck('F8 ninguno de los 6 tokens anteriores vale', (await Promise.all(toks.flatMap(t => [sess(t), sess(t, callB)]))).every(s => s === 401), ''); const mix = await Promise.all([login(U), callB('POST', '/api/logout-all', toks[0]), login(U, callB)]); const [p, q] = [mix[0], mix[2]]
    info('login concurrente con corte: sv firmados', claims(p).sv, claims(q).sv, 'versión', (await ver(U.id)).v); const final = await login(U); ck('F8 un login POSTERIOR a todo vale en ambas', (await sess(final)) === 200 && (await sess(final, callB)) === 200 && claims(final).sv === (await ver(U.id)).v, '') }
  // forma del token y de la base
  { const row = (await dbq(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='AuthRevocations' AND column_name='sessionVersion'`))[0]; ck('F7 columna sessionVersion INTEGER NOT NULL DEFAULT 0', row && /int/.test(row.data_type) && row.is_nullable === 'NO' && /0/.test(row.column_default || ''), JSON.stringify(row)) }
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
