// [QA-Claude-3] sonda #412 (2): con 30 fallos de IA seguidos, ¿cuántas veces la reserva sigue visible justo al recibir el error y cuántas el reintento inmediato recibe 409? (solo qa/)
const L = require('./lib3.cjs'); const { mk, call, dbq, sleep } = L
;(async () => { await L.DB.connect(); const A = await mk('user', 'P2-412'); let visible = 0, retry409 = 0; const N = 30
  for (let i = 0; i < N; i++) { const body = { answers: { area: 'anxiety', style: 'reflective', language: 'es' }, requestId: 'qa3-probe-b-' + String(i).padStart(4, '0') }
    const r = await call('POST', '/api/matching/request', A.token, body); const [row] = await dbq(`SELECT 1 FROM "MatchingRequests" WHERE "UserId"=$1 AND "requestId"=$2`, [A.id, body.requestId]); if (row) visible++
    const r2 = await call('POST', '/api/matching/request', A.token, body); if (r2.s === 409) retry409++ }
  console.log(`PROBE412B ${N} fallos: fila visible tras el error ${visible}/${N}; reintento inmediato con 409 ${retry409}/${N}`); await L.DB.end(); process.exit(0) })()
