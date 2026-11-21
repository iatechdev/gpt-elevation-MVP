// [QA-Claude-3] PR #422 (ES-367): GET /api/me/review-shares incluye reviewerName solo para el dueño. Backend REAL + PG desechable; filas sembradas por SQL; sin IA.
const L = require('./lib3.cjs'); const { ck, mk, call, dbq } = L
;(async () => { await L.DB.connect()
  const A = await mk('user', 'Persona A 422'), B = await mk('user', 'Persona B 422'), R1 = await mk('therapist', 'Revisora Uno <b>x</b>'), R2 = await mk('therapist', 'Revisor Dos'), R3 = await mk('therapist', 'Revisor Tres'), R4 = await mk('therapist', 'Borrado Cuatro')
  const share = (u, r, status = 'granted') => dbq(`INSERT INTO "ReviewShares"("UserId","reviewerId","materialVersion","evidenceRefs",status,"requestId","createdAt","updatedAt") VALUES ($1,$2,1,'[]',$3,$4,now(),now()) RETURNING id`, [u, r, status, 'qa3-422-' + u + '-' + r + '-' + Math.random().toString(36).slice(2, 7)]).then(x => x[0].id)
  const a1 = await share(A.id, R1.id), a2 = await share(A.id, R2.id, 'revoked'), a3 = await share(A.id, R4.id), b1 = await share(B.id, R3.id)
  await dbq(`UPDATE "Users" SET name='   ' WHERE id=$1`, [R2.id]) // nombre vacío → null
  await dbq(`DELETE FROM "Users" WHERE id=$1`, [R4.id]) // revisor inexistente → null
  const ra = await call('GET', '/api/me/review-shares', A.token); const sh = ra.j?.shares || []
  ck('E422 dueño A: 200 con sus 3 autorizaciones y ninguna de B', ra.s === 200 && sh.length === 3 && sh.every(s => [a1, a2, a3].includes(s.id)) && !sh.some(s => s.id === b1), JSON.stringify(sh.map(s => s.id)))
  const s1 = sh.find(s => s.id === a1), s2 = sh.find(s => s.id === a2), s3 = sh.find(s => s.id === a3)
  ck('E422 reviewerName = el nombre del revisor (texto tal cual, el HTML no se interpreta en el JSON)', s1?.reviewerName === 'Revisora Uno <b>x</b>', s1?.reviewerName)
  ck('E422 nombre vacío → null; revisor eliminado → null', s2?.reviewerName === null && s3?.reviewerName === null, `${s2?.reviewerName} | ${s3?.reviewerName}`)
  const extra = new Set(sh.flatMap(s => Object.keys(s))); const allowed = ['id', 'reviewerId', 'materialVersion', 'evidenceCount', 'status', 'createdAt', 'reviewerName']
  ck('E422 claves de cada autorización: solo las ya existentes + reviewerName (sin correo, rol, especialidad, estado de cuenta)', [...extra].every(k => allowed.includes(k) || ['revokedAt', 'changed', 'sourceRevoked', 'updatedAt', 'requestId', 'stale', 'materialChanged'].includes(k)) && !/@|email|specialt|role|active/i.test(JSON.stringify(sh)), [...extra].join(','))
  const rb = await call('GET', '/api/me/review-shares', B.token); ck('E422 B solo ve lo suyo y NO ve el nombre de revisores de A', rb.s === 200 && rb.j.shares.length === 1 && rb.j.shares[0].id === b1 && rb.j.shares[0].reviewerName === 'Revisor Tres' && !JSON.stringify(rb.j).includes('Revisora Uno'), JSON.stringify(rb.j).slice(0, 120))
  const r0 = await call('GET', '/api/me/review-shares'); ck('E422 sin sesión → 401', r0.s === 401, String(r0.s))
  const rr = await call('GET', '/api/me/review-shares', R1.token); ck('E422 la persona revisora consultando ese endpoint NO ve las autorizaciones de otras personas (solo las suyas como dueña: 0)', (rr.s === 200 && rr.j.shares.length === 0) || rr.s === 403, `${rr.s} ${JSON.stringify(rr.j || {}).slice(0, 80)}`)
  const nopeek = await call('GET', `/api/me/review-shares?userId=${A.id}`, B.token); ck('E422 un parámetro userId ajeno no cambia el titular (B sigue viendo solo lo suyo)', nopeek.s === 200 && nopeek.j.shares.every(s => s.id === b1), JSON.stringify((nopeek.j.shares || []).map(s => s.id)))
  await L.done(); process.exit(0) })()
