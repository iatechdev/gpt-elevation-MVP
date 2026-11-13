// QA-Claude-2 — ES-119 (#93): contrato de «Registrar mi nivel» contra backend REAL (POST /api/skill-map/self).
// Cubre S-1 (aislamiento A/B), S-3 (entradas inválidas), S-5 (concurrencia/idempotencia), F119-1/2/5/6/7 a nivel de servidor.
// Env: API (por defecto :8090). Datos sintéticos, base local.
const API = process.env.API || 'http://localhost:8090', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const person = async (tag) => { const email = `qa-${tag}-${Date.now()}${Math.floor(Math.random() * 1e3)}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j.token }
let n = 0; const rid = (p = 'r') => `${p}-${Date.now()}-${++n}`
const mkEv = (title, autonomy, status = 'confirmed') => ({ requestId: rid('ev'), status, payload: { title, situation: 'Situación sintética.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción sintética.' }], delivered: { text: 'Entregable sintético.' }, observedEffect: { known: false }, ...(autonomy ? { autonomy } : {}) } })
const self = (t, body) => call('POST', '/api/skill-map/self', t, body)
const track = async (t, key = 'trabajo_en_equipo') => (await call('GET', '/api/skill-map', t)).j.skills.find(s => s.skillKey === key)
;(async () => {
  const A = await person('A'), B = await person('B'), C = await person('C')
  const a1 = (await call('POST', '/api/evidence', A, mkEv('Evidencia A1', 'autonomous'))).j, a2 = (await call('POST', '/api/evidence', A, mkEv('Evidencia A2', 'assisted'))).j
  const aDraft = (await call('POST', '/api/evidence', A, mkEv('Borrador A3', null, 'draft'))).j, b1 = (await call('POST', '/api/evidence', B, mkEv('Evidencia B1', 'autonomous'))).j
  ck('evidencias sintéticas creadas', [a1, a2, aDraft, b1].every(e => e && e.id), JSON.stringify([a1?.id, a2?.id, aDraft?.id, b1?.id]))
  const ref = (e, v = 1) => ({ evidenceId: e.id, version: v })
  const base = (over) => ({ requestId: rid(), skillKey: 'trabajo_en_equipo', level: 2, evidenceRefs: [ref(a1)], rationale: 'Nota sintética', ...over })
  // F119-1 nunca nivel sin evidencia
  for (const [nm, body] of [['sin evidenceRefs', base({ evidenceRefs: undefined })], ['evidenceRefs vacío', base({ evidenceRefs: [] })], ['evidencia en borrador', base({ evidenceRefs: [ref(aDraft)] })], ['evidencia de OTRA persona (IDOR)', base({ evidenceRefs: [ref(b1)] })], ['evidencia inexistente', base({ evidenceRefs: [{ evidenceId: 999999, version: 1 }] })], ['versión que no existe', base({ evidenceRefs: [ref(a1, 7)] })], ['9 referencias', base({ evidenceRefs: Array.from({ length: 9 }, () => ref(a1)) })], ['referencias repetidas', base({ evidenceRefs: [ref(a1), ref(a1)] })]]) {
    const r = await self(A, body); ck(`F119-1/S-1 ${nm}: rechazado (4xx) y sin nivel`, r.s >= 400 && r.s < 500, `HTTP ${r.s} ${r.j?.code || ''}`) }
  ck('F119-1 tras los intentos inválidos la capacidad sigue sin nivel', (await track(A)).self === null || (await track(A)).self.level === null)
  const cT = await self(C, base({ evidenceRefs: [ref(a1)] })); ck('S-1 persona C (sin evidencias) con evidencia de A: rechazado', cT.s >= 400 && cT.s < 500, `HTTP ${cT.s}`)
  // S-3 entradas
  for (const [nm, over] of [['nivel 0', { level: 0 }], ['nivel 5', { level: 5 }], ['nivel "3" texto', { level: '3' }], ['nivel 2.5', { level: 2.5 }], ['skillKey desconocida', { skillKey: 'no_existe' }], ['skillKey con inyección', { skillKey: "x'; DROP TABLE \"Users\";--" }], ['nota de 501 caracteres', { rationale: 'x'.repeat(501) }], ['campo extra userId', { userId: 1 }], ['requestId inválido', { requestId: '!' }], ['rationale con HTML', { rationale: '<img src=x onerror=alert(1)>' }]]) {
    const r = await self(A, base(over)); const bad = r.s >= 400 && r.s < 500
    if (nm === 'rationale con HTML') ck(`S-3 ${nm}: aceptado como texto o rechazado, nunca 5xx`, r.s < 500, `HTTP ${r.s}`); else ck(`S-3 ${nm}: 4xx sin 5xx`, bad, `HTTP ${r.s} ${r.j?.code || ''}`) }
  const big = await fetch(API + '/api/skill-map/self', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + A }, body: JSON.stringify(base({ rationale: 'y'.repeat(2_000_000) })) }); ck('S-3 cuerpo de 2 MB: 4xx (no 5xx)', big.status >= 400 && big.status < 500, `HTTP ${big.status}`)
  ck('S-3 sin token / token manipulado: bloqueado', [401, 403].includes((await self(null, base({}))).s) && (await self(A.slice(0, -3) + 'abc', base({}))).s === 401)
  // F119-2 registrar / cambiar / retirar
  const r1 = await self(A, base({ level: 2 })); ck('F119-2 registrar nivel 2', [200, 201].includes(r1.s), `HTTP ${r1.s}`)
  let t = await track(A); ck('F119-2 mapa: nivel 2, 1 evidencia, estado con evidencia', t.self.level === 2 && t.self.evidenceCount === 1 && t.state !== 'no_evidence', JSON.stringify({ l: t.self.level, c: t.self.evidenceCount, s: t.self.state, st: t.state }))
  ck('F119-2 B no ve el nivel de A', (await track(B)).self === null)
  const r2 = await self(A, base({ level: 3, evidenceRefs: [ref(a1), ref(a2)] })); ck('F119-2 cambiar a nivel 3 con 2 evidencias', [200, 201].includes(r2.s)); t = await track(A); ck('F119-2 mapa: nivel 3 y 2 evidencias', t.self.level === 3 && t.self.evidenceCount === 2, JSON.stringify({ l: t.self.level, c: t.self.evidenceCount }))
  // F119-3 / S-5 idempotencia y concurrencia
  const fixed = rid('same'); const [d1, d2, d3] = await Promise.all([1, 2, 3].map(() => self(A, base({ requestId: fixed, level: 3, evidenceRefs: [ref(a1), ref(a2)] }))))
  ck('S-5 3 envíos simultáneos con el MISMO requestId: sin 5xx', [d1, d2, d3].every(r => r.s < 500), [d1, d2, d3].map(r => r.s).join(','))
  const again = await self(A, base({ requestId: fixed, level: 3, evidenceRefs: [ref(a1), ref(a2)] })); ck('F119-3 reintento con el mismo requestId: 200 sin duplicar', again.s === 200 || again.s === 201, `HTTP ${again.s}`)
  const race = await Promise.all([4, 1, 2, 3].map(l => self(A, base({ level: l, evidenceRefs: [ref(a1)] })))); ck('S-5 4 niveles distintos simultáneos: sin 5xx', race.every(r => r.s < 500), race.map(r => r.s).join(','))
  t = await track(A); ck('S-5 tras la carrera hay UN nivel coherente (1–4)', [1, 2, 3, 4].includes(t.self.level), `nivel final ${t.self.level}`)
  // F119-6 contradicción con la autonomía declarada
  const r6 = await self(A, base({ level: 1, evidenceRefs: [ref(a1)] })); ck('F119-6 nivel 1 con evidencia «autónoma» se guarda', [200, 201].includes(r6.s)); t = await track(A)
  console.log('   contradicción →', JSON.stringify({ state: t.self.state, needsReview: t.self.needsReview, razón: t.self.confidenceReason?.es }))
  ck('F119-6 el servidor la marca para revisión (regla, no persona ni IA)', t.self.needsReview === true || t.self.state === 'contradictory')
  // F119-5/7 retirar y evidencia que cambia
  const rr = await self(A, { requestId: rid(), skillKey: 'trabajo_en_equipo', level: null }); ck('F119-2 retirar con level null', [200, 201].includes(rr.s), `HTTP ${rr.s}`); t = await track(A)
  ck('F119-2 tras retirar: sin nivel', t.self === null || t.self.level === null)
  ck('F119-2 retirar NO borra la evidencia', (await call('GET', '/api/evidence', A)).j.evidence.filter(e => e.status === 'confirmed').length >= 2)
  await self(A, base({ level: 3, evidenceRefs: [ref(a1)], requestId: rid() })); t = await track(A); const lv = t.self.level
  const up = await call('PUT', `/api/evidence/${a1.id}`, A, { ...mkEv('Evidencia A1 editada', 'autonomous'), baseVersion: 1 }); ck('F119-7 editar la evidencia citada', [200, 201].includes(up.s), `HTTP ${up.s}`)
  t = await track(A); ck('F119-7 tras editar la evidencia el nivel deja de mostrarse (null/stale), sin nivel huérfano', t.self.level === null || t.self.stale === true, JSON.stringify({ antes: lv, ahora: t.self.level, stale: t.self.stale }))
  const del = await call('DELETE', `/api/evidence/${a2.id}`, A); await self(A, base({ level: 2, evidenceRefs: [ref(a2)], requestId: rid(), skillKey: 'comunicacion' })).then(r => ck('F119-7 citar una evidencia borrada: rechazado', r.s >= 400 && r.s < 500, `HTTP ${r.s}`))
  ck('S-6 respuesta del mapa sin diario/crisis/ánimo', !/diary|crisis|mood/i.test(JSON.stringify((await call('GET', '/api/skill-map', A)).j)))
  console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e); process.exit(3) })
