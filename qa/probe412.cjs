// [QA-Claude-3] sonda #412: ¿la reserva se borra antes o después de responder el error? (solo qa/)
const L = require('./lib3.cjs'); const { mk, call, dbq, sleep } = L
;(async () => { await L.DB.connect(); const A = await mk('user', 'P-412'); const body = { answers: { area: 'anxiety', style: 'reflective', language: 'es' }, requestId: 'qa3-probe-0001' }
  const n = async () => (await dbq(`SELECT status FROM "MatchingRequests" WHERE "UserId"=$1 AND "requestId"='qa3-probe-0001'`, [A.id])).map(r => r.status).join(',') || '(ninguna)'
  const r1 = await call('POST', '/api/matching/request', A.token, body); const s0 = await n(); await sleep(300); const s1 = await n()
  console.log('respuesta', r1.s, '| fila justo tras responder:', s0, '| 300 ms después:', s1)
  let imm = []; for (let i = 0; i < 5; i++) { const r = await call('POST', '/api/matching/request', A.token, body); imm.push(r.s + (r.j?.code ? ':' + r.j.code : '')) } console.log('5 reintentos seguidos:', imm.join(' '))
  await sleep(300); console.log('al final:', await n()); await L.DB.end(); process.exit(0) })()
