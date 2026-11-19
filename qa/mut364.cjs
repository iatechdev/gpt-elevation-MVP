// QA-Claude-2 — PR #364 (ES-273) mutaciones: BACKEND=<clon>/backend QA_PG=... node qa/mut364.cjs. Primero la prueba del PR (es-273 PG); si sobrevive, mi matriz (qa/e364-matriz.cjs).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = path.resolve(process.env.BACKEND); const P = (f) => path.join(BE, f)
const files = ['routes/ratings.js', 'utils/minAverageSample.js']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b))
  let r = run('node --test test/integration/es-273-postgres.cjs', { ES273_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' }), how = 'por la prueba del PR (es-273)'
  if (!r) { r = run(`node ${path.join(__dirname, 'e364-matriz.cjs')}`, { LABEL: 'pr' }); how = 'solo por mi matriz' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); restore() }
const R = 'routes/ratings.js', U = 'utils/minAverageSample.js'
M('se quita la condición de personas distintas', R, ' && row.people >= MIN_DISTINCT_PEOPLE', '')
M('el mínimo exige > en vez de >=', R, 'row.total >= MIN_AVERAGE_SAMPLE', 'row.total > MIN_AVERAGE_SAMPLE')
M('las personas exigen > en vez de >=', R, 'row.people >= MIN_DISTINCT_PEOPLE', 'row.people > MIN_DISTINCT_PEOPLE')
M('MIN_AVERAGE_SAMPLE 5 → 4', U, 'const MIN_AVERAGE_SAMPLE = 5', 'const MIN_AVERAGE_SAMPLE = 4')
M('MIN_DISTINCT_PEOPLE 3 → 2', U, 'const MIN_DISTINCT_PEOPLE = 3', 'const MIN_DISTINCT_PEOPLE = 2')
M('el promedio pierde el FILTER 1–5', R, 'ROUND((AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric, 1)', 'ROUND(AVG("rating")::numeric, 1)')
M('el total pierde el FILTER (cuenta fuera de escala)', R, 'count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5)::int AS "total"', 'count("rating")::int AS "total"')
M('las personas pierden el FILTER (cuenta personas con solo inválidas)', R, 'count(DISTINCT "UserId") FILTER (WHERE "rating" BETWEEN 1 AND 5)::int AS "people"', 'count(DISTINCT "UserId")::int AS "people"')
M('«sin datos» devuelve 0 en vez de null', R, ': null, total: row.total', ': 0, total: row.total')
M('total cuenta filas (count(*))', R, 'count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5)::int AS "total"', 'count(*)::int AS "total"')
M('se quita el ROUND (más decimales)', R, 'ROUND((AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric, 1)', '(AVG("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5))::numeric')
M('la respuesta añade el campo people (filtra información)', R, 'total: row.total });', 'total: row.total, people: row.people });')
restore(); console.log('clon restaurado')
