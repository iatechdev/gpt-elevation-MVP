// Mutaciones de #392 sobre la copia tools/qa5/pr392 (cabeza fusionada, solo local). Uso: node qa5-mut392.cjs MA..MG
const fs = require('fs'); const D = (process.env.QA_TOOLS || '.') + '/qa5/pr392/frontend/src/'; const LP = D + 'pages/LoginPage.tsx'; const SN = D + 'access/sessionNotice.ts'
const muts = {
  MA: [LP, s => s.replace('if (!isRegistering) return <Navigate to={destination} replace />', 'if (!isRegistering && destination === null) return <Navigate to={destination} replace />')],                       // «Entrar» con sesión ya no redirige
  MB: [LP, s => s.replace('void signOut(BACKEND).then(() => setSignedOutHere(true))', 'void Promise.resolve(signOut).then(() => setSignedOutHere(true))')], // logout omitido
  MC: [LP, s => s.replace('nameInput.current?.focus() }, [signedOutHere', 'void 0 }, [signedOutHere')],                    // sin foco en el primer campo
  MD: [LP, s => s.replace('<Link className="ac-ghost" to={destination}>', '<Link className="ac-ghost" to="/">')],         // «Seguir» a otro destino
  ME: [SN, s => s.replace("() => name", "name")],                                                                           // reemplazo con cadena ($& interpretado)
  MF: [LP, s => s.replace('<p>{shownName ?', '<form data-mut="1"><input aria-label="x"/></form><p>{shownName ?')],         // formulario dibujado dentro del aviso
  MG: [LP, s => s.replace('.then(() => setSignedOutHere(true)).finally(() => setLeaving(false))', '.then(() => setSignedOutHere(true))')], // «ocupado» no se limpia
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
