// QA-Claude-2 — rendimiento acotado (P-2/P-3): solo loopback, base local, 6 personas sintéticas. Sin LLM. Duración ≤ ~60 s.
const API = process.env.API || 'http://localhost:8090', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
const j = async (m, p, t, b) => { const s = performance.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); await r.text(); return { s: r.status, ms: performance.now() - s } }
const json = async (m, p, t, b) => (await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined })).json()
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
const stat = (n, r) => { const ms = r.map(x => x.ms), bad = r.filter(x => x.s >= 500).length; const non2 = r.filter(x => x.s >= 300).length; console.log(`${n.padEnd(34)} n=${String(r.length).padStart(3)} p50=${pct(ms, .5).toFixed(0)}ms p95=${pct(ms, .95).toFixed(0)}ms max=${Math.max(...ms).toFixed(0)}ms 5xx=${bad} no-2xx=${non2}`); return { p95: pct(ms, .95), bad: bad + non2 } }
;(async () => {
  const people = []; for (let i = 0; i < 6; i++) { const e = `qa-perf-${Date.now()}-${i}@example.test`; await json('POST', '/api/register', null, { name: 'p' + i, email: e, password: PASS }); const t = (await json('POST', '/api/login', null, { email: e, password: PASS })).token; const ev = await json('POST', '/api/evidence', t, { requestId: `pf-${Date.now()}-${i}`, status: 'confirmed', payload: { title: 'Ev', situation: 's', responsibility: { text: 'r' }, actions: [{ text: 'a' }], delivered: { text: 'd' }, observedEffect: { known: false }, autonomy: 'assisted' } }); people.push({ t, ev }) }
  const keys = ['comunicacion', 'trabajo_en_equipo', 'resolucion_problemas', 'planificacion_organizacion']
  const reads = [], writes = [], cons = [], t0 = performance.now()
  await Promise.all(people.map(async (p, i) => {
    for (let k = 0; k < 20; k++) { reads.push(await j('GET', '/api/skill-map', p.t)); if (k % 4 === 0) cons.push(await j('GET', '/api/consents', p.t)); if (k < keys.length * 1) writes.push(await j('POST', '/api/skill-map/self', p.t, { requestId: `pw-${Date.now()}-${i}-${k}`, skillKey: keys[k % keys.length], level: 1 + (k % 4), evidenceRefs: [{ evidenceId: p.ev.id, version: 1 }], rationale: 'n' })) }
  }))
  const secs = ((performance.now() - t0) / 1000).toFixed(1); console.log(`6 personas concurrentes, ${secs}s`)
  const a = stat('GET /api/skill-map (6 en paralelo)', reads), b = stat('POST /api/skill-map/self', writes), c = stat('GET /api/consents', cons)
  const seq = []; for (let k = 0; k < 50; k++) seq.push(await j('GET', '/api/skill-map', people[0].t)); const d = stat('GET /api/skill-map (secuencial, 50)', seq)
  const ok = a.bad + b.bad + c.bad + d.bad === 0 && d.p95 <= 300 && a.p95 <= 600 && b.p95 <= 600; console.log(ok ? 'DENTRO de los umbrales propuestos (p95 ≤300 ms secuencial; ≤600 ms con 6 en paralelo; 0 errores 5xx)' : 'FUERA de los umbrales propuestos'); process.exit(ok ? 0 : 1)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
