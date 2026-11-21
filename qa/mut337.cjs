// QA-Claude-2 — PR #327 (ES-337) mutaciones sobre el clon: node qa/mut337.cjs <clon>. Corre las pruebas del frontend (es-301-legal, es-337-aviso-ia) y del backend (es-337-privacy-redirect, es-301-terms) que cubren el cambio.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const ROOT = process.argv[2]; const P = f => path.join(ROOT, f)
const runF = () => { try { execSync('node --test test/es-301-legal.test.mjs test/es-337-aviso-ia.test.mjs 2>&1', { cwd: P('frontend'), stdio: 'pipe', timeout: 180000, shell: true }); return false } catch (e) { return true } }
const runB = () => { try { execSync('node --test test/es-337-privacy-redirect.test.cjs test/es-301-terms.test.cjs 2>&1', { cwd: P('backend'), stdio: 'pipe', timeout: 180000, shell: true }); return false } catch (e) { return true } }
const files = ['frontend/src/legal/version.ts', 'frontend/src/legal/legalCopy.ts', 'backend/utils/terms.js', 'backend/utils/frontendStatic.js', 'vercel.json']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b, run) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('a TERMS_VERSION distinta entre cliente y servidor', 'frontend/src/legal/version.ts', "'2026-11-v2'", "'2026-11-v1'", runF)
M('a2 TERMS_VERSION del servidor distinta', 'backend/utils/terms.js', "version: '2026-11-v2'", "version: '2026-11-v1'", runB)
M('b se quita la redirección 308 de /privacy/index.html', 'backend/utils/frontendStatic.js', "app.get('/privacy/index.html', legacyPrivacy);", '', runB)
M('b2 la redirección pasa de 308 a 302', 'backend/utils/frontendStatic.js', 'res.redirect(308,', 'res.redirect(302,', runB)
M('c /privacy vuelve a las reescrituras de Vercel', 'vercel.json', '"rewrites": [', '"rewrites": [\n    { "source": "/privacy", "destination": "/frontend/dist/privacy/index.html" },', runB)
M('c2 la redirección de Vercel deja de ser permanente', 'vercel.json', '"permanent": true', '"permanent": false', runB)
M('d se borra el marcador VERIFICAR del texto ES', 'frontend/src/legal/legalCopy.ts', '[[VERIFICAR con Infra: nombres, país de cada uno, si hay transferencia internacional y, por contrato, que no usan tus datos para entrenar modelos.]]', 'Todo verificado.', runF)
M('e vuelve «la IA no ve tu diario» (ES)', 'frontend/src/legal/legalCopy.ts', 'Nada de lo que la IA lee llega a un profesional sin tu permiso.', 'La IA de análisis solo ve tus evidencias confirmadas, no tu diario, tu ánimo ni tus conversaciones.', runF)
M('f vuelve «últimos 7 días» (ES)', 'frontend/src/legal/legalCopy.ts', 'tus últimos 7 registros de ánimo', 'tu ánimo de los últimos 7 días', runF)
M('g vuelve «te pediremos aceptar la nueva versión» (ES)', 'frontend/src/legal/legalCopy.ts', 'las cuentas ya creadas conservan registrada la versión que aceptaron.', 'te pediremos aceptar la nueva versión.', runF)
M('h vuelve «contraseña cifrada» (ES)', 'frontend/src/legal/legalCopy.ts', 'se guarda como un resumen irreversible —hash—, nunca en texto legible', 'se guarda cifrada, nunca en texto legible', runF)
restore(); console.log('clon restaurado')
