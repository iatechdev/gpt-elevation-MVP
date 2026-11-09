// QA-Claude-2 — ES-218 (PR #162) K5/K6: el bloqueo consultivo del manifiesto es de transacción (no queda retenido) y la latencia con la serialización. Backend LOCAL del head + Postgres desechable.
// Env: BACKEND, DATABASE_URL, API. 0 IA.
const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = process.env.API; let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }; const info = (...a) => console.log('INFO', ...a); const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j, ms: Date.now() - t0 } }
const p95 = a => { const s = [...a].sort((x, y) => x - y); return s[Math.max(0, Math.ceil(s.length * 0.95) - 1)] }
const TXT = n => `Versión QA2 ${n}. ` + 'Texto de más de cincuenta caracteres para poder publicar la versión. '
;(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); const tag = Date.now().toString(36), pw = 'Sint3tica-QA-pass1!'; const T = {}
  for (const role of ['admin', 'superadmin', 'user']) { const email = `qa2-m218-${role}-${tag}@example.test`; await call('POST', '/api/register', null, { name: 'QA2 ' + role, email, password: pw }); await db.query('UPDATE "Users" SET role=$1 WHERE email=$2', [role, email]); await sleep(300); T[role] = (await call('POST', '/api/login', null, { email, password: pw })).j?.token; await sleep(800) }
  const adv = async () => +(await db.query(`SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())`)).rows[0].n
  const up = i => call('POST', i % 2 ? '/api/manifest/manifest' : '/api/board/manifest', T.admin, { content: TXT(i) }); const act = (id, i) => call('PUT', i % 2 ? `/api/manifest/manifest/${id}/activate` : `/api/board/manifest/${id}/activate`, T.superadmin)
  await db.query('DELETE FROM "EthicManifests"'); const ids = []; for (let i = 1; i <= 3; i++) ids.push((await up(i)).j?.id)
  ck('Preparación: 3 versiones publicadas', ids.every(Boolean), ids.join())
  // K5 sin bloqueos retenidos tras una ráfaga de operaciones, incluidas las que fallan a mitad
  const mix = []; for (let i = 0; i < 40; i++) { mix.push(act(ids[i % 3], i)); mix.push(up(100 + i)) } for (const bad of ['999999', 'abc', '0', '-1']) mix.push(call('PUT', `/api/manifest/manifest/${bad}/activate`, T.superadmin)); mix.push(call('POST', '/api/manifest/manifest', T.admin, { content: '   ' })); mix.push(call('POST', '/api/manifest/manifest', T.user, { content: TXT(1) }))
  const res = await Promise.all(mix); const s5 = res.filter(r => r.s >= 500).map(r => r.s); info('K5 estados de la ráfaga mixta (80 válidas + 6 con error):', [...new Set(res.map(r => r.s))].join(','), '5xx:', s5.length)
  await sleep(500); ck('K5 tras la ráfaga NO queda ningún bloqueo consultivo retenido (pg_locks)', (await adv()) === 0, 'advisory=' + await adv())
  const sinOtros = res.filter(r => r.s >= 500).length; ck('K5 los únicos 5xx son los ids malformados ya conocidos (E211-1: abc, no entero grande)', sinOtros <= 1, 'cantidad=' + sinOtros)
  const t0 = Date.now(); const next = await call('PUT', `/api/manifest/manifest/${ids[0]}/activate`, T.superadmin); ck('K5 la petición siguiente no se bloquea (responde en < 1 s)', next.s === 200 && Date.now() - t0 < 1000, `HTTP ${next.s} ${Date.now() - t0} ms`)
  const st = (await db.query('SELECT count(*) FILTER (WHERE "isActive")::int act, count(*)::int n, count(DISTINCT version)::int dv FROM "EthicManifests"')).rows[0]; ck('K2 tras la ráfaga: exactamente 1 activa y números de versión únicos', st.act === 1 && st.n === st.dv, JSON.stringify(st))
  // K6 latencia
  const ser = { act: [], up: [] }; for (let i = 0; i < 30; i++) { ser.act.push((await act(ids[i % 3], i)).ms); ser.up.push((await up(200 + i)).ms) } info('K6 en serie (ms) activar:', ser.act.join(','), '| subir:', ser.up.join(','))
  ck('K6 p95 en serie < 300 ms (umbral propuesto): activar y subir', p95(ser.act) < 300 && p95(ser.up) < 300, `activar p95=${p95(ser.act)} subir p95=${p95(ser.up)}`)
  const t1 = Date.now(); const par = await Promise.all(Array.from({ length: 10 }, (_, i) => i % 2 ? up(300 + i) : act(ids[i % 3], i))); const dt = Date.now() - t1; ck('K6 10 operaciones simultáneas terminan en < 3 s sin 5xx', dt < 3000 && par.every(r => r.s < 500), `${dt} ms estados=${[...new Set(par.map(r => r.s))]}`)
  const mx = Math.max(...par.map(r => r.ms)); info('K6 la más lenta de las 10 simultáneas:', mx, 'ms')
  ck('K5 al terminar tampoco hay bloqueos consultivos retenidos', (await adv()) === 0)
  await db.end(); console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 500)); process.exit(3) })
