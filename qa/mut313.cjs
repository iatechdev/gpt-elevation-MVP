// QA-Claude-2 — PR #313 (ES-327) mutaciones sobre el clon: node qa/mut313.cjs <clon>/frontend. Corre las pruebas del área; los sobrevivientes se miden en navegador sobre un build mutado.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-327-borrado-releer.test.mjs test/es-248-hojas-consentimiento.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 120000 }); return false } catch (e) { return true } }
const files = ['src/context/resume/ResumesPage.tsx', 'src/context/resume/resumeApi.ts']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 tratar 404 como rechazo definitivo', 'src/context/resume/resumeApi.ts', "response.status >= 500 || response.status === 404 ? 'uncertain'", "response.status >= 500 ? 'uncertain'")
M('M2 tratar 5xx como rechazo definitivo', 'src/context/resume/resumeApi.ts', "response.status >= 500 || response.status === 404 ? 'uncertain'", "response.status === 404 ? 'uncertain'")
M('M3 el corte de red declara rechazo (no incierto)', 'src/context/resume/resumeApi.ts', "catch { return 'uncertain' }", "catch { return 'rejected' }")
M('M4 quitar el tiempo agotado de 15 s', 'src/context/resume/resumeApi.ts', ", signal: AbortSignal.timeout(15000)", "")
M('M5 incierto declara éxito sin releer', 'src/context/resume/ResumesPage.tsx', "setPhase('loading'); const fresh = await listResumes(); setBusy(false); setConfirm(null)", "setBusy(false); setConfirm(null); setMessage(t('resume_deleted_live')); await load(); return")
M('M6 releer también tras un rechazo 403', 'src/context/resume/ResumesPage.tsx', "if (result === 'rejected') { setBusy(false); setAlert(t('resume_delete_error')); return }", "if (false) { return }")
M('M7 si no se puede releer, afirmar éxito', 'src/context/resume/ResumesPage.tsx', "if (!fresh) { apply(null, consent); return }", "if (!fresh) { setMessage(t('resume_deleted_live')); return }")
M('M8 decir «borrada» aunque la versión siga en la lista', 'src/context/resume/ResumesPage.tsx', "if (fresh.resumes.some(row => row.id === item.id)) setAlert(t('resume_delete_error')); else setMessage(t('resume_deleted_live'))", "setMessage(t('resume_deleted_live'))")
M('M9 decir «no pudimos borrar» aunque ya no esté', 'src/context/resume/ResumesPage.tsx', "if (fresh.resumes.some(row => row.id === item.id)) setAlert(t('resume_delete_error')); else setMessage(t('resume_deleted_live'))", "setAlert(t('resume_delete_error'))")
restore(); console.log('clon restaurado')
