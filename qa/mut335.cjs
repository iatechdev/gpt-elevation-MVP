// QA-Claude-2 — PR #335 (ES-329 E311-1/E311-2) mutaciones sobre el clon: node qa/mut335.cjs <clon>/frontend. M1–M5 = las de #311 (sobrevivían en main); N1–N8 = nuevas del propósito de las pruebas. Suite completa por mutante.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/*.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8 }); return false } catch (e) { return true } }
const files = ['src/shell/personLayoutState.ts', 'src/space/PersonScreen.tsx', 'src/routeCatalog/PersonCatalog.tsx', 'src/progress/progress.css', 'src/pages/UserProgress.tsx', 'src/pilot/FeedbackPage.tsx', 'src/facilitation/PersonReviews.tsx']
const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
const L = 'src/shell/personLayoutState.ts'
M('M1 sacar /app/progress de MIGRATED_PERSON_PATHS', L, "'/app/progress', ", '')
M('M2 sacar /app/route-catalog de MIGRATED_PERSON_PATHS', L, ", '/app/route-catalog'", '')
M('M3 PersonScreen sin titleRef en el h1', 'src/space/PersonScreen.tsx', ' ref={titleRef} tabIndex={titleRef ? -1 : undefined}', '')
M('M4 el detalle de rol del catálogo ya no enfoca el título', 'src/routeCatalog/PersonCatalog.tsx', 'useEffect(() => { if (role) titleRef.current?.focus() }', 'useEffect(() => { if (false) titleRef.current?.focus() }')
M('M5 progreso vuelve a fijar el alto de pantalla (min-height 100dvh)', 'src/progress/progress.css', '.prg { min-width: 0; }', '.prg { min-height: 100dvh; padding: 0 var(--cg-s4); }')
M('N1 sacar /app/feedback de MIGRATED_PERSON_PATHS', L, "'/app/feedback', ", '')
M('N2 sacar /app/professional-reviews de MIGRATED_PERSON_PATHS', L, "'/app/professional-reviews', ", '')
M('N3 progreso deja de usar PersonScreen', 'src/pages/UserProgress.tsx', '<PersonScreen', '<PersonScreenX')
M('N4 opinión deja de usar PersonScreen', 'src/pilot/FeedbackPage.tsx', '<PersonScreen', '<PersonScreenX')
M('N5 revisiones dejan de usar PersonScreen', 'src/facilitation/PersonReviews.tsx', '<PersonScreen', '<PersonScreenX')
M('N6 reaparece una cabecera propia en progreso (<header>)', 'src/pages/UserProgress.tsx', '<PersonScreen', "{false && <header>x</header>}<PersonScreen")
M('N7 reaparece «Volver» en revisiones', 'src/facilitation/PersonReviews.tsx', '<PersonScreen', "{false && <a href=\"/app/dashboard\">Volver</a>}<PersonScreen")
M('N8 reaparece LangSwitch en opinión', 'src/pilot/FeedbackPage.tsx', '<PersonScreen', '{false && <LangSwitch />}<PersonScreen')
M('N9 el catálogo pierde el efecto de E311-1 (foco al título tras Reintentar)', 'src/routeCatalog/PersonCatalog.tsx', 'useEffect(() => { if (attempt > 0 && !status && catalog && !roleKey) titleRef.current?.focus() }, [attempt, status, catalog, roleKey])', '')
M('N10 el catálogo vuelve a pasar titleRef solo en el detalle', 'src/routeCatalog/PersonCatalog.tsx', 'titleRef={titleRef}>', 'titleRef={role ? titleRef : undefined}>')
restore(); console.log('clon restaurado')
