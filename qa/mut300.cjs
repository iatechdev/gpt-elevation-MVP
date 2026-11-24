// QA-Claude-2 — ES-321 (PR #300): mutaciones en MI clon (t2). Uso: node qa/mut300.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 60)); fs.writeFileSync(p, s.split(a).join(b)) }
const MUT = [
  ['M1 siempre el orden de escritorio (nunca estrecho)', R('src/shell/Frame.tsx', 'useNarrowHeader() && mobileOrder', 'false')],
  ['M2 siempre el orden móvil', R('src/shell/Frame.tsx', 'useNarrowHeader() && mobileOrder', 'mobileOrder')],
  ['M3 el corte pasa de 900 a 600 px', R('src/shell/narrowHeader.ts', '(max-width: 900px)', '(max-width: 600px)')],
  ['M4 el marco de persona deja de pedir el orden móvil', R('src/shell/frames.tsx', 'mobileOrder', 'mobileOrderOff')],
  ['M5 se invierten menú y preferencias en el orden móvil', R('src/shell/Frame.tsx', '<div className="cg-header__end">{account}{preferences ?? <LangSwitch />}</div>', '<div className="cg-header__end">{preferences ?? <LangSwitch />}{account}</div>')],
  ['M6 la lectura de matchMedia deja de ser síncrona (siempre false al montar)', R('src/shell/narrowHeader.ts', 'const read = () => supported() && window.matchMedia(NARROW_HEADER_QUERY).matches', 'const read = () => false')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
