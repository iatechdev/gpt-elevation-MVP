// QA-Claude-2 — PR #310 (ES-308 PR 2/3) mutaciones sobre el clon: node qa/mut310.cjs <clon>/frontend. Corre las pruebas de evidencias, diálogos, preferencias y layout.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-110-skills.test.mjs test/es-164-evidencias.test.mjs test/es-235-evidencias-teclado.test.mjs test/es-236-dialogos-teclado.test.mjs test/es-153-persona-layout.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 180000 }); return false } catch (e) { return true } }
const files = ['src/shell/personLayoutState.ts', 'src/pages/EvidencePages.tsx', 'src/cartografia/cartografia.css', 'src/evidence/FormFields.tsx']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 sacar /app/evidence de MIGRATED_PERSON_PATHS', 'src/shell/personLayoutState.ts', ", '/app/evidence']", ']')
M('M2 la casilla vuelve a 1,4 rem sin mínimo de 24 px', 'src/cartografia/cartografia.css', 'width: 1.5rem; height: 1.5rem; min-width: 24px; min-height: 24px;', 'width: 1.4rem; height: 1.4rem;')
M('M3 quitar solo el mínimo de 24 px (queda 1,5 rem = 24 px)', 'src/cartografia/cartografia.css', ' min-width: 24px; min-height: 24px;', '')
M('M4 Esc no cierra el diálogo de borrar', 'src/pages/EvidencePages.tsx', 'onClose={cancel}', 'onClose={() => {}}')
M('M5 cancelar durante el borrado (ignora busy)', 'src/pages/EvidencePages.tsx', 'const cancel = () => { if (busy) return; setConfirmId(null) }', 'const cancel = () => { setConfirmId(null) }')
M('M6 «Ver todas» ya no devuelve el foco al radio «Todas»', 'src/pages/EvidencePages.tsx', "setFilter('all'); setFocusAll(true)", "setFilter('all')")
M("M7 el reintento REGENERA el requestId (duplicaría la evidencia)", "src/pages/EvidencePages.tsx", "setPending({ body: attempt.body, ...(ack ? { ack } : {}) }); setPhase('uncertain')", "setPending({ body: { ...attempt.body, requestId: crypto.randomUUID() }, ...(ack ? { ack } : {}) }); setPhase('uncertain')")
restore(); console.log('clon restaurado')
