// QA-Claude-2 — ES-309 PR 2/2 (PR #298): mutaciones en MI clon (t2). Uso: node qa/mut298.cjs <clon>/frontend. Restaura con git checkout -- src.
const fs = require('fs'), path = require('path'), cp = require('child_process')
const FE = process.argv[2]; const sh = c => cp.spawnSync(c, { cwd: FE, shell: true, encoding: 'utf8' })
const R = (f, a, b) => () => { const p = path.join(FE, f); const s = fs.readFileSync(p, 'utf8'); if (!s.includes(a)) throw new Error('no encuentra: ' + a.slice(0, 60)); fs.writeFileSync(p, s.split(a).join(b)) }
const P = 'src/pages/therapist/'
const MUT = [
  ['M1 sin consentimiento ya no muestra su mensaje propio (cae al error de carga)', R(P + 'TherapistPatient.tsx', "if (body.code === 'consent_required') { setNotShared(true); return }", 'void 0')],
  ['M2 la ficha sale de las rutas migradas', R('src/shell/professionalLayoutState.ts', "['/therapist/dashboard', '/therapist/patient']", "['/therapist/dashboard']")],
  ['M3 el aviso de la nota pierde role=alert', R(P + 'FollowupNotes.tsx', '<div id="fu-problem" role="alert"', '<div id="fu-problem"')],
  ['M4 el envío de la nota pierde form=', R(P + 'FollowupNotes.tsx', ' form="fu-form"', '')],
  ['M5 cerrar el diálogo de la nota no hace nada (Esc)', R(P + 'FollowupNotes.tsx', 'onClose={closeDialog}', 'onClose={() => {}}')],
  ['M6 color fijo en línea en el resumen con IA', R(P + 'AiSummaryBlock.tsx', '<h2 id="fu-ai-title">', '<h2 id="fu-ai-title" style={{ color: "#123456" }}>')],
  ['M7 se pierde el 409 «la nota cambió»', R(P + 'FollowupNotes.tsx', "res.status === 409 && body.code === 'note_changed' && body.current", 'false')],
  ['M8 el envío de agendar pierde form=', R(P + 'ScheduleSession.tsx', ' form="fu-sch-form"', '')],
  ['M9 la fecha de agendar ya no valida el mínimo', R(P + 'ScheduleSession.tsx', 'min={earliest()}', '')],
]
for (const [name, fn] of MUT) { sh('git checkout -- src'); try { fn() } catch (e) { console.log('ERROR ' + name + ' ' + e.message); continue }
  const r = sh('npm test 2>&1'); const fail = (r.stdout.match(/# fail (\d+)/) || [])[1]; const names = [...r.stdout.matchAll(/^not ok \d+ - (.{0,80})/gm)].map(m => m[1]).slice(0, 2)
  console.log((+fail > 0 ? 'DETECTADA ' : 'SOBREVIVE  ') + name + ' | fallan ' + fail + (names.length ? ' | ' + names.join(' ; ') : '')) }
sh('git checkout -- src'); console.log('restaurado')
