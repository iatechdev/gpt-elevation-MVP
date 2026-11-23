// [QA-Claude-5] #436: mutaciones propias (copia de trabajo de QA; se restaura con git). Aplica, construye, sirve en 4404 y corre la batería de flujo (es, 390 y 1360).
const fs = require('fs'); const cp = require('child_process'); const path = require('path'); const REPO = (process.env.QA_TOOLS || '.') + '/qa5/pr402'; const FE = REPO + '/frontend'; const F = path.join(FE, 'src/pages/ChatPage.tsx')
const sh = (c, cwd, env) => cp.spawnSync(c, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, ...env, PATH: (process.env.QA_TOOLS || '.') + '/node22;' + process.env.PATH } })
const M = [
  ['a_handleLogout_vuelve_a_preguntar', 'const handleLogout = async () => {\n', 'const handleLogout = async () => {\n    if (!chat.canLeave()) return\n'],
  ['b_escritorio_abre_despedida_sin_preguntar', "onCheckout={() => { if (chat.canLeave()) setShowCheckout(true) }}", 'onCheckout={() => setShowCheckout(true)}'],
  ['c_guardia_movil_no_pregunta', 'registerLeaveGuard(() => { if (!live.current.canLeave()) return true; setShowCheckout(true); return true }', 'registerLeaveGuard(() => { setShowCheckout(true); return true }'],
  ['d_cancelar_cierra_igual_escritorio', "onCheckout={() => { if (chat.canLeave()) setShowCheckout(true) }}", 'onCheckout={() => { chat.canLeave(); setShowCheckout(true) }}'],
]
sh('git checkout -q --detach refs/qa5/p436', REPO); const orig = fs.readFileSync(F, 'utf8'); const out = []
;(async () => { try { for (const [id, a, b] of M) { if (process.env.ONLY && id[0] !== process.env.ONLY) continue
  if (!orig.includes(a)) { console.log(id + ': NO APLICA'); continue } fs.writeFileSync(F, orig.split(a).join(b)); const bl = sh('npx vite build --outDir $QA_TOOLS/qa5/dist-mut436 --emptyOutDir', FE); fs.writeFileSync(F, orig); if (bl.status) { console.log(id + ': no compila'); continue }
  const srv = cp.spawn(process.execPath, ['qa/qa5-402-serve.cjs'], { env: { ...process.env, DIST: (process.env.QA_TOOLS || '.') + '/qa5/dist-mut436', API_PORT: '8402', PORT: '4404' }, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 2500))
  const r = sh('node qa/qa5-436.cjs', process.cwd(), { BASE: 'http://127.0.0.1:4404', SECT: 'flujo', LANGS: 'es', WIDTHS: '390,1360' }); srv.kill(); const fails = r.stdout.split('\n').filter(l => l.startsWith('FALLA')).map(l => l.slice(6, 120))
  console.log(`${id}: ${fails.length ? 'DETECTADA' : 'ESCAPÓ'} (${fails.length} fallos)`); fails.slice(0, 3).forEach(f => console.log('   ' + f)) } } finally { fs.writeFileSync(F, orig) }})()
