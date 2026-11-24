// QA-Claude-2 — ES-309 PR 1/2 (PR #292): mutaciones en MI clon (t2). Uso: node qa/mut292.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 50)); fs.writeFileSync(p, s.split(a).join(b)) }
const P = 'src/pages/therapist/'
const MUT = [
  ['M1 mostrar cifras de quien no comparte (noAccess=false)', R(P + 'PanelSections.tsx', 'const noAccess = p.sharing === false', 'const noAccess = false')],
  ['M2 quitar el panel de las rutas migradas', R('src/shell/professionalLayoutState.ts', "['/therapist/dashboard']", '[]')],
  ['M3 quitar role=alert del error del bloque', R(P + 'PanelSections.tsx', '<div role="alert" className="tp-state">', '<div className="tp-state">')],
  ['M4 quitar form= del envío de la guía', R(P + 'GuideBlock.tsx', ' form="panel-guide-form"', '')],
  ['M5 cerrar el diálogo de la guía no hace nada (Esc)', R(P + 'GuideBlock.tsx', 'onClose={close}', 'onClose={() => {}}')],
  ['M6 color fijo en línea en la guía', R(P + 'GuideBlock.tsx', '<p className="tp-strong">', '<p className="tp-strong" style={{ color: "#123456" }}>')],
  ['M7 el foco no vuelve al título tras Reintentar', R(P + 'PanelSections.tsx', 'heading.current?.focus()', 'void 0')],
  ['M8 la etiqueta de la subida deja de asociarse', R(P + 'ValidationBlock.tsx', 'panel-val-file', 'panel-val-fil2')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
