// QA-Claude-2 — PR #363 (ES-348 seguimiento) mutaciones: BACKEND=<clon>/backend QA_PG=... node qa/mut363.cjs. Prueba del PR: es-348-umbrales (unitaria) y es-180-postgres (PG). Reporta qué las detecta.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const BE = path.resolve(process.env.BACKEND); const P = (f) => path.join(BE, f)
const files = ['utils/minAverageSample.js', 'routes/adminMetrics.js', 'test/integration/es-180-postgres.cjs']; const orig = Object.fromEntries(files.map((f) => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach((f) => fs.writeFileSync(P(f), orig[f]))
const run = (cmd, env) => { try { execSync(cmd, { cwd: BE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const M = (name, file, a, b, all) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 40)}»`); return } fs.writeFileSync(P(file), all ? s.split(a).join(b) : s.replace(a, () => b))
  const u = run('node --test test/es-348-umbrales.test.cjs'); const pg = run('node --test test/integration/es-180-postgres.cjs', { ES180_TEST_DATABASE_URL: process.env.QA_PG + '/postgres' })
  console.log(`M ${name}: ${u || pg ? 'DETECTADO → ' + [u && 'es-348 (unitaria)', pg && 'es-180 (PG)'].filter(Boolean).join(' + ') : 'SOBREVIVE'}`); restore() }
const U = files[0], R = files[1], T = files[2]
M('MIN_AVERAGE_SAMPLE 5 → 4', U, 'const MIN_AVERAGE_SAMPLE = 5', 'const MIN_AVERAGE_SAMPLE = 4')
M('MIN_DISTINCT_PEOPLE 3 → 2', U, 'const MIN_DISTINCT_PEOPLE = 3', 'const MIN_DISTINCT_PEOPLE = 2')
M('MIN_DISTINCT_PEOPLE 3 → 4', U, 'const MIN_DISTINCT_PEOPLE = 3', 'const MIN_DISTINCT_PEOPLE = 4')
M('la ruta lleva un 5 escrito a mano (avgMood)', R, 'count(m.v) >= :min', 'count(m.v) >= 5')
M('la ruta lleva un 3 escrito a mano (general)', R, 'FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :people', 'FILTER (WHERE "rating" BETWEEN 1 AND 5) >= 3')
M('se quita el reemplazo people', R, 'people: MIN_DISTINCT_PEOPLE, ', '')
M('una consulta pierde :people (ánimo)', R, ' AND count(DISTINCT l."UserId") >= :people', '')
M('una consulta usa > :people (profesional)', R, 'count(DISTINCT r."UserId") FILTER (WHERE r."rating" BETWEEN 1 AND 5) >= :people', 'count(DISTINCT r."UserId") FILTER (WHERE r."rating" BETWEEN 1 AND 5) > :people')
M('es-180 vuelve a un número a mano (n >= 5)', T, 'n >= MIN_AVERAGE_SAMPLE ?', 'n >= 5 ?')
M('es-180 vuelve a 3 a mano (owners.length >= 3)', T, 'owners.length >= MIN_DISTINCT_PEOPLE', 'owners.length >= 3')
M('es-180 espera 4 en el mínimo (la prueba debe fallar en PG)', T, 'own.length >= MIN_AVERAGE_SAMPLE &&', 'own.length >= 4 &&')
M('es-180 deja de exigir personas distintas en lo esperado', T, ' && new Set(ownRows.map((r) => r.UserId)).size >= MIN_DISTINCT_PEOPLE', '')
restore(); console.log('clon restaurado')
