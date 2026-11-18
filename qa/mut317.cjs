// QA-Claude-2 — PR #317 (ES-330) mutaciones sobre el clon: node qa/mut317.cjs <clon>/frontend. Corre es-330-return-to y las pruebas de acceso/sesión.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-330-return-to.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
const files = ['src/access/returnTo.ts', 'src/pages/LoginPage.tsx', 'src/shell/RoleGate.tsx', 'src/access/signOut.ts']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 aceptar rutas que empiezan por //', 'src/access/returnTo.ts', "if (!raw.startsWith('/') || raw.startsWith('//')) return null", "if (!raw.startsWith('/')) return null")
M('M2 no comprobar el rol real', 'src/access/returnTo.ts', 'if (!zone || !canEnter(session.role, zone)) return null', 'if (!zone) return null')
M('M3 quitar el TTL de 30 minutos', 'src/access/returnTo.ts', 'now - at > RETURN_TTL_MS || ', '')
M('M4 cerrar sesión ya no borra lo recordado', 'src/access/returnTo.ts', 'quietUntil = now + SIGN_OUT_QUIET_MS; forgetReturn()', 'quietUntil = now + SIGN_OUT_QUIET_MS')
M('M5 la intención de plan deja de tener prioridad', 'src/pages/LoginPage.tsx', 'planDestination(params.toString()) ?? returnPathFor(', 'returnPathFor(peekReturn(), entry.result.session) ?? planDestination(params.toString()) ?? (')
M('M6 aceptar %2f en la ruta', 'src/access/returnTo.ts', "if (!base || /%2e|%2f|%5c/i.test(url.pathname)) return null", 'if (!base) return null')
M('M7 aceptar una ruta fuera de la lista (/login, /api)', 'src/access/returnTo.ts', "const base = ALLOWED_BASES.find(candidate => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`))", "const base = ALLOWED_BASES.find(candidate => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`)) ?? '/x'")
M('M8 quitar el límite de 300 caracteres', 'src/access/returnTo.ts', 'raw.length > MAX_LENGTH', 'false')
M('M9 aceptar la barra invertida', 'src/access/returnTo.ts', '/[\\\x00-\x1f\x7f#]/.test(raw)', '/[\x00-\x1f\x7f#]/.test(raw)')
M('M10 la compuerta no recuerda la ruta (RoleGate)', 'src/shell/RoleGate.tsx', "if (decision === 'login') rememberReturn(pathname, search)", "if (false) rememberReturn(pathname, search)")
restore(); console.log('clon restaurado')
