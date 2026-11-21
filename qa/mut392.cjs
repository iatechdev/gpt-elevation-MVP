// [QA-Claude-3] Mutaciones de #392: `npm test` del frontend sobre wt (main + #392); revierte cada mutación.
const fs = require('fs'), cp = require('child_process'), path = require('path')
const W = (process.env.QA3_DIR || 'C:/Users/Usuario/tools/qa3') + '/wt/frontend'; const F = path.join(W, 'src/pages/LoginPage.tsx')
const M = [
  ['M1 «Entrar» con sesión deja de redirigir (muestra el aviso)', s => s.replace('if (!isRegistering) return <Navigate to={destination} replace />', '')],
  ['M2 «Crear cuenta» con sesión vuelve a redirigir', s => s.replace('if (!isRegistering) return <Navigate', 'if (true) return <Navigate')],
  ['M3 cerrar sesión no llama a signOut', s => s.replace('void signOut(BACKEND).then(', 'void Promise.resolve().then(')],
  ['M4 el foco no pasa al primer campo', s => s.replace('nameInput.current?.focus() }, [signedOutHere', 'void 0 }, [signedOutHere')],
  ['M5 «Seguir» lleva a «/»', s => s.replace('<Link className="ac-ghost" to={destination}>', '<Link className="ac-ghost" to="/">')],
  ['M6 el nombre ya no se recorta a 80', s => s.replace('.trim().slice(0, 80)', '.trim()')],
  ['M7 el botón no se bloquea mientras sale', s => s.replace('disabled={leaving} ', '')],
]
const run = () => { const r = cp.spawnSync('npm', ['test'], { cwd: W, encoding: 'utf8', shell: true }); const o = (r.stdout || '') + (r.stderr || ''); const m = k => (o.match(new RegExp('# ' + k + ' (\\d+)')) || [])[1]; return { pass: m('pass'), fail: m('fail') } }
const orig = fs.readFileSync(F, 'utf8'); { const c = run(); console.log('CONTROL pass=' + c.pass + ' fail=' + c.fail) }
for (const [name, fn] of M) { const mut = fn(orig); if (mut === orig) { console.log('SIN EFECTO:', name); continue } fs.writeFileSync(F, mut); const r = run(); fs.writeFileSync(F, orig); console.log(`${Number(r.fail) > 0 ? 'DETECTADA' : 'NO DETECTADA'} | ${name} | pass=${r.pass} fail=${r.fail}`) }
fs.writeFileSync(F, orig)
