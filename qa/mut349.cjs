// [QA-Claude-3] Mutaciones de #349 (solo qa/): `npm test` del frontend sobre el worktree con main + #349 fusionados; revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const SC = 'src/career/serverClient.ts', AD = 'src/career/adapter.ts', API = 'src/career/api.ts', CP = 'src/career/CareerPages.tsx'
const M = [
  ['M1 el gesto incierto no conserva su requestId (se genera otro al reintentar)', SC, s => s.replace('frozen.set(key, run)', 'void 0')],
  ['M2 las restricciones se envían siempre con baseVersion 0', SC, s => s.replace('const v = input.value, baseVersion = state.basis', 'const v = input.value, baseVersion = 0')],
  ['M3 un 5xx/corte se trata como éxito (se traga el error de la escritura)', SC, s => s.replace('const mapped = toScreenError(error, kind); if (!(mapped instanceof FixtureError && mapped.code === \'lostAck\')) frozen.delete(key); throw mapped', 'frozen.delete(key); return undefined')],
  ['M4 cancelar a mitad del cuerpo vuelve a ser «unavailable» (E336-1)', API, s => s.replace('if (signal?.aborted) throw error', '')],
  ['M5 el chip «sintética» aparece en toda ruta', AD, s => s.replace('synthetic: route.synthetic === true || sources.some(s => s.synthetic)', 'synthetic: true')],
  ['M6 el chip «sintética» de contexto aparece siempre', AD, s => s.replace('synthetic: c.synthetic === true', 'synthetic: true')],
  ['M7 el 401 deja de verse como sesión vencida', SC, s => s.replace("if (error.kind === 'expired') return new FixtureError('expired')", '')],
  ['M8 la elección con la base cambiada ya no avisa «tus restricciones cambiaron»', SC, s => s.replace("if (kind === 'choose' && (error.kind === 'conflict' || error.code === 'route_not_proposed')) return new FixtureError('routesChanged')", '')],
  ['M9 el plan simula en modo servidor (ya no responde «pendiente»)', SC, s => s.replace("default: throw new FixtureError('pending')", "default: return { kind: 'write', run: async () => undefined }")],
  ['M10 los experimentos usan expectedVersion 0 en vez del real', SC, s => s.replace("return { kind: 'write', run: change(e.id, input.expected, requestId, { action: 'start' }) }", "return { kind: 'write', run: change(e.id, 0, requestId, { action: 'start' }) }")],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail'), names: [...o.matchAll(/^not ok \d+ - (.{0,90})/gm)].map(x => x[1]).slice(0, 2) } }
{ const c = run(); console.log('CONTROL sin mutar: pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail} ${r.names.join(' ; ')}`)
}
