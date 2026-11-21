// [QA-Claude-3] Mutaciones de #423 sobre wt (head fusionado): corre la prueba PG del PR + es-18 y revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path'); const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/backend'
const F = { s: path.join(W, 'utils/sessions.js'), a: path.join(W, 'AuthRevocation.js'), r: path.join(W, 'routes/auth.js') }; const orig = Object.fromEntries(Object.entries(F).map(([k, p]) => [k, fs.readFileSync(p, 'utf8')]))
const M = [
  ['M1 compara solo «sv mayor» (acepta tokens con versión menor = cortados)', 's', s => s.replace('payload.sv !== Number(cutoff?.sessionVersion ?? 0)', 'payload.sv > Number(cutoff?.sessionVersion ?? 0)')],
  ['M2 acepta sv mayor que la vigente', 's', s => s.replace('payload.sv !== Number(cutoff?.sessionVersion ?? 0)', 'payload.sv < Number(cutoff?.sessionVersion ?? 0)')],
  ['M3 el corte no sube la versión', 'a', s => s.replace('"sessionVersion" = "AuthRevocations"."sessionVersion" + 1, ', '')],
  ['M4 el login no firma sv', 'r', s => s.replace('issueToken(user, await currentSessionVersion(user.id))', 'issueToken(user)')],
  ['M5 currentSessionVersion siempre 0', 's', s => s.replace("Number((await AuthRevocation.findByPk(userId))?.sessionVersion ?? 0)", '0')],
  ['M6 el instante ya no «solo avanza» (QA-419-3)', 'a', s => s.replace('GREATEST("AuthRevocations"."revokedBefore", EXCLUDED."revokedBefore")', 'EXCLUDED."revokedBefore"')],
  ['M7 el token con sv ignora la versión cuando hay fila (cae a la regla por tiempo)', 's', s => s.replace('if (payload.sv !== undefined) {', 'if (false) {')],
  ['M8 sin fila de corte, un token sv>0 se acepta', 's', s => s.replace('Number(cutoff?.sessionVersion ?? 0)', 'Number(cutoff?.sessionVersion ?? payload.sv)')],
]
const run = () => { const env = { ...process.env, ES366_TEST_DATABASE_URL: 'postgres://elevation:elevation_local@127.0.0.1:54341/postgres' }; let fail = 0, pass = 0
  for (const cmd of [['npm', ['run', 'test:session-version:pg']], ['node', ['--test', 'test/es-18-sessions.test.cjs', 'test/es-18-qa.test.cjs']]]) { const r = cp.spawnSync(cmd[0], cmd[1], { cwd: W, encoding: 'utf8', shell: true, env }); const o = (r.stdout || '') + (r.stderr || ''); fail += Number((o.match(/# fail (\d+)/) || [])[1] || 0); pass += Number((o.match(/# pass (\d+)/) || [])[1] || 0) } return { pass, fail } }
const restore = () => { for (const k in F) fs.writeFileSync(F[k], orig[k]) }
try { const c = run(); console.log('CONTROL pass=' + c.pass + ' fail=' + c.fail)
  for (const [name, k, fn] of M) { const mut = fn(orig[k]); if (mut === orig[k]) { console.log('SIN EFECTO:', name); continue } fs.writeFileSync(F[k], mut); const r = run(); restore(); console.log(`${r.fail > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail}`) } } finally { restore() }
