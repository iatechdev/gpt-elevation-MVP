// [QA-Claude-3] sonda #419: corte de sesiones (logout-all) y login inmediato; el token anterior sigue revocado, el nuevo vale; sin intermitencias. Solo qa/.
const L = require('./lib3.cjs'); const { mk, call, sleep } = L
;(async () => { await L.DB.connect(); const U = await mk('user', 'S-419'); const N = 60; let newOk = 0, oldRevoked = 0, other = 0, otherOk = 0
  const V = await mk('user', 'V-419')
  for (let i = 0; i < N; i++) {
    const old = (await call('POST', '/api/login', null, { email: U.email, password: L.PASS })).j.token
    const cut = await call('POST', '/api/logout-all', old); const nw = (await call('POST', '/api/login', null, { email: U.email, password: L.PASS })).j?.token
    const [a, b] = await Promise.all([call('GET', '/api/session', nw), call('GET', '/api/session', old)])
    if (cut.s === 200 && a.s === 200) newOk++; if (b.s === 401) oldRevoked++
    const ov = (await call('POST', '/api/login', null, { email: V.email, password: L.PASS })).j.token; if ((await call('GET', '/api/session', ov)).s === 200) otherOk++ }
  console.log(`PROBE419 ${N} ciclos: login inmediato tras el corte válido ${newOk}/${N}; token anterior revocado ${oldRevoked}/${N}; otra persona sin afectar ${otherOk}/${N}`); await L.DB.end(); process.exit(0) })()
