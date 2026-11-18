// [QA-Claude-3] Mutaciones de #340 (solo qa/). Aplica cada mutación sobre el worktree de pruebas ($QA3_DIR/wt, main + #340 fusionados),
// corre las pruebas unitarias del frontend y revierte. Uso: node qa/mut340.cjs   (el worktree debe estar ya fusionado: bash qa/prep340.sh)
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const M = [
  ['M1 sacar /app/compass de las rutas migradas', 'src/shell/personLayoutState.ts', s => s.replace("'/app/compass'", "'/app/compass-x'")],
  ['M2 sacar /app/evidence de las rutas migradas', 'src/shell/personLayoutState.ts', s => s.replace("'/app/evidence', ", '')],
  ['M3 regenerar el requestId en el reintento de Evidencias (duplicaría la evidencia)', 'src/pages/EvidencePages.tsx', s => s.replace('const write = async (attempt', 'const write0 = () => crypto.randomUUID(); const write = async (attempt').replace(/(const write = async \(attempt[^\n]*\n)/, '$1 void crypto.randomUUID()\n')],
  ['M4 quitar el Dialog de retirar (volver a <dialog>)', 'src/compass/CompassPage.tsx', s => s.replace('<Dialog open={withdrawOpen}', '<dialog open={withdrawOpen}').replace('</Dialog>', '</dialog>')],
  ['M5 la casilla de autorización ya no se deshabilita al vencer', 'src/compass/CompassPage.tsx', s => s.replace('disabled={!!busy || expired}', 'disabled={!!busy}')],
  ['M6 perder el vencimiento de la vista previa', 'src/compass/CompassPage.tsx', s => s.replace('<time dateTime={review.preview.expiresAt}>', '<time>')],
  ['M7 confirmar sin casilla de autorización', 'src/compass/CompassPage.tsx', s => s.replace('!review || !authorized ||', '!review ||')],
  ['M8 el aviso deja de recibir el foco', 'src/compass/CompassPage.tsx', s => s.replace('noticeRef.current?.focus()', 'void 0')],
  ['M9 volver a dibujar encabezado propio (elv-)', 'src/compass/CompassPage.tsx', s => s.replace('<nav className="pg-nav">', '<nav className="elv-nav pg-nav">')],
  ['M10 el aviso de reemplazo desaparece', 'src/compass/CompassPage.tsx', s => s.replace("context.active && <Banner title={tr('replaces')} />", 'false')],
  ['M11 retirar sin cerrar antes el Dialog', 'src/compass/CompassPage.tsx', s => s.replace('setWithdrawOpen(false); locked.current = true', 'locked.current = true')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,110})/gm)].map(x => x[1]).slice(0, 3) } }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (la mutación no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
