// QA-Claude-2 — PR #341 (ES-343): mínimo de 5 entradas en los promedios de /api/admin/metrics, contra PostgreSQL REAL y las rutas reales.
// Uso: BACKEND=<clon>/backend QA_PG=postgres://usuario:clave@127.0.0.1:54331 [LABEL=pr|main] [DUMP=<archivo.json>] [PERF=1] node qa/e341-minimo.cjs
// Se corre sobre el código del PR y, como control, sobre el de main (LABEL=main: las aserciones del mínimo se registran como «CONTROL», no como fallas).
// DUMP guarda las respuestas completas de un conjunto de datos fijo, para compararlas campo a campo entre main y el PR. Crea y borra SOLO su base aleatoria (loopback). Datos sintéticos.
const path = require('path'), fs = require('fs'), { randomBytes } = require('crypto'), { once } = require('events')
const BE = path.resolve(process.env.BACKEND), LABEL = process.env.LABEL || 'pr', CONTROL = LABEL === 'main'
const rq = (m) => require(path.join(BE, 'node_modules', m)), mod = (m) => require(path.join(BE, m)); const express = rq('express'), { Sequelize } = rq('sequelize')
let total = 0, fails = 0, ctrl = 0; const ck = (n, ok, d = '') => { total++; if (!ok) { if (CONTROL) { ctrl++; console.log(`CONTROL (esperado en main) ${n} ${String(d).slice(0, 200)}`) } else { fails++; console.log(`FALLA ${n} ${String(d).slice(0, 260)}`) } } else if (process.env.VERBOSE) console.log('OK   ' + n) }
const info = (...a) => console.log('INFO', `[${LABEL}]`, ...a); const r1 = (x) => Math.round(x * 10) / 10; const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }
;(async () => {
  const src = new URL(process.env.QA_PG + '/postgres'); if (!['127.0.0.1', 'localhost'].includes(src.hostname)) throw new Error('solo loopback')
  const dbName = 'qa2_e341_' + randomBytes(6).toString('hex'); const admin = new Sequelize(src.toString(), { logging: false, dialectOptions: { ssl: false } }); await admin.query(`CREATE DATABASE "${dbName}"`)
  const u = new URL(src); u.pathname = '/' + dbName; const sequelize = new Sequelize(u.toString(), { logging: false, dialectOptions: { ssl: false }, pool: { max: 12, min: 0, acquire: 20000 } })
  process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.PROMPT_ENCRYPTION_KEY = randomBytes(32).toString('hex')
  const dbm = require.resolve(path.join(BE, 'database')); require.cache[dbm] = { id: dbm, filename: dbm, loaded: true, exports: { sequelize } }
  const User = mod('User'), MoodLog = mod('MoodLog'), SessionRating = mod('SessionRating'); await mod('PricingPlan').sync()
  for (const m of ['User', 'DeletionRequest', 'AuthRevocation', 'RevokedToken', 'MoodLog', 'SessionRating', 'TherapistProfile', 'EthicManifest']) await mod(m).sync(); await mod('promptVault').PromptVault.sync()
  const { issueToken } = mod('utils/sessions'), { verificarAdmin } = mod('middlewares/auth')
  const app = express(); app.use(express.json()); app.use('/api/admin/metrics', verificarAdmin, mod('routes/adminMetrics')); app.use('/api/admin/usuarios', verificarAdmin, mod('routes/adminUsers'))
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port
  const mk = (role, name, extra = {}) => User.create({ name, email: `${name.toLowerCase()}-${randomBytes(3).toString('hex')}@example.invalid`, password: 'x', role, ...extra })
  const sup = await mk('superadmin', 'QaSup'), adm = await mk('admin', 'QaAdm'), plain = await mk('user', 'QaPlain'), pro = await mk('therapist', 'QaPro')
  const T1 = await mk('therapist', 'QaT1'), T2 = await mk('therapist', 'QaT2'), T3 = await mk('therapist', 'QaT3')
  const P1 = [], P2 = []; for (let i = 0; i < 60; i++) P1.push(await mk('user', 'P1_' + i, { therapistId: T1.id })); for (let i = 0; i < 8; i++) P2.push(await mk('user', 'P2_' + i, { therapistId: T2.id }))
  const tk = new Map(); const T = (w) => { if (!tk.has(w.id)) tk.set(w.id, issueToken(w)); return tk.get(w.id) }
  const call = async (w, p) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: w ? { Authorization: `Bearer ${T(w)}` } : {} }); const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { /* no JSON */ } return { s: r.status, j, t } }
  const metrics = async () => (await call(sup, '/api/admin/metrics')).j
  const setRatings = async (pairs) => { await sequelize.query('DELETE FROM "SessionRatings"'); for (const [uid, v] of pairs) await sequelize.query('INSERT INTO "SessionRatings"("UserId","rating","date","createdAt","updatedAt") VALUES($1,$2,CURRENT_DATE,now(),now())', { bind: [uid, v] }) }
  const setMood = async (rows) => { await sequelize.query('DELETE FROM "MoodLogs"'); for (const [uid, off, ci, co] of rows) await sequelize.query(`INSERT INTO "MoodLogs"("UserId","date","checkin_mood","checkout_mood","createdAt","updatedAt") VALUES($1,CURRENT_DATE-$2::int,$3,$4,now(),now())`, { bind: [uid, off, ci, co] }) }
  const tr = (m, t) => m.topTherapists.find((x) => x.id === t.id)
  try {
    // C3 valoraciones: n distintas personas (P1), 0,1,2,3,4,5,6,50
    const VALS = Array.from({ length: 50 }, (_, i) => [2, 5, 4, 1, 3][i % 5])
    for (const n of [0, 1, 2, 3, 4, 5, 6, 50]) { await setRatings(VALS.slice(0, n).map((v, i) => [P1[i].id, v])); const m = await metrics(); const exp = n >= 5 ? r1(mean(VALS.slice(0, n))) : null
      ck(`C3 general con ${n} valoraciones (de ${n} personas) = ${exp}`, m.avgRating === exp, `fue ${m.avgRating}`); ck(`C3 profesional T1 con ${n} valoraciones = ${exp}`, tr(m, T1) && tr(m, T1).avgRating === exp, tr(m, T1) && `fue ${tr(m, T1).avgRating}`)
      if (n >= 1 && n < 5) ck(`C3 con ${n} (< 5) ningún valor individual aparece en la respuesta`, !JSON.stringify(m).includes(`"avgRating":${VALS[0]}`) && m.avgRating === null) }
    // fuera de escala y nulas
    await setRatings([[P1[0].id, 4], [P1[1].id, 5], [P1[2].id, 3], [P1[3].id, 30000], [P1[4].id, 0]]); let m = await metrics(); ck('C3 3 válidas + 2 fuera de escala = 3 entradas → null (general y profesional)', m.avgRating === null && tr(m, T1).avgRating === null, `${m.avgRating}/${tr(m, T1).avgRating}`)
    await setRatings([[P1[0].id, null], [P1[1].id, null], [P1[2].id, null], [P1[3].id, null], [P1[4].id, null], [P1[5].id, 4]]); m = await metrics(); ck('C3 5 nulas + 1 valor → null', m.avgRating === null && tr(m, T1).avgRating === null, `${m.avgRating}`)
    await setRatings([[P1[0].id, 4], [P1[1].id, 5], [P1[2].id, 3], [P1[3].id, 4], [P1[4].id, 5], [P1[5].id, 30000], [P1[6].id, 0], [P1[7].id, null]]); m = await metrics(); ck('C3 5 válidas + 3 inválidas (fuera de escala y nula) → promedio de las 5 válidas = 4,2', m.avgRating === 4.2 && tr(m, T1).avgRating === 4.2, `${m.avgRating}/${tr(m, T1).avgRating}`)
    // dos profesionales: 4 y 5 a la vez; uno sin personas
    await setRatings([...[5, 4, 3, 2].map((v, i) => [P1[i].id, v]), ...[5, 5, 4, 4, 3].map((v, i) => [P2[i].id, v])]); m = await metrics()
    ck('C3 T1 con 4 valoraciones = null y T2 con 5 = 4,2 a la vez', tr(m, T1).avgRating === null && tr(m, T2).avgRating === 4.2, `${tr(m, T1).avgRating}/${tr(m, T2).avgRating}`); ck('C3 general con 9 valoraciones = promedio de las 9 (3,9)', m.avgRating === r1(mean([5, 4, 3, 2, 5, 5, 4, 4, 3])), `${m.avgRating}`)
    ck('C3 T3 (sin personas) existe sin promedio y sin error', (!tr(m, T3) || tr(m, T3).avgRating === null) && (await call(sup, '/api/admin/metrics')).s === 200)
    // C4 privacidad: una sola persona con 5 valoraciones; una sola con 3 registros de ánimo (6 valores)
    await setRatings([5, 5, 5, 5, 5].map((v) => [P1[0].id, v])); m = await metrics(); const pubRating = m.avgRating !== null; info(`C4 UNA persona con 5 valoraciones: general=${m.avgRating}, profesional=${tr(m, T1).avgRating} → ${pubRating ? 'SE PUBLICA el promedio de una sola persona' : 'no se publica'}`)
    await setRatings([[P1[0].id, 1], [P1[0].id, 2], [P1[0].id, 1], [P1[0].id, 2], [P1[0].id, 1]]); m = await metrics(); info(`C4 UNA persona con valoraciones 1,2,1,2,1: general=${m.avgRating} (su media real = 1,4)`)
    await setMood([[P1[0].id, 0, 1, 2], [P1[0].id, 1, 3, 4], [P1[0].id, 2, 5, 5]]); m = await metrics(); info(`C4 UNA persona con 3 registros de ánimo (6 valores): avgMood=${m.avgMood} (se publica el promedio de una sola persona: ${m.avgMood !== null})`)
    global.QA_C4 = { rating: pubRating, mood: m.avgMood !== null }
    // C3 ánimo: el mínimo cuenta valores (entrada + salida); distintas personas
    const moodCases = [['sin registros', [], null], ['1 registro con entrada', [[0, 2, null]], null], ['4 entradas', [1, 2, 3, 4].map((v, i) => [i, v, null]), null], ['4 salidas', [1, 2, 3, 4].map((v, i) => [i, null, v]), null], ['5 entradas', [1, 2, 3, 4, 5].map((v, i) => [i, v, null]), 3], ['5 salidas', [1, 2, 3, 4, 5].map((v, i) => [i, null, v]), 3], ['6 entradas', [1, 2, 3, 4, 5, 5].map((v, i) => [i, v, null]), 3.3], ['2 registros con entrada y salida (4 valores)', [[0, 1, 5], [1, 2, 4]], null], ['3 registros con entrada y salida (6 valores)', [[0, 1, 5], [1, 2, 4], [2, 3, 3]], 3], ['mixto 2 entradas + 2 salidas + 1 doble = 5 valores... (2+2+2)=6', [[0, 1, null], [1, 2, null], [2, null, 3], [3, null, 4], [4, 5, 5]], r1((1 + 2 + 3 + 4 + 5 + 5) / 6)], ['mixto 4 valores', [[0, 1, null], [1, null, 3], [2, 5, null], [3, null, 4]], null]]
    for (const [lab, rows, exp] of moodCases) { await setMood(rows.map(([i, ci, co]) => [P1[i].id, 0, ci, co])); const mm = await metrics(); ck(`C3 ánimo: ${lab} → ${exp}`, mm.avgMood === exp, `fue ${mm.avgMood}`); ck(`C3 ánimo: ${lab}: totalSessions (registros) = ${rows.length}`, mm.totalSessions === rows.length, `${mm.totalSessions}`) }
    // C5: averageOf viejo contra nuevo
    const mf = path.join(BE, 'utils', 'minAverageSample.js'); if (fs.existsSync(mf)) { const { averageOf } = require(mf); const old = (v) => (v.length >= 5 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null); let same = true, d = ''
      for (let len = 0; len <= 10; len++) for (let rep = 0; rep < 40; rep++) { const v = Array.from({ length: len }, () => 1 + Math.floor(Math.random() * 5)); if (averageOf(v) !== old(v)) { same = false; d = JSON.stringify(v) } }
      ck('C5 averageOf nuevo = el de adminUsers de main (longitudes 0–10 × 40 muestras)', same, d); ck('C5 averageOf exporta MIN_AVERAGE_SAMPLE = 5', require(mf).MIN_AVERAGE_SAMPLE === 5, String(require(mf).MIN_AVERAGE_SAMPLE)) }
    // C6 acceso y manipulación
    for (const [lab, w, ok] of [['sin sesión', null, [401, 403]], ['persona', plain, [403]], ['profesional', pro, [403]], ['admin', adm, [200]], ['superadmin', sup, [200]]]) { const r = await call(w, '/api/admin/metrics'); ck(`C6 ${lab} → ${ok.join('/')}`, ok.includes(r.s), `${r.s}`) }
    for (const q of ['?min=0', '?min=-1', '?days=abc', "?x=';DROP TABLE \"Users\";--", '?min[]=1&min[]=2']) { const r = await call(sup, '/api/admin/metrics' + q); ck(`C6 query ${q.slice(0, 20)} no cambia el mínimo ni da 5xx`, r.s === 200 && r.j && r.j.avgMood !== undefined, `${r.s}`) }
    await setRatings([[P1[0].id, 5], [P1[1].id, 5]]); ck('C6 ?min=0 no baja el mínimo (con 2 valoraciones sigue null)', (await call(sup, '/api/admin/metrics?min=0')).j.avgRating === null || CONTROL)
    // conjunto de datos fijo para comparar main y PR (DUMP): ratings y ánimo deterministas, varios profesionales
    if (process.env.DUMP) { let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647
      const rts = []; for (let i = 0; i < 40; i++) rts.push([P1[i % P1.length].id, 1 + Math.floor(rnd() * 5)]); for (let i = 0; i < 3; i++) rts.push([P2[i].id, 1 + Math.floor(rnd() * 5)]); rts.push([P1[3].id, 99], [P2[4].id, null])
      await setRatings(rts); const mr = []; for (let i = 0; i < 45; i++) mr.push([P1[i % P1.length].id, Math.floor(i / P1.length) * 3 + (i % 3), 1 + Math.floor(rnd() * 5), rnd() > 0.4 ? 1 + Math.floor(rnd() * 5) : null]); for (let i = 0; i < 3; i++) mr.push([P2[i].id, i, 3, null])
      await setMood(mr); const full = (await call(sup, '/api/admin/metrics')).j; fs.writeFileSync(process.env.DUMP, JSON.stringify(full, null, 1)); info('DUMP guardado:', process.env.DUMP)
      // y un caso con pocos datos (los promedios deben ser null en el PR y numéricos en main)
      await setRatings([[P1[0].id, 4], [P1[1].id, 2]]); await setMood([[P1[0].id, 0, 2, 3]]); fs.writeFileSync(process.env.DUMP.replace('.json', '-pocos.json'), JSON.stringify((await call(sup, '/api/admin/metrics')).j, null, 1)) }
    if (process.env.DUMPUI) { await setRatings([]); await setMood([]); const a = (await call(sup, '/api/admin/metrics')).j
      await setRatings([[P1[0].id, 4], [P1[1].id, 2], [P2[0].id, 5]]); await setMood([[P1[0].id, 0, 2, 3]]); const b = (await call(sup, '/api/admin/metrics')).j
      await setRatings([5, 4, 5, 3, 4, 5].map((v, i) => [P1[i].id, v])); await setMood([1, 2, 3, 4, 5, 3].map((v, i) => [P1[i].id, 0, v, null])); const c = (await call(sup, '/api/admin/metrics')).j
      fs.writeFileSync(process.env.DUMPUI, JSON.stringify({ vacio: a, pocos: b, suficientes: c }, null, 1)); info('DUMPUI guardado') }
    // C9 rendimiento
    if (process.env.PERF) { await sequelize.query('DELETE FROM "MoodLogs"'); await sequelize.query('DELETE FROM "SessionRatings"')
      await sequelize.query(`INSERT INTO "MoodLogs"("UserId","date","checkin_mood","checkout_mood","createdAt","updatedAt") SELECT u.id, CURRENT_DATE - (g % 400), 1 + (g % 5), CASE WHEN g % 3 = 0 THEN NULL ELSE 1 + ((g + 2) % 5) END, now(), now() FROM generate_series(1, 400) g CROSS JOIN LATERAL (SELECT id FROM "Users" WHERE role='user' ORDER BY id OFFSET (g % 60) LIMIT 1) u ON CONFLICT DO NOTHING`)
      const nm = (await sequelize.query('SELECT count(*)::int n FROM "MoodLogs"', { type: 'SELECT' }))[0].n
      await sequelize.query(`INSERT INTO "MoodLogs"("UserId","date","checkin_mood","checkout_mood","createdAt","updatedAt") SELECT u.id, CURRENT_DATE - d, 1 + ((u.id + d) % 5), 1 + ((u.id * d) % 5), now(), now() FROM (SELECT id FROM "Users" WHERE role='user') u CROSS JOIN generate_series(401, 700) d ON CONFLICT DO NOTHING`)
      await sequelize.query(`INSERT INTO "SessionRatings"("UserId","rating","date","createdAt","updatedAt") SELECT u.id, 1 + ((u.id + g) % 5), CURRENT_DATE, now(), now() FROM (SELECT id FROM "Users" WHERE role='user') u CROSS JOIN generate_series(1, 80) g`)
      // más volumen: duplicar con otras fechas hasta ~20 000 registros de ánimo
      await sequelize.query(`INSERT INTO "MoodLogs"("UserId","date","checkin_mood","checkout_mood","createdAt","updatedAt") SELECT u.id, CURRENT_DATE - d, 1 + ((u.id + d) % 5), 1 + ((u.id * d) % 5), now(), now() FROM (SELECT id FROM "Users" WHERE role='user') u CROSS JOIN generate_series(701, 1000) d ON CONFLICT DO NOTHING`)
      const cm = (await sequelize.query('SELECT count(*)::int n FROM "MoodLogs"', { type: 'SELECT' }))[0].n, cr = (await sequelize.query('SELECT count(*)::int n FROM "SessionRatings"', { type: 'SELECT' }))[0].n
      for (let i = 0; i < 20; i++) await call(sup, '/api/admin/metrics') // calentamiento
      const xs = []; for (let i = 0; i < Number(process.env.PERFN || 30); i++) { const t = process.hrtime.bigint(); const r = await call(sup, '/api/admin/metrics'); if (r.s !== 200) throw new Error('perf ' + r.s); xs.push(Number(process.hrtime.bigint() - t) / 1e6) }
      info(`C9 con ${cm} registros de ánimo y ${cr} valoraciones: p50 ${Math.round(pct(xs, 0.5))} ms, p95 ${Math.round(pct(xs, 0.95))} ms, max ${Math.round(Math.max(...xs))} ms`); ck('C9 p95 < 500 ms', pct(xs, 0.95) < 500, `${Math.round(pct(xs, 0.95))}`) }
  } finally { server.close(); server.closeAllConnections?.(); await sequelize.close(); await admin.query(`DROP DATABASE "${dbName}"`); await admin.close() }
  console.log(`RESUMEN [${LABEL}]: ${total - fails - ctrl}/${total} OK, ${fails} FALLAS${CONTROL ? `, ${ctrl} comprobaciones del mínimo que en main fallan (control: reproduce el hallazgo)` : ''}`); process.exit(fails ? 1 : 0)
})().catch((e) => { console.log('EXCEPCION', e.stack || e.message); process.exit(2) })
