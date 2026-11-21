// QA-Claude-2 — ES-319 (PR #301): mutaciones en MI clon (t2). Uso: node qa/mut301.cjs <clon>/frontend. Restaura con git checkout -- src (y borra los archivos recreados).
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 70)); fs.writeFileSync(p, s.split(a).join(b)) }
const W = (f, c) => () => fs.writeFileSync(path.join(FE, f), c)
const B = 'src/bridge/BridgePage.tsx'
const MUT = [
  ['M1 los botones del diálogo vuelven a disabled={busy}', R(B, 'aria-disabled={busy} onClick={closeAll}', 'disabled={busy} onClick={closeAll}')],
  ['M2 closeAll cierra aunque esté guardando', R(B, 'const closeAll = () => { if (!busy) setAskAll(false) }', 'const closeAll = () => { setAskAll(false) }')],
  ['M3 se quita la guarda if (busy) return del envío', R(B, '    if (busy) return\n', '')],
  ['M4 se recrea SpaceDialog.tsx', W('src/space/SpaceDialog.tsx', 'export function SpaceDialog() { return null }\n')],
  ['M5 se recrea SpaceShell.tsx', W('src/space/SpaceShell.tsx', 'export function SpaceShell() { return null }\n')],
  ['M6 se quita la regla .space-skip de space.css (la usa la solicitud profesional)', R('src/space/space.css', '.space-skip { position: fixed', '.space-skip-x { position: fixed')],
]
const clean = () => { sh('git checkout -- src'); sh('git clean -fq src/space/SpaceDialog.tsx src/space/SpaceShell.tsx'); sh('git rm -q -f --ignore-unmatch src/space/SpaceDialog.tsx src/space/SpaceShell.tsx') }
for (const [name, fn] of MUT) { clean(); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
clean(); console.log('restaurado')
