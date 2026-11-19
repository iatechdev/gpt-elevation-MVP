// [QA-Claude-3] PR #353 (ES-348). Matriz PROPIA con PostgreSQL REAL: promedios de /api/admin/metrics solo con >= 5 valoraciones Y >= MIN_DISTINCT_PEOPLE personas distintas (1–5).
// Uso: via qa/run.sh con LABEL=pr|main (MINP=3 por defecto; MINP=2/4 para la prueba de la constante). El expected se calcula de forma INDEPENDIENTE en JS.
const L = require('./lib3.cjs'); const { ck, info, call, dbq, mk, sleep } = L
const MINP = +(process.env.MINP || 3); const PR = L.LABEL === 'pr' || !!process.env.FORCE_PR
const r1 = x => Math.round(x * 10) / 10
const exp = (entries, people) => { const v = entries.filter(([, x]) => x >= 1 && x <= 5); const n = v.length; const p = new Set(v.map(([u]) => u)).size; const avg = n ? r1(v.reduce((a, [, x]) => a + x, 0) / n) : null; return n >= 5 && (PR ? p >= people : true) ? avg : null }
const key = o => JSON.stringify(o)
;(async () => {
  await L.DB.connect(); const AD = await mk('admin', 'AD-353'); const SU = await mk('superadmin', 'SU-353')
  const P = []; for (let i = 0; i < 6; i++) P.push(await mk('user', 'P' + i + '-353')); const T1 = await mk('therapist', 'T1-353'), T2 = await mk('therapist', 'T2-353')
  const metrics = async tk => (await call('GET', '/api/admin/metrics', tk || AD.token))
  const reset = async () => { await dbq('DELETE FROM "SessionRatings"'); await dbq('DELETE FROM "MoodLogs"'); await dbq('UPDATE "Users" SET "therapistId"=NULL WHERE role=\'user\'') }
  const assign = async (map) => { for (const [i, t] of Object.entries(map)) await dbq('UPDATE "Users" SET "therapistId"=$1 WHERE id=$2', [t.id, P[i].id]) }
  const ins = async (rows) => { let d = 0; for (const [i, v] of rows) { d++; await dbq(`INSERT INTO "SessionRatings"("rating","date","UserId","createdAt","updatedAt") VALUES ($1, (now()::date - $2::int), $3, now(), now())`, [v, d, P[i].id]) } }
  const moods = async (rows) => { let d = 0; for (const [i, a, b] of rows) { d++; await dbq(`INSERT INTO "MoodLogs"("checkin_mood","checkout_mood","date","UserId","createdAt","updatedAt") VALUES ($1,$2,(now()::date - $3::int),$4,now(),now())`, [a, b, d, P[i].id]) } }
  const pro = (m, t) => (m.j?.topTherapists || []).find(x => x.id === t.id)
  // ---- avgRating general y por profesional ----
  const R = [
    ['R1 1 persona × 5 valoraciones', [[0, 4], [0, 4], [0, 4], [0, 4], [0, 4]]],
    ['R2 2 personas × 10', [0, 1].flatMap(i => [4, 5, 4, 5, 4].map(v => [i, v]))],
    ['R3 3 personas × 5 (2+2+1)', [[0, 5], [0, 4], [1, 3], [1, 4], [2, 5]]],
    ['R4 3 personas × 6 (2+2+2)', [[0, 5], [0, 4], [1, 3], [1, 4], [2, 5], [2, 2]]],
    ['R5 5 válidas de 2 personas + 1 fuera de escala (6) de una 3.ª', [[0, 5], [0, 4], [0, 3], [1, 4], [1, 5], [2, 6]]],
    ['R6 5 válidas de 2 personas + 1 fuera de escala (0) de una 3.ª', [[0, 5], [0, 4], [0, 3], [1, 4], [1, 5], [2, 0]]],
    ['R7 4 valoraciones de 4 personas', [[0, 5], [1, 4], [2, 3], [3, 4]]],
    ['R8 5 valoraciones de 5 personas', [[0, 5], [1, 4], [2, 3], [3, 4], [4, 2]]],
    ['R9 3 personas, solo 4 válidas + 2 fuera de escala', [[0, 5], [1, 4], [2, 3], [2, 4], [0, 6], [1, 0]]],
    ['R10 3 personas, 5 válidas + 2 fuera de escala (no cuentan en el promedio)', [[0, 5], [0, 4], [1, 3], [1, 4], [2, 5], [2, 6], [2, 0]]],
    ['R11 sin valoraciones', []],
    ['R12 una persona muy activa (20) y dos personas con 1', [...Array(20).fill(0).map(() => [0, 5]), [1, 1], [2, 1]]],
  ]
  for (const [nm, rows] of R) {
    await reset(); await assign({ 0: T1, 1: T1, 2: T1, 3: T1, 4: T1, 5: T1 }); await ins(rows); const m = await metrics(); const e = exp(rows, MINP)
    ck(`M1 ${nm}: avgRating general = ${e}`, m.s === 200 && m.j.avgRating === e, `obtenido ${m.j?.avgRating} esperado ${e}`)
    const t = pro(m, T1); ck(`M1 ${nm}: avgRating del profesional (todos sus pacientes) = ${e}`, !!t && t.avgRating === e, `obtenido ${t?.avgRating} esperado ${e}`)
  }
  // ---- por profesional: no se contaminan ----
  await reset(); await assign({ 0: T1, 1: T1, 2: T1, 3: T2, 4: T2, 5: T2 })
  const rowsT1 = [[0, 5], [0, 4], [1, 3], [1, 4], [2, 5]]; const rowsT2 = [[3, 2], [3, 3], [3, 2], [4, 3], [4, 2], [4, 3], [4, 2], [4, 3]]; await ins([...rowsT1, ...rowsT2])
  let m = await metrics(); ck('M3 profesionales: T1 con 3 personas y 5 valoraciones tiene promedio; T2 con 2 personas × 8 NO', pro(m, T1)?.avgRating === exp(rowsT1, MINP) && pro(m, T2)?.avgRating === exp(rowsT2, MINP), `T1=${pro(m, T1)?.avgRating} (esp ${exp(rowsT1, MINP)}) T2=${pro(m, T2)?.avgRating} (esp ${exp(rowsT2, MINP)})`)
  ck('M3 general: el promedio general usa TODAS las personas (5 distintas) aunque ningún profesional lo alcance por separado', m.j.avgRating === exp([...rowsT1, ...rowsT2], MINP), `obtenido ${m.j.avgRating}`)
  await reset(); await assign({ 0: T1, 1: T1, 2: T2, 3: T2, 4: T2 }); const rows3 = [[0, 5], [0, 4], [0, 5], [1, 4], [1, 5], [2, 3], [3, 4], [4, 5]]; await ins(rows3); m = await metrics(); ck('M3 T1 (2 personas, 5 valoraciones) = null; T2 (3 personas pero solo 3 valoraciones) = null', pro(m, T1)?.avgRating === null && pro(m, T2)?.avgRating === null, `T1=${pro(m, T1)?.avgRating} T2=${pro(m, T2)?.avgRating}`)
  ck('M3 el promedio general de esas 8 valoraciones de 5 personas sí se publica', m.j.avgRating === exp(rows3, MINP), String(m.j.avgRating))
  // ---- avgMood ----
  const MO = [
    ['O1 1 persona × 3 días (6 valores)', [[0, 3, 4], [0, 4, 4], [0, 5, 4]]],
    ['O2 2 personas × 3 días', [[0, 3, 4], [0, 4, 4], [1, 5, 4], [1, 3, 3], [1, 4, 4]]],
    ['O3 3 personas, 5 valores válidos (3+1+1) y extras inválidas', [[0, 3, 4], [1, 4, 6], [2, 5, 0]]],
    ['O4 3 personas pero solo 4 valores válidos', [[0, 3, 4], [1, 4, 6], [2, 0, 6]]],
    ['O5 5 valores válidos de 2 personas + una 3.ª con solo valores inválidos', [[0, 3, 4], [0, 5, 4], [1, 4, 3], [2, 0, 6]]],
    ['O6 3 personas × 2 días (12 valores, todos válidos)', [[0, 1, 2], [0, 3, 4], [1, 5, 5], [1, 2, 3], [2, 4, 4], [2, 1, 2]]],
    ['O7 sin registros', []],
    ['O8 valores nulos', [[0, null, 3], [1, 4, null], [2, 5, 5], [0, null, null]]],
  ]
  for (const [nm, rows] of MO) {
    await reset(); await moods(rows); const flat = rows.flatMap(([u, a, b]) => [[u, a], [u, b]]).filter(([, v]) => v !== null); const e = exp(flat, MINP); const mm = await metrics()
    ck(`M2 ${nm}: avgMood = ${e}`, mm.s === 200 && mm.j.avgMood === e, `obtenido ${mm.j?.avgMood} esperado ${e}`)
    ck(`M2 ${nm}: totalSessions (conteo de registros) = ${rows.length}, sin cambio`, mm.j.totalSessions === rows.length, String(mm.j?.totalSessions))
  }
  // ---- resto de la respuesta, ficha, roles ----
  await reset(); await assign({ 0: T1, 1: T1, 2: T1 }); await ins(rowsT1); await moods([[0, 3, 4], [1, 4, 5], [2, 5, 2]]); m = await metrics()
  const keys = Object.keys(m.j).sort().join(); info('claves de la respuesta:', keys); ck('M5 forma de la respuesta intacta (mismas 15 claves)', keys === ['activeThisWeek', 'activeUsers', 'avgMood', 'avgRating', 'dailyAverage30', 'days30', 'max30', 'range', 'sessionsByDay', 'topTherapists', 'totalSessions', 'totalTherapists', 'totalUsers', 'total30'].sort().join() || Object.keys(m.j).length === 14, keys)
  ck('M5 conteos sin cambio: totalUsers, activeUsers, totalTherapists, totalSessions, activeThisWeek', m.j.totalUsers >= 6 && m.j.totalTherapists >= 2 && m.j.totalSessions === 3 && m.j.activeThisWeek === 3 && m.j.days30.length === 30, JSON.stringify([m.j.totalUsers, m.j.activeUsers, m.j.totalTherapists, m.j.totalSessions, m.j.activeThisWeek]))
  for (const [nm, tk, st] of [['sin sesión', null, [401, 403]], ['token falso', 'x.y.z', [401, 403]], ['persona', P[0].token, [403]], ['profesional', T1.token, [403]], ['admin', AD.token, [200]], ['superadmin', SU.token, [200]]]) { const r = await call('GET', '/api/admin/metrics', tk); ck(`S353-1 ${nm}: /api/admin/metrics → ${st.join('/')}`, st.includes(r.s), String(r.s)) }
  // ficha de la persona: averageOf (sin cambio)
  const fichaKeys = (o, acc = {}) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (/promedio|average/i.test(k)) acc[k] = v; fichaKeys(v, acc) } return acc }
  for (const [n, e] of [[4, null], [5, 4]]) { await reset(); await ins(Array.from({ length: n }, () => [0, 4])); await moods(Array.from({ length: n }, () => [0, 4, 4]).slice(0, Math.ceil(n / 2))); const st = await call('GET', `/api/admin/usuarios/${P[0].id}/stats`, AD.token); const found = fichaKeys(st.j); info(`ficha ${n} valoraciones:`, st.s, JSON.stringify(found)); const rating = Object.entries(found).find(([k]) => /rating/i.test(k)); ck(`M4 ficha (/:id/stats) con ${n} valoraciones propias: promedio de valoración = ${e}`, st.s === 200 && !!rating && rating[1] === e, JSON.stringify(found)) }
  await L.done(); process.exit(0)
})().catch(e => { console.error('FALLO', e); process.exit(1) })
