// [QA-Claude-3] Mutaciones de #383: construye el worktree mutado y corre el script del PR (es332-dashboard-errores.cjs, ES332_QUICK=1) contra ese build; revierte. Debe FALLAR (salida ≠ 0 o líneas FALLA) con cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const Q = process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3'; const W = Q + '/wt/frontend'; const F = path.join(W, 'src/pages/UserDashboard.tsx')
const M = [
  ['MA «Reintentar» repite TODAS las lecturas, no solo las fallidas', s => s.replace('for (const r of failed) void loaders[r](signal)', 'for (const r of Object.keys(loaders) as Read[]) void loaders[r](signal)')],
  ['MB una respuesta 5xx del plan se trata como éxito (se traga)', s => s.replace("if (!res.ok) { setRead('plan', 'error'); return }", "if (!res.ok) { setRead('plan', 'ok'); return }")],
  ['MC un corte de red de «progreso» se trata como éxito', s => s.replace("catch { if (!signal.aborted) setRead('progress', 'error') }", "catch { if (!signal.aborted) setRead('progress', 'ok') }")],
  ['MD al recuperarse, el foco ya no pasa al título de la tarjeta', s => s.replace("if (state === 'ok') document.getElementById(CARD_HEADING[card])?.focus()", 'void CARD_HEADING')],
]
const orig = fs.readFileSync(F, 'utf8')
for (const [name, fn] of M.filter(m => !process.env.ONLYM || m[0].startsWith(process.env.ONLYM))) {
  const mut = fn(orig); if (mut === orig) { console.log('SIN EFECTO:', name); continue }
  fs.writeFileSync(F, mut)
  const b = cp.spawnSync('npm', ['run', 'build'], { cwd: W, encoding: 'utf8', shell: true, env: { ...process.env, VITE_BACKEND_URL: 'http://localhost:8190' } })
  fs.rmSync(Q + '/dist-383m', { recursive: true, force: true }); fs.renameSync(W + '/dist', Q + '/dist-383m'); fs.writeFileSync(F, orig)
  const r = cp.spawnSync('node', ['qa/run-dev-check.cjs'], { encoding: 'utf8', timeout: 400000, env: { ...process.env, DIST: Q + '/dist-383m', FRONT: W, SCRIPT: 'es332-dashboard-errores.cjs', ES332_QUICK: '1' } })
  const o = (r.stdout || '') + (r.stderr || ''); const fails = o.split(String.fromCharCode(10)).filter(l => /^FALLA/.test(l)); const sal = (o.match(/SALIDA (\d+)/) || [])[1]
  console.log(`${fails.length || sal !== '0' ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | líneas FALLA=${fails.length} salida=${sal} ${fails.slice(0, 2).map(l => l.slice(0, 110)).join(' ; ')}`)
}
fs.writeFileSync(F, orig)
