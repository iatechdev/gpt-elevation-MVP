// QA-Claude-2 — ES-317 (PR #303): mutaciones en MI clon (t2). Uso: node qa/mut303.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 70)); fs.writeFileSync(p, s.split(a).join(b)) }
const P = 'src/pages/SkillMapPage.tsx', S = 'src/shell/shell.css', M = 'src/skill-map/mapCartografia.css'
const MUT = [
  ['M1 el botón vuelve a aparecer solo con el mapa listo', R(P, '{view !== \'radar\' && <button type="button" className="elv-btn skill-map-primary" disabled={state.status !== \'ready\'}', '{state.status === \'ready\' && view !== \'radar\' && <button type="button" className="elv-btn skill-map-primary" disabled={state.status !== \'ready\'}')],
  ['M2 el botón durante la carga ya no está deshabilitado', R(P, 'disabled={state.status !== \'ready\'} onClick', 'onClick')],
  ['M3 se quita visibility: hidden del pie en carga', R(S, '.cg-frame:has(.skill-map-scope[data-loading]) .cg-footer { visibility: hidden; }', '')],
  ['M4 se quita data-loading de la raíz del mapa', R(P, " data-loading={state.status === 'loading' ? '' : undefined}", '')],
  ['M5 se quita el size-adjust del respaldo de fuente', R(M, ' size-adjust: 68%;', '')],
  ['M6 se quita la fuente de reserva de la pila del título', R(M, "'Barlow Condensed', 'Barlow Condensed Fallback', 'Arial Narrow'", "'Barlow Condensed', 'Arial Narrow'")],
  ['M7 se quita el @font-face de respaldo', R(M, "@font-face { font-family: 'Barlow Condensed Fallback';", "@font-face-x { font-family: 'Barlow Condensed Fallback';")],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
