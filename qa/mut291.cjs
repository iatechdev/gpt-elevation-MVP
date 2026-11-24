// QA-Claude-2 — ES-153 paso 2 (PR #291): mutaciones en MI clon (t2) para comprobar que las pruebas movidas siguen detectando la pérdida de destinos.
// Uso: node qa/mut291.cjs <ruta del clon>/frontend   (restaura con git checkout -- src después de cada mutación)
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const W = (f, fn) => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); const n = fn(s); if (n === s) throw new Error('mutación sin efecto en ' + f); fs.writeFileSync(p, n) }
const MUT = [
  ['M1 quitar /app/bridge del menú del marco', () => W('src/shell/nav.ts', s => s.replace("  { to: '/app/bridge', label: 'bridge' },\n", ''))],
  ['M2 quitar /app/data del menú del marco', () => W('src/shell/nav.ts', s => s.replace("  { to: '/app/data', label: 'data' },\n", ''))],
  ['M3 quitar /app/plan del menú del marco', () => W('src/shell/nav.ts', s => s.replace(/  \{ to: '\/app\/plan'[^\n]*\n/, ''))],
  ['M4 quitar el manifiesto del menú de la persona', () => W('src/shell/nav.ts', s => s.replace("  { to: '/manifiesto', label: 'adManifest' }, // ES-207\n]", ']'))],
  ['M5 duplicar el mapa en el menú', () => W('src/shell/nav.ts', s => s.replace("  { to: '/app/checkin', label: 'today' },", "  { to: '/app/skill-map', label: 'map' },\n  { to: '/app/checkin', label: 'today' },"))],
  ['M6 «Ejercicios» sin from=dashboard', () => W('src/space/SpaceToolsPage.tsx', s => s.replace("to: '/app/exercises?from=dashboard'", "to: '/app/exercises'"))],
  ['M7 recrear SpaceNav.tsx', () => fs.writeFileSync(path.join(FE, 'src/space/SpaceNav.tsx'), 'export function SpaceNav() { return null }\n')],
  ['M8 quitar /app/space/tools del menú del marco', () => W('src/shell/nav.ts', s => s.replace("  { to: '/app/space/tools', label: 'tools' },\n", ''))],
]
for (const [name, fn] of MUT) {
  sh('git checkout -- src'); sh('git clean -fq src/space/SpaceNav.tsx')
  try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,90})/gm)].map(m => m[1]).slice(0, 3)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : ''))
}
sh('git checkout -- src'); sh('git clean -fq src/space/SpaceNav.tsx'); console.log('restaurado')
