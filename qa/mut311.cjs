// QA-Claude-2 — PR #311 (ES-329 a) mutaciones sobre el clon: node qa/mut311.cjs <clon>/frontend. Corre la suite completa (npm test) por mutante.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/*.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8 }); return false } catch (e) { return true } }
const files = ['src/shell/personLayoutState.ts', 'src/space/PersonScreen.tsx', 'src/routeCatalog/PersonCatalog.tsx', 'src/progress/progress.css', 'src/pages/UserProgress.tsx']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 sacar /app/progress de MIGRATED_PERSON_PATHS', 'src/shell/personLayoutState.ts', "'/app/progress', ", '')
M('M2 sacar /app/route-catalog de MIGRATED_PERSON_PATHS', 'src/shell/personLayoutState.ts', ", '/app/route-catalog'", '')
M('M3 PersonScreen sin titleRef en el h1', 'src/space/PersonScreen.tsx', ' ref={titleRef} tabIndex={titleRef ? -1 : undefined}', '')
M('M4 el detalle de rol del catálogo ya no enfoca el título', 'src/routeCatalog/PersonCatalog.tsx', 'useEffect(() => { if (role) titleRef.current?.focus() }', 'useEffect(() => { if (false) titleRef.current?.focus() }')
M('M5 progreso vuelve a fijar el alto de pantalla (min-height 100dvh)', 'src/progress/progress.css', '.prg { min-width: 0; }', '.prg { min-height: 100dvh; padding: 0 var(--cg-s4); }')
restore(); console.log('clon restaurado')
