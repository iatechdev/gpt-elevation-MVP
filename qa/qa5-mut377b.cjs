// Mutaciones del comportamiento nuevo de #377 (cabeza 1e609cd9…) sobre tools/qa5/pr377. Uso: node qa5-mut377b.cjs W1..W5
const fs = require('fs'); const F = (process.env.QA_TOOLS || '.') + '/qa5/pr377/frontend/src/career/CareerPages.tsx'
const muts = {
  W1: s => s.replace("    onPending(waiting())\n", ""),                                                        // sin plan en espera: vuelve el salto
  W2: s => s.replace("if (result.ok) { setReview(false); setSelected([]); onAccepted() } else onPending(null)", "if (result.ok) { setReview(false); setSelected([]); onAccepted() }"), // rechazo: el plan en espera queda
  W3: s => s.replace("<div hidden={waiting !== null}><PlanProposal", "<div><PlanProposal"),               // la propuesta no se oculta
  W4: s => s.replace("onAccepted={() => { setWaiting(null); setProposal(false); setSelectedId('') }}", "onAccepted={() => { setProposal(false); setSelectedId('') }}"), // el plan en espera no se retira al aceptar
  W6: s => s.replace("<h3>{waiting ? c.t('saving') : `${c.t(plan.status)} · ${c.t('version')} ${plan.version}`}</h3>", "<h3>{`${c.t(plan.status)} · ${c.t('version')} ${plan.version}`}</h3>"),
  W7: s => s.replace("p === waiting ? c.t('saving') : ", ""),
  W5: s => s.replace("aria-busy={waiting !== null}", "aria-busy={false}"),                                    // sin aria-busy
}
const f = muts[process.argv[2]]; const a = fs.readFileSync(F, 'utf8').split('\r\n').join('\n'); const b = f(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(F, b)
