// [QA-Claude-3] Mutaciones de #349 contra el script de integración del PR (scripts/es237-api-integration.cjs: servidor real + PostgreSQL real, 77 comprobaciones). Solo las que `npm test` no detecta.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'
const rd = f => fs.readFileSync(path.join(W, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(W, f), s)
const SC = 'src/career/serverClient.ts', API = 'src/career/api.ts'
const M = [
  ['M1 el gesto incierto no conserva su requestId', SC, s => s.replace('frozen.set(key, run)', 'void 0')],
  ['M2 las restricciones se envían siempre con baseVersion 0', SC, s => s.replace('const v = input.value, baseVersion = state.basis', 'const v = input.value, baseVersion = 0')],
  ['M3 un 5xx/corte en una escritura se trata como éxito', SC, s => s.replace("const mapped = toScreenError(error, kind); if (!(mapped instanceof FixtureError && mapped.code === 'lostAck')) frozen.delete(key); throw mapped", 'frozen.delete(key); return undefined')],
  ['M4 cancelar a mitad del cuerpo vuelve a ser «unavailable» (E336-1)', API, s => s.replace('if (signal?.aborted) throw error', '')],
  ['M7 el 401 deja de verse como sesión vencida', SC, s => s.replace("if (error.kind === 'expired') return new FixtureError('expired')", '')],
  ['M8 la elección con la base cambiada ya no avisa «tus restricciones cambiaron»', SC, s => s.replace("if (kind === 'choose' && (error.kind === 'conflict' || error.code === 'route_not_proposed')) return new FixtureError('routesChanged')", '')],
  ['M10 los experimentos usan expectedVersion 0 en vez del real', SC, s => s.replace("run: change(e.id, input.expected, requestId, { action: 'start' })", "run: change(e.id, 0, requestId, { action: 'start' })")],
]
const run = () => { const r = cp.spawnSync('node', ['scripts/es237-api-integration.cjs'], { cwd: W, encoding: 'utf8', env: { ...process.env, ES237_BACKEND_DIR: '../backend', NODE_PATH: '../backend/node_modules' }, timeout: 280000 }); const o = (r.stdout || '') + (r.stderr || ''); const ok = (o.match(/(\d+) comprobaciones OK/) || [])[1]; const bad = o.split(String.fromCharCode(10)).filter(l => /^(FAIL|FALLA)|AssertionError|Error:/.test(l)).slice(0, 2).map(l => l.slice(0, 110)); return { ok: ok || '0', status: r.status, bad } }
{ const c = run(); console.log('CONTROL sin mutar: comprobaciones=' + c.ok + ' salida=' + c.status) }
for (const [name, file, fn] of M) {
  const orig = rd(file); const mut = fn(orig)
  if (mut === orig) { console.log('SIN EFECTO (no aplicó):', name); continue }
  wr(file, mut); const r = run(); wr(file, orig)
  console.log(`${r.status !== 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | comprobaciones=${r.ok} salida=${r.status} ${r.bad.join(' ; ')}`)
}
