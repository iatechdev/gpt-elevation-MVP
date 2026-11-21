// [QA-Claude-3] Mutaciones de #386 (solo qa/): `npm test` del frontend sobre el worktree con main + #386 fusionados; revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const SK = 'src/skill-catalog/SkillCatalogPages.tsx', PC = 'src/cartografia/pieces.tsx'
const M = [
  ['M1 P361-2: la guarda vuelve a preguntar con target=_blank y download', SK, s => s.replace("if ((link.getAttribute('target') && link.getAttribute('target') !== '_self') || link.hasAttribute('download')) return", '')],
  ['M2 P361-3: la columna de versiones pierde hidden (encabezado visible)', SK, s => s.replace("{ key: 'open', header: t('skcat.view'), hidden: true,", "{ key: 'open', header: t('skcat.view'),")],
  ['M3 P361-3: la columna de habilidades pierde hidden', SK, s => s.replace("{ key: 'edit', header: t('skcat.edit'), hidden: true,", "{ key: 'edit', header: t('skcat.edit'),")],
  ['M4 P361-4: la tabla de habilidades vuelve al caption del catálogo', SK, s => s.replace("caption={`${t('skcat.version')} ${detail.version}`}", "caption={t('skcat.title')}")],
  ['M5 P361-5: una etiqueta incompleta vuelve a marcarse como error (aria-invalid)', SK, s => s.replace("error={bad ? t('skcat.err_label') : undefined} hint={bad ? undefined : req(value)}", "error={bad ? t('skcat.err_label') : req(value)}")],
  ['M6 DataTable: `hidden` se ignora (el encabezado siempre visible)', PC, s => s.replace('{column.hidden ? <span className="cg-sr">{column.header}</span> : column.header}', '{column.header}')],
  ['M7 DataTable: por defecto las columnas pasan a estar ocultas (rompe las demás tablas)', PC, s => s.replace('{column.hidden ? <span', '{!column.hidden ? <span')],
  ['M8 P361-5: un error real (fecha inválida) deja de marcarse', SK, s => s.replace("error={fieldErrors.verified_at ? t('skcat.err_date') : undefined}", 'error={undefined}')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
