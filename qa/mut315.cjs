// QA-Claude-2 — PR #315 (ES-331) mutaciones sobre el clon: node qa/mut315.cjs <clon>/frontend (corre es-331 y las pruebas del puente).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.argv[2]; const P = f => path.join(FE, f)
const run = () => { try { execSync('node --test test/es-331-bridge-cls.test.mjs test/es-121*.test.mjs test/es-247*.test.mjs 2>&1', { cwd: FE, stdio: 'pipe', timeout: 180000, shell: true }); return false } catch (e) { return true } }
const files = ['src/bridge/bridge.css', 'src/bridge/SourcesPanel.tsx']; const orig = Object.fromEntries(files.map(f => [f, fs.readFileSync(P(f), 'utf8')])); const restore = () => files.forEach(f => fs.writeFileSync(P(f), orig[f]))
const M = (name, file, a, b) => { restore(); const s = fs.readFileSync(P(file), 'utf8'); if (!s.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(P(file), s.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); restore() }
M('M1 quitar el min-height móvil', 'src/bridge/bridge.css', '.br-src-ph { min-height: 39rem; }', '.br-src-ph { }')
M('M2 reservar la mitad en móvil', 'src/bridge/bridge.css', '.br-src-ph { min-height: 39rem; }', '.br-src-ph { min-height: 19.5rem; }')
M('M3 reservar el doble en móvil (hueco)', 'src/bridge/bridge.css', '.br-src-ph { min-height: 39rem; }', '.br-src-ph { min-height: 78rem; }')
M('M4 quitar el contenedor br-src-ph', 'src/bridge/SourcesPanel.tsx', '<div className="br-src-ph"><p role="status" aria-busy="true" className="cg-hint">{c.src_loading}</p></div>', '<p role="status" aria-busy="true" className="cg-hint">{c.src_loading}</p>')
M('M5 mover el breakpoint de tablet a 900 px', 'src/bridge/bridge.css', '@media (min-width: 768px) { .br-src-ph { min-height: 34.5rem; } }', '@media (min-width: 900px) { .br-src-ph { min-height: 34.5rem; } }')
M('M6 reservar también con error de carga (hueco con Reintentar)', 'src/bridge/SourcesPanel.tsx', '{!perms && !loadError && <div className="br-src-ph">', '{!perms && <div className="br-src-ph">')
restore(); console.log('clon restaurado')
