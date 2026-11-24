// [QA-Claude-3] Mutaciones de #353 (solo qa/): corre es-180 PG (la prueba del PR) sobre el worktree con main + #353 fusionados y revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const B = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/backend'; const U = 'postgres://elevation:elevation_local@127.0.0.1:54341/postgres'
const RT = path.join(B, 'routes/adminMetrics.js'), CT = path.join(B, 'utils/minAverageSample.js')
const run = () => { const r = cp.spawnSync('node', ['--test', 'test/integration/es-180-postgres.cjs'], { cwd: B, encoding: 'utf8', env: { ...process.env, ES180_TEST_DATABASE_URL: U } }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^\s+not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
const M = [
  ['MU1 umbral de personas 3 → 2', CT, s => s.replace('const MIN_DISTINCT_PEOPLE = 3;', 'const MIN_DISTINCT_PEOPLE = 2;')],
  ['MU2 avgRating general cuenta filas en vez de personas distintas (quitar DISTINCT)', RT, s => s.replace('count(DISTINCT "UserId") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :people', 'count("UserId") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :people')],
  ['MU3 avgRating general cuenta personas con valoraciones fuera de 1–5 (quitar el filtro de la cuenta de personas)', RT, s => s.replace('count(DISTINCT "UserId") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :people', 'count(DISTINCT "UserId") >= :people')],
  ['MU4 avgMood vuelve a promediar valores fuera de 1–5 (quitar el WHERE)', RT, s => s.replace('WHERE m.v BETWEEN 1 AND 5`', '`')],
  ['MU5 avgMood no exige personas distintas', RT, s => s.replace(' AND count(DISTINCT l."UserId") >= :people', '')],
  ['MU6 por profesional no exige personas distintas', RT, s => s.replace(' AND count(DISTINCT r."UserId") FILTER (WHERE r."rating" BETWEEN 1 AND 5) >= :people', '')],
  ['MU7 por profesional cuenta personas sin el filtro 1–5', RT, s => s.replace('count(DISTINCT r."UserId") FILTER (WHERE r."rating" BETWEEN 1 AND 5) >= :people', 'count(DISTINCT r."UserId") >= :people')],
  ['MU8 «≥ personas» pasa a «> personas» en el promedio general', RT, s => s.replace('FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :people', 'FILTER (WHERE "rating" BETWEEN 1 AND 5) > :people')],
  ['MU9 «≥ entradas» pasa a «> entradas» en avgMood', RT, s => s.replace('count(m.v) >= :min', 'count(m.v) > :min')],
  ['MU10 avgRating general ya no exige el mínimo de entradas', RT, s => s.replace('count("rating") FILTER (WHERE "rating" BETWEEN 1 AND 5) >= :min AND count(DISTINCT "UserId")', 'count(DISTINCT "UserId")')],
]
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = fs.readFileSync(file, 'utf8'); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  fs.writeFileSync(file, mut); const r = run(); fs.writeFileSync(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
