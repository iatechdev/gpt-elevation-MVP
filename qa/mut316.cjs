// QA-Claude-2 — PR #316 (ES-333 PR 2/3) mutaciones sobre el clon: node qa/mut316.cjs <clon>/frontend. Corre las pruebas del chat y del layout de persona.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-112*.test.mjs test/es-123*.test.mjs test/es-149*.test.mjs test/es-153*.test.mjs test/es-162*.test.mjs test/es-199*.test.mjs test/es-236*.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 240000, shell: true }); return false } catch (e) { return true } }
const files = ['src/shell/personLayoutState.ts', 'src/space/space.css', 'src/space/ChatControls.tsx', 'src/space/ChatMenu.tsx', 'src/pages/ChatPage.tsx']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 sacar /app/chat de MIGRATED_PERSON_PATHS', 'src/shell/personLayoutState.ts', "'/app/chat', ", '')
M('M2 el contenedor del chat pierde height: 100dvh', 'src/space/space.css', '.chat-shell { height: 100dvh;', '.chat-shell { height: auto;')
M('M3 la hoja del diario deja de ser sheet', 'src/space/ChatControls.tsx', '<Dialog sheet open={chat.picker}', '<Dialog open={chat.picker}')
M('M4 E314-3: tras enviar con Enter el foco ya no vuelve a la caja', 'src/space/ChatControls.tsx', '{ hadFocus.current = true; void chat.send() }', '{ void chat.send() }')
M('M5 «Límites» se oculta siempre con alto < 400 px (no solo al escribir)', 'src/space/space.css', '.chat-input-bar:has(textarea:focus) .chat-composer-top, .chat-input-bar:has(textarea:focus) .chat-limits { display: none; }', '.chat-input-bar .chat-composer-top, .chat-input-bar .chat-limits { display: none; }')
M('M6 «Administración» visible para todos en el menú', 'src/pages/ChatPage.tsx', "onAdmin={['admin', 'superadmin'].includes(role) ? openAdmin : undefined}", 'onAdmin={openAdmin}')
M('M7 el menú pierde el texto de Cerrar sesión', 'src/space/ChatMenu.tsx', '>{c.signOut}</button>', '></button>')
restore(); console.log('clon restaurado')
