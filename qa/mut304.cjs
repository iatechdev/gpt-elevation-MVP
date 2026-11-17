// QA-Claude-2 — ES-308 PR 1/3 (PR #304): mutaciones en MI clon (t2). Uso: node qa/mut304.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 70)); fs.writeFileSync(p, s.split(a).join(b)) }
const RP = 'src/context/resume/ResumesPage.tsx', SP = 'src/evidence/ResumeSkillsPage.tsx', L = 'src/shell/personLayoutState.ts'
const MUT = [
  ['M1 la pantalla de hojas de vida sale de las migradas', R(L, "'/app/context/resumes'", "'/app/context/resumes-x'")],
  ['M2 la pantalla de habilidades sale de las migradas', R(L, "'/app/evidence/resume-skills'", "'/app/evidence/resume-skills-x'")],
  ['M3 se quita el Dialog de la confirmación', R(RP, '<Dialog', '<dialog')],
  ['M4 los botones de la lista vuelven a disabled={busy}', R(RP, 'aria-disabled={busy}', 'disabled={busy}')],
  ['M5 la casilla de habilidades se elige de entrada', R(SP, 'checked={picked.has(skill.name)}', 'checked={true}')],
  ['M6 el botón de la barra fija no se desactiva sin selección', R(SP, 'disabled={!picked.size}', 'disabled={false}')],
  ['M7 se quita la barra fija pg-sticky', R(SP, 'className="pg-sticky"', 'className="pg-nosticky"')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
