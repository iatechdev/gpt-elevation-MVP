// QA-Claude-2 — PR #320 (ES-333 PR 3/3) mutaciones sobre el clon: node qa/mut320.cjs <clon>/frontend. Corre las pruebas es-123 y es-153 (las que toca el PR).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-123-chat-layout.test.mjs test/es-153-persona-layout.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 180000, shell: true }); return false } catch (e) { return true } }
const files = ['src/pages/ChatPage.tsx', 'src/i18n/es.ts', 'src/i18n/en.ts']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 «Administración» visible para todos (sin comprobar el rol)', 'src/pages/ChatPage.tsx', "['admin', 'superadmin'].includes(role) ? () =>", "true ? () =>")
M('M2 «Administración» ya no respeta canLeave()', 'src/pages/ChatPage.tsx', 'if (chat.canLeave()) navigate', 'navigate')
M('M3 «Administración» navega a otra ruta (/admin/users)', 'src/pages/ChatPage.tsx', "navigate('/admin/dashboard')", "navigate('/admin/users')")
M('M4 vuelve una llamada de administración al chat', 'src/pages/ChatPage.tsx', "const navigate = useNavigate()", "const navigate = useNavigate(); void fetch('/api/admin/prompt/x')")
M('M5 vuelve un estilo en línea', 'src/pages/ChatPage.tsx', "{/* Mensajes */}", "{/* Mensajes */}<i style={{ color: 'red' }} />")
M('M6 vuelve el confirm() del navegador', 'src/pages/ChatPage.tsx', "const navigate = useNavigate()", "const navigate = useNavigate(); void confirm('x')")
M('M7 se borra la clave cta_final_title de i18n (ES)', 'src/i18n/es.ts', "cta_final_title:", "cta_final_titleX:")
M('M8 se borra la clave cta_final_subtitle de i18n (EN)', 'src/i18n/en.ts', "cta_final_subtitle:", "cta_final_subtitleX:")
restore(); console.log('clon restaurado')
