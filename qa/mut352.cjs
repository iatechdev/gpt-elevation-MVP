// [QA-Claude-3] Mutaciones de #352 (solo qa/): backend completo + es-260 PG sobre el worktree con main + #352 fusionados. Revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const B = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/backend'; const F = path.join(B, 'utils/routeCatalog.js'); const U = 'postgres://elevation:elevation_local@127.0.0.1:54341/postgres'
const orig = fs.readFileSync(F, 'utf8')
const run = () => { const r = cp.spawnSync('node', ['--test', 'test/integration/es-260-postgres.cjs'], { cwd: B, encoding: 'utf8', env: { ...process.env, ES260_TEST_DATABASE_URL: U } }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^\s+not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
const A = "try { skillLabels = await skillLabelsFor(skillKeys); } catch (error) { console.error('Etiquetas de habilidades no disponibles; el catálogo se sirve sin ellas:', error && error.name); }"
const M = [
  ['MU1 quitar el aislamiento (volver al código de main)', s => s.replace(A, 'skillLabels = await skillLabelsFor(skillKeys);')],
  ['MU2 el catch devuelve skillLabels con datos inventados en vez de {}', s => s.replace(A, "try { skillLabels = await skillLabelsFor(skillKeys); } catch (error) { skillLabels = { x: { es: 'x', en: 'x' } }; }")],
  ['MU3 loguear el error completo (SQL y mensaje)', s => s.replace("error && error.name); }", "error && error.message, error && error.sql); }")],
  ['MU4 sin log (se traga el error en silencio)', s => s.replace("console.error('Etiquetas de habilidades no disponibles; el catálogo se sirve sin ellas:', error && error.name);", '')],
  ['MU5 aislamiento demasiado amplio: un fallo de roles/ofertas también se traga', s => s.replace("const skillKeys = [", "let rolesSwallowed = false; const skillKeys = [")],
]
for (const [name, fn] of M) {
  const mut = fn(orig); if (mut === orig) { console.log('SIN EFECTO:', name); continue }
  fs.writeFileSync(F, mut); const r = run(); fs.writeFileSync(F, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
