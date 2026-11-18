// QA-Claude-2 — PR #332 (ES-329 Siguiente paso) mutaciones sobre el clon: node qa/mut332.cjs <clon>. Corre las pruebas del frontend que cubren la pantalla (es-206, es-153*, career-*, es-237, es-329).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const ROOT = process.argv[2]; const P = f => path.join(ROOT, f)
const TESTS = 'test/es-206-pulido.test.mjs test/es-153-leave-guard.test.mjs test/es-153-persona-layout.test.mjs test/es-153-shell.test.mjs test/career-preview.test.mjs test/career-reason.test.mjs test/es-237-api-career.test.mjs test/es-329-checkin-teclado.test.mjs'
const run = () => { try { execSync(process.env.FULL === '1' ? 'node --test test/*.test.mjs 2>&1' : `node --test ${TESTS} 2>&1`, { cwd: P('frontend'), stdio: 'pipe', timeout: 240000, shell: true }); return false } catch (e) { return true } }
const files = ['frontend/src/career/CareerShell.tsx', 'frontend/src/career/CareerPages.tsx', 'frontend/src/shell/personLayoutState.ts', 'frontend/src/cartografia/pages.css']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA «${a.slice(0, 50)}»`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
const SH = 'frontend/src/career/CareerShell.tsx', PG = 'frontend/src/career/CareerPages.tsx'
M('a se quita aria-current de la subnavegación', SH, "aria-current={location.pathname === to ? 'page' : undefined}", '')
M('b no se mueve el foco a career-main al cambiar de ruta', SH, "document.getElementById('career-main')?.focus();", '')
M('c no se registra la guarda de salida (registerLeaveGuard no hace nada)', SH, "import { registerLeaveGuard } from '../shell/leaveGuard'", 'const registerLeaveGuard = (_f: unknown) => () => {}')
M('d el botón deshabilitado pierde aria-describedby', PG, 'aria-describedby={key ? id : undefined} onClick={onClick}', 'onClick={onClick}')
M('e «Sí, descartar» deja de ser de peligro', PG, '<Button danger disabled={blocked} onClick={() => void act(\'discard\', part)}>', '<Button disabled={blocked} onClick={() => void act(\'discard\', part)}>')
M('f /app/next-step sale de MIGRATED_PERSON_PATHS', 'frontend/src/shell/personLayoutState.ts', ", '/app/next-step']", ']')
M('g se quita el rótulo de vista previa con datos sintéticos', SH, "<Banner title={t('preview')} />", '')
M('h la subnavegación pierde su alto táctil', 'frontend/src/cartografia/pages.css', 'min-height: var(--cg-touch)', 'min-height: 20px')
restore(); console.log('clon restaurado')
