// QA-Claude-2 — PR #341 (ES-343) mutaciones sobre el clon: BACKEND=<clon>/backend QA_PG=... node qa/mut341.cjs
// Primero la prueba del PR (es-180, PG); si sobrevive, mi guion de mínimo (qa/e341-minimo.cjs).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = process.env.BACKEND; const P = (f) => path.join(BE, f)
const files = ['routes/adminMetrics.js', 'utils/minAverageSample.js']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b))
  let r = run('node --test test/integration/es-180-postgres.cjs', { ES180_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }), how = 'por la prueba del PR (es-180)'
  if (!r) { r = run(`node ${path.join(__dirname, 'e341-minimo.cjs')}`, { LABEL: 'pr' }); how = 'solo por mi guion' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const AM = 'routes/adminMetrics.js', UT = 'utils/minAverageSample.js'
M('a el mínimo baja de 5 a 4 (util y SQL)', UT, 'MIN_AVERAGE_SAMPLE = 5', 'MIN_AVERAGE_SAMPLE = 4')
M('b2 el CASE del general cuenta todas las valoraciones (sin filtro de escala)', AM, 'CASE WHEN count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :min', 'CASE WHEN count("rating") >= :min')
M('c el ánimo ya no tiene mínimo', AM, 'CASE WHEN count("checkin_mood") + count("checkout_mood") >= :min', 'CASE WHEN true')
M('d el profesional ya no tiene mínimo', AM, 'CASE WHEN count(r."rating") FILTER (WHERE r."rating" BETWEEN 1 AND 5) >= :min', 'CASE WHEN true')
M('e el mínimo del ánimo cuenta solo las entradas (no las salidas)', AM, 'CASE WHEN count("checkin_mood") + count("checkout_mood") >= :min', 'CASE WHEN count("checkin_mood") >= :min')
M('f el general exige > 5 en vez de ≥ 5', AM, 'CASE WHEN count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :min', 'CASE WHEN count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5) > :min')
M('g por debajo del mínimo devuelve 0 en vez de null (general)', AM, 'THEN ROUND((AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric, 1) END AS "avgRating" FROM "SessionRatings"', 'THEN ROUND((AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric, 1) ELSE 0 END AS "avgRating" FROM "SessionRatings"')
M('h averageOf (ficha de usuario) exige > en vez de ≥', UT, 'values.length >= MIN_AVERAGE_SAMPLE', 'values.length > MIN_AVERAGE_SAMPLE')
M('i el promedio del ánimo divide por solo las entradas', AM, '/ (count("checkin_mood") + count("checkout_mood")), 1) END AS "avgMood"', '/ count("checkin_mood"), 1) END AS "avgMood"')
restore(); console.log('clon restaurado')
