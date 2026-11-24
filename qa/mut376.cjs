// [QA-Claude-3] Mutaciones de #376 (solo qa/): `npm test` del frontend sobre el worktree con main + #376 fusionados; revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const PG = 'src/pilot/PilotMetricsPage.tsx', LS = 'src/shell/adminLayoutState.ts'
const M = [
  ['MU1 el modo por defecto pide datos al servidor', PG, s => s.replace('function NoData() {', "function NoData() {\n  useEffect(() => { void fetch('/api/admin/pilot-metrics') }, [])")],
  ['MU2 una meta con cifra inventada', PG, s => s.replace('<p>{c.targetPending}</p>', '<p>{c.targetPending} · 80 %</p>')],
  ['MU3 el estado queda sin palabra (solo chip vacío)', PG, s => s.replace('{c[m.status]}</Chip>', '</Chip>')],
  ['MU4 la franja de vista preliminar desaparece', PG, s => s.replace('<Banner kind="note" title={c.preview}><p>{c.local}</p></Banner>', '')],
  ['MU5 el error sin «Reintentar carga»', PG, s => s.replace('{c.retry}</Button></div></Banner>}', '</Button></div></Banner>}')],
  ['MU6 la pantalla vuelve a un estilo en línea con color propio', PG, s => s.replace('<div className="pg pg-wide pm">', '<div className="pg pg-wide pm" style={{ color: "#123456" }}>')],
  ['MU7 /admin/pilot-metrics fuera de las rutas migradas', LS, s => s.replace(", '/admin/pilot-metrics'", '')],
  ['MU8 la ruta migrada pierde otra ruta (conservar todas)', LS, s => s.replace("'/admin/users', ", '')],
  ['MU9 dos h1 a la vez (uno por modo)', PG, s => s.replace('<Targets />\n    <h2 className="pm-h2">{c.observedResults}</h2>', '<Targets />\n    <h1 className="pg-title">{c.metricsTitle}</h1>\n    <h2 className="pm-h2">{c.observedResults}</h2>')],
  ['MU10 «Actualizar» ya no se deshabilita en el modo por defecto', PG, s => s.replace('<Button variant="ghost" disabled aria-describedby="metrics-refresh-note">', '<Button variant="ghost" aria-describedby="metrics-refresh-note">')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
