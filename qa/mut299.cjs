// QA-Claude-2 — ES-322 (PR #299): mutaciones en MI clon (t2). Uso: node qa/mut299.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 60)); fs.writeFileSync(p, s.split(a).join(b)) }
const G = 'src/skill-map/radarGeometry.ts', C = 'src/skill-map/radarPolygon.css'
const MUT = [
  ['M1 NAMED_MIN_VIEWPORT baja a 800', R(G, 'NAMED_MIN_VIEWPORT = 1130', 'NAMED_MIN_VIEWPORT = 800')],
  ['M2 fitsNamed siempre verdadero', R(G, 'export const fitsNamed = (viewport: number) => viewport >= NAMED_MIN_VIEWPORT', 'export const fitsNamed = (viewport: number) => true')],
  ['M3 se vuelve a overflow-wrap: anywhere', R(C, 'overflow-wrap: break-word; hyphens: manual', 'overflow-wrap: anywhere')],
  ['M4 radarMode sin la rama fitsNamed', R(G, "(fitsNamed(viewport) ? 'named' : 'marks')", "'named'")],
  ['M5 se quita hyphens: manual', R(C, ' hyphens: manual;', '')],
  ['M6 ancho máximo del eje 26 % → 40 %', R(C, 'max-width: 26%', 'max-width: 40%')],
  ['M7 el umbral sube a 1 400 (nunca nombres)', R(G, 'NAMED_MIN_VIEWPORT = 1130', 'NAMED_MIN_VIEWPORT = 1400')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
