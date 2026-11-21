// QA-Claude-2 — ES-323 (PR #302): mutaciones en MI clon (t2). Uso: node qa/mut302.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 70)); fs.writeFileSync(p, s.split(a).join(b)) }
const C = 'src/shell/shell.css'; const OPEN = '.cg-header:has(.cg-nav--grid3):has(.cg-usermenu__list:not([hidden]))'
const MUT = [
  ['M1 se quita display: contents del menú abierto', R(C, OPEN + ' .cg-usermenu { display: contents; }', '')],
  ['M2 el panel deja de ser position: static', R(C, 'position: static; grid-column: 1 / -1; grid-row: 2;', 'grid-column: 1 / -1; grid-row: 2;')],
  ['M3 se quita el anclaje a la derecha (right: 0; left: auto)', R(C, '.cg-header:has(.cg-nav--grid3) .cg-usermenu__list { right: 0; left: auto; }', '')],
  ['M4 el corte del menú abierto pasa de 900 a 600 px', R(C, '@media (max-width: 900px) {\n  .cg-header:has(.cg-nav--grid3):has(.cg-usermenu__list:not([hidden]))', '@media (max-width: 600px) {\n  .cg-header:has(.cg-nav--grid3):has(.cg-usermenu__list:not([hidden]))')],
  ['M5 las preferencias no bajan a la fila 3', R(C, OPEN + ' .cg-prefs { grid-row: 3; }', '')],
  ['M6 la navegación no baja a la fila 4', R(C, OPEN + ' .cg-nav--grid3 { grid-row: 4; }', '')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
