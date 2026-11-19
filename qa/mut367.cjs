// QA-Claude-2 — PR #367 (ES-341) mutaciones: BACKEND=<clon>/backend QA_PG=... MAIN_JSON=<usuarios-main.json> node qa/mut367.cjs. Primero es-341 (PG) del PR; si sobrevive, mi equivalencia contra la respuesta de main (qa/e367-equiv.cjs, N hasta 200).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = path.resolve(process.env.BACKEND); const P = (f) => path.join(BE, f)
const files = ['routes/adminUsers.js', 'utils/minAverageSample.js']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 900000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const TMP = path.join(path.dirname(process.env.MAIN_JSON), 'mut'); const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b))
  let r = run('node --test test/integration/es-341-postgres.cjs', { ES341_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }), how = 'por es-341 (PR)'
  if (!r) { fs.mkdirSync(TMP, { recursive: true }); fs.copyFileSync(process.env.MAIN_JSON, path.join(TMP, 'usuarios-main.json')); const o = run(`node "${path.join(__dirname, 'e367-equiv.cjs')}"`, { LABEL: 'pr', OUT: TMP, SIZES: '0,1,4,5,6,30,200', NO_ROLES: '1' }); if (o) r = true; else r = run(`node "${path.join(__dirname, 'e367-equiv.cjs')}" --comparar "${TMP}"`); how = 'solo por mi equivalencia' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const R = 'routes/adminUsers.js', U = 'utils/minAverageSample.js'
M('el ánimo ya no descarta los 0 (sin NULLIF en check-in)', R, 'count(NULLIF("checkin_mood", 0)) + count(NULLIF("checkout_mood", 0)) AS mood_count', 'count("checkin_mood") + count(NULLIF("checkout_mood", 0)) AS mood_count')
M('la suma del ánimo cuenta los 0 del check-in', R, 'COALESCE(sum(NULLIF("checkin_mood", 0)), 0) + COALESCE(sum(NULLIF("checkout_mood", 0)), 0) AS mood_sum', 'COALESCE(sum("checkin_mood"), 0) + COALESCE(sum(NULLIF("checkout_mood", 0)), 0) AS mood_sum')
M('el ánimo cuenta solo el check-in', R, 'count(NULLIF("checkin_mood", 0)) + count(NULLIF("checkout_mood", 0)) AS mood_count', 'count(NULLIF("checkin_mood", 0)) AS mood_count')
M('la calificación NULL ya no suma 0 ni cuenta (cambia el quirk conservado)', R, 'count(*) AS rating_count, COALESCE(sum(COALESCE("rating", 0)), 0) AS rating_sum', 'count("rating") AS rating_count, COALESCE(sum("rating"), 0) AS rating_sum')
M('rating_count cuenta solo las válidas 1–5', R, 'count(*) AS rating_count', 'count(*) FILTER (WHERE "rating" BETWEEN 1 AND 5) AS rating_count')
M('sesiones sale de otra tabla (SessionRatings)', R, 'SELECT "UserId", count(*) AS sesiones,', 'SELECT "UserId", 0 AS sesiones,')
M('averageFromTotals exige > en vez de >=', U, 'count >= MIN_AVERAGE_SAMPLE ? Math.round', 'count > MIN_AVERAGE_SAMPLE ? Math.round')
M('averageFromTotals con el mínimo 4', U, 'const MIN_AVERAGE_SAMPLE = 5', 'const MIN_AVERAGE_SAMPLE = 4')
M('averageFromTotals sin redondeo a 1 decimal', U, 'Math.round((sum / count) * 10) / 10 : null);\nmodule', 'sum / count : null);\nmodule')
M('el IN no recibe los ids (lista vacía de ids → sin stats)', R, 'WHERE "UserId" IN (:ids) GROUP BY "UserId"`, { replacements: { ids }, type: \'SELECT\' }),\n    sequelize.query(', 'WHERE "UserId" IN (NULL) GROUP BY "UserId"`, { replacements: { ids }, type: \'SELECT\' }),\n    sequelize.query(')
M('las estadísticas de una persona se pegan a otra (clave por índice)', R, 'const s = stats.get(u.id) || EMPTY_STATS;', 'const s = stats.get(u.id + 1) || EMPTY_STATS;')
M('se pierde el deletionRequested', R, 'deletionRequested: pendientes.has(u.id),', 'deletionRequested: false,')
restore(); console.log('clon restaurado')
