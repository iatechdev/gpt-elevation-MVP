// QA-Claude-2 — PR #325 (ES-334) mutaciones sobre el clon: node qa/mut334.cjs <clon> <URL de PostgreSQL desechable en loopback>. Frontend: es-153-shell. Servidor: es-334-postgres.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const ROOT = process.argv[2]; const PGURL = process.argv[3]; const P = f => path.join(ROOT, f)
const runF = () => { try { execSync('node --test test/es-153-shell.test.mjs 2>&1', { cwd: P('frontend'), stdio: 'pipe', timeout: 180000, shell: true }); return false } catch (e) { return true } }
const runB = () => { try { execSync('node --test test/integration/es-334-postgres.cjs 2>&1', { cwd: P('backend'), stdio: 'pipe', timeout: 400000, shell: true, env: { ...process.env, ES334_TEST_DATABASE_URL: PGURL } }); return false } catch (e) { return true } }
const files = ['frontend/src/shell/access.ts', 'backend/routes/diary.js', 'backend/server.js']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b, run) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
const A = 'frontend/src/shell/access.ts'
M('Ma superadmin fuera de person', A, "person: ['user', 'superadmin']", "person: ['user']", runF)
M('Mb admin dentro de person (admin entra al chat)', A, "person: ['user', 'superadmin']", "person: ['user', 'admin', 'superadmin']", runF)
M('Mc admin dentro de professional', A, "professional: ['therapist', 'superadmin']", "professional: ['therapist', 'admin', 'superadmin']", runF)
M('Md persona dentro de admin', A, "admin: ['admin', 'superadmin']", "admin: ['admin', 'superadmin', 'user']", runF)
M('Md2 profesional dentro de admin', A, "admin: ['admin', 'superadmin']", "admin: ['admin', 'superadmin', 'therapist']", runF)
M('Me superadmin fuera de professional', A, "professional: ['therapist', 'superadmin']", "professional: ['therapist']", runF)
M('Mf1 servidor: GET /api/diary/:id sin filtrar por dueño', 'backend/routes/diary.js', "const own = (userId, id) => DiaryEntry.findOne({ where: { id, UserId: userId, deletedAt: null } });", "const own = (userId, id) => DiaryEntry.findOne({ where: { id, deletedAt: null } });", runB)
M('Mf2 servidor: /api/therapist abierto a cualquier sesión válida', 'backend/server.js', "app.use('/api/therapist',       verificarTerapeuta,", "app.use('/api/therapist',       verificarToken,", runB)
restore(); console.log('clon restaurado')
