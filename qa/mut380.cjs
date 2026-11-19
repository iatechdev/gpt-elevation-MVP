// [QA-Claude-3] Mutaciones de #380 (solo qa/): `npm test` del frontend sobre el worktree con main + #380 fusionados; revierte cada mutación. MUT=<n> aplica solo esa y la deja puesta (para construir un build mutado).
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const AC = 'src/pages/admin/AdminContent.tsx', LC = 'src/pages/admin/LandingConflict.tsx', AM = 'src/i18n/adminCopy.ts'
const M = [
  ['M1 el PUT ya no envía expectedUpdatedAt', AC, s => s.replace('value, expectedUpdatedAt: sent }', 'value }')],
  ['M2 «Conservar la mía» reenvía siempre con null en vez de la versión vigente', AC, s => s.replace("saveField(key, value, conflicts[key]?.current?.updatedAt ?? null)", 'saveField(key, value, null)')],
  ['M3 «Usar la suya» también guarda', AC, s => s.replace("setMsgs(m => ({ ...m, [key]: '' }))\n    focusField(key)\n  }, [conflicts])", "setMsgs(m => ({ ...m, [key]: '' }))\n    void saveField(key, theirs.value)\n    focusField(key)\n  }, [conflicts])")],
  ['M4 el conflicto es global (la primera fila en conflicto pinta todas)', AC, s => s.replace('conflict={conflicts[f.key] ?? null}', 'conflict={Object.values(conflicts)[0] ?? null}')],
  ['M5 el campo ya no marca aria-invalid', AC, s => s.replace('aria-invalid={conflict ? true : undefined} ', '')],
  ['M6 no se renueva la versión tras guardar', AC, s => s.replace('if (outcome.updatedAt) versionsRef.current = { ...versionsRef.current, [key]: outcome.updatedAt }', '')],
  ['M7 el conflicto remonta la fila y se pierde lo escrito', AC, s => s.replace('<LandingRow key={f.key} fieldKey', "<LandingRow key={f.key + (conflicts[f.key] ? 'x' : '')} fieldKey")],
  ['M8 el aviso deja de ser de error (sin role=alert)', LC, s => s.replace('<Banner kind="error"', '<Banner kind="note"')],
  ['M9 el texto EN «Keep mine» cambia', AM, s => s.replace("'Conservar la mía': 'Keep mine'", "'Conservar la mía': 'Keep my own'")],
  ['M10 un fallo de /versions se ignora (se edita sin versión)', AC, s => s.replace("if (!v.ok) throw new Error('versions'); ", '')],
  ['M11 el aviso no recibe el foco al aparecer', LC, s => s.replace("box.current?.querySelector('button')?.focus()", 'void 0')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
if (process.env.MUT) { const [name, file, fn] = M[+process.env.MUT - 1]; const orig = rd(file); const mut = fn(orig); if (mut === orig) { console.log('SIN EFECTO', name); process.exit(2) } wr(file, mut); console.log('APLICADA', name); process.exit(0) }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
