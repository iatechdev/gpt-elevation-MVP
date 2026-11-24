// QA-Claude-2 — ES-211 (PR #151): invariante «exactamente 1 versión activa y números de versión únicos» bajo concurrencia, contra backend LOCAL + Postgres desechable.
// Env: BACKEND, DATABASE_URL, API.
const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = process.env.API; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
const TXT = n => `Versión QA2 ${n}. ` + 'Texto de más de cincuenta caracteres para poder publicar la versión. '
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const tag = Date.now().toString(36), pw = 'Sint3tica-QA-pass1!'; const T = {}
  for (const role of ['admin', 'superadmin']) { const email = `qa2-m211-${role}-${tag}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ' + role, email, password: pw }); await db.query('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); await sleep(300); T[role] = (await call('POST', '/api/login', null, { email, password: pw })).j?.token; await sleep(800) }
  const state = async () => { const r = (await db.query('SELECT id, version, "isActive" FROM "EthicManifests" ORDER BY id')).rows; const act = r.filter(x => x.isActive).length; const vs = r.map(x => x.version); return { n: r.length, act, dup: vs.length - new Set(vs).size, vs } }
  const reset = () => db.query('DELETE FROM "EthicManifests"')
  const inv = async (nm, extra = '') => { const s = await state(); ck(`${nm}: exactamente 1 activa, sin números de versión repetidos`, s.act === 1 && s.dup === 0, `versiones=${s.n} activas=${s.act} repetidas=${s.dup} ${extra}`); return s }
  const m = (i, who = 'admin') => call('POST', i % 2 ? '/api/manifest/manifest' : '/api/board/manifest', T[who], { content: TXT(i) })
  const act = (id, i = 0, who = 'admin') => call('PUT', i % 2 ? `/api/manifest/manifest/${id}/activate` : `/api/board/manifest/${id}/activate`, T[who])
  // F1 repro del hallazgo
  await reset(); const v1 = await m(1); const id1 = v1.j?.id; ck('Preparación: versión 1 publicada (201)', v1.s === 201, 'HTTP ' + v1.s)
  const r1 = await act(id1, 1); const pub = await call('GET', '/api/manifest/active'); ck('F1 reactivar la versión YA activa → 200 y el texto público sigue ahí', r1.s === 200 && typeof pub.j?.content === 'string', `PUT ${r1.s} content=${typeof pub.j?.content}`); await inv('F1')
  const r1b = await act(id1, 2); await inv('F1 (segunda vez, por /api/board)', 'PUT ' + r1b.s)
  // F2 ida y vuelta
  const v2 = await m(2); const id2 = v2.j?.id; await act(id1, 1); let s = await state(); const a1 = (await db.query('SELECT id FROM "EthicManifests" WHERE "isActive"')).rows[0]?.id; ck('F2 activar la v1 deja activa solo la v1', s.act === 1 && a1 === id1, `activa id=${a1}`); await act(id2, 2); const a2 = (await db.query('SELECT id FROM "EthicManifests" WHERE "isActive"')).rows[0]?.id; ck('F2 activar la v2 deja activa solo la v2', a2 === id2, `activa id=${a2}`)
  // C1 concurrencia
  for (let rep = 0; rep < 10; rep++) { await reset(); const a = (await m(1)).j?.id, b = (await m(2)).j?.id; const res = await Promise.all([...Array(10).fill(0).map((_, i) => act(a, i)), ...Array(10).fill(0).map((_, i) => act(b, i + 1))]); const bad5 = res.filter(r => r.s >= 500).length; const st = await state()
    if (!(st.act === 1 && st.dup === 0 && bad5 === 0)) { ck(`C1 (repetición ${rep + 1}) 20 PUT cruzados simultáneos`, false, `activas=${st.act} repetidas=${st.dup} 5xx=${bad5} estados=${[...new Set(res.map(r => r.s))]}`) } }
  ck('C1 10 repeticiones × 20 PUT simultáneos (10 por versión, cruzados): siempre 1 activa y sin 5xx', true, '(sin incidentes si no aparece FALLA arriba)')
  for (let rep = 0; rep < 10; rep++) { await reset(); const a = (await m(1)).j?.id; const res = await Promise.all(Array(10).fill(0).map((_, i) => act(a, i))); const st = await state(); if (!(st.act === 1 && res.every(r => r.s === 200))) ck(`C1 (misma versión, rep ${rep + 1})`, false, `activas=${st.act} estados=${[...new Set(res.map(r => r.s))]}`) }
  ck('C1 10 repeticiones × 10 PUT simultáneos sobre la MISMA versión activa: siempre 200 y 1 activa', true)
  for (let rep = 0; rep < 10; rep++) { await reset(); const a = (await m(1)).j?.id; const res = await Promise.all([act(a, 1), m(2), act(a, 2), m(3), act(a, 3), m(4)]); const st = await state(); const bad5 = res.filter(r => r.s >= 500).length; if (!(st.act === 1 && st.dup === 0 && bad5 === 0)) ck(`C1 subir + activar a la vez (rep ${rep + 1})`, false, `activas=${st.act} repetidas=${st.dup} versiones=${st.vs} 5xx=${bad5}`) }
  ck('C1 10 repeticiones de subir 3 versiones y activar a la vez: siempre 1 activa, sin repetidos ni 5xx', true)
  // C2 subidas simultáneas, con tabla con filas y VACÍA
  for (const [label, seed] of [['con una versión previa', true], ['desde la tabla vacía', false]]) { await reset(); if (seed) await m(1); const t0 = Date.now(); const res = await Promise.all(Array(20).fill(0).map((_, i) => m(i + 10, i % 3 ? 'admin' : 'superadmin'))); const ms = Date.now() - t0; const st = await state(); const nums = st.vs.map(v => +v.replace('v', '')).sort((x, y) => x - y)
    const consecutivas = nums.every((n, i) => n === i + 1); ck(`C2 20 subidas simultáneas ${label}: números únicos y consecutivos, 1 activa, sin 5xx`, st.dup === 0 && consecutivas && st.act === 1 && res.every(r => r.s < 500), `versiones=${st.n} números=${nums.join(',')} activas=${st.act} repetidas=${st.dup} estados=${[...new Set(res.map(r => r.s))]} ${ms} ms`) }
  // F4 entradas inválidas
  await reset(); await m(1); for (const id of ['999999', 'abc', '-1', '0', '99999999999999999999', '1;DROP TABLE x', '%00']) { const r = await call('PUT', `/api/manifest/manifest/${encodeURIComponent(id)}/activate`, T.admin); const st = await state(); ck(`F4 activar id «${id}» → 4xx/404, nunca 5xx, y sigue 1 activa`, r.s >= 400 && r.s < 500 && st.act === 1, `HTTP ${r.s} activas=${st.act}`) }
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 400)); process.exit(3) })
