// [QA-Claude-3] #353 P1: latencia de /api/admin/metrics con 5 000 valoraciones y 2 100 registros de ánimo sintéticos (300 personas, 10 profesionales). Via qa/run.sh.
const L = require('./lib3.cjs'); const { ck, info, call, dbq, mk } = L
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)] }
;(async () => {
  await L.DB.connect(); const AD = await mk('admin', 'AD-353P')
  const ts = []; for (let i = 0; i < 10; i++) ts.push(await mk('therapist', 'T' + i + '-353P'))
  const ids = []; for (let i = 0; i < 300; i++) { const r = await dbq(`INSERT INTO "Users"(name,email,password,role,active,"onboardingCompleted","therapistId","createdAt","updatedAt") VALUES ($1,$2,'x','user',true,true,$3,now(),now()) RETURNING id`, ['Persona sintética ' + i, `perf353-${Date.now()}-${i}@example.test`, ts[i % 10].id]); ids.push(r[0].id) }
  await dbq(`INSERT INTO "SessionRatings"("rating","date","UserId","createdAt","updatedAt") SELECT 1 + (g % 5), (now()::date - (g % 90)), (ARRAY[${ids.join(',')}])[1 + (g % 300)], now(), now() FROM generate_series(1, 5000) g`)
  await dbq(`INSERT INTO "MoodLogs"("checkin_mood","checkout_mood","date","UserId","createdAt","updatedAt") SELECT 1 + (g % 5), 1 + ((g + 2) % 5), (now()::date - (g / 300)::int), (ARRAY[${ids.join(',')}])[1 + (g % 300)], now(), now() FROM generate_series(0, 2099) g`)
  const n = await dbq('SELECT (SELECT count(*) FROM "SessionRatings")::int r, (SELECT count(*) FROM "MoodLogs")::int m'); info('datos sembrados:', JSON.stringify(n[0]))
  const one = async () => { const t = performance.now(); const r = await call('GET', '/api/admin/metrics', AD.token); return [performance.now() - t, r.s, r.j] }
  for (let i = 0; i < 5; i++) await one()
  const seq = []; let last; for (let i = 0; i < 60; i++) { const [ms, s, j] = await one(); if (s !== 200) throw new Error('estado ' + s); seq.push(ms); last = j }
  const burst = []; for (let k = 0; k < 6; k++) { const rs = await Promise.all(Array.from({ length: 10 }, one)); rs.forEach(([ms]) => burst.push(ms)) }
  console.log(`P353 ${L.LABEL} secuencial n=${seq.length} p50=${pct(seq, .5).toFixed(1)}ms p95=${pct(seq, .95).toFixed(1)}ms max=${Math.max(...seq).toFixed(1)}ms | 10 concurrentes ×6 p50=${pct(burst, .5).toFixed(1)}ms p95=${pct(burst, .95).toFixed(1)}ms max=${Math.max(...burst).toFixed(1)}ms | avgRating=${last.avgRating} avgMood=${last.avgMood} top=${JSON.stringify(last.topTherapists.slice(0, 2).map(t => t.avgRating))}`)
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
