// QA-Claude-2 — PR #369 (O5-1) mutaciones de los tokens de color: FRONTEND=<clon>/frontend node qa/mut369.cjs (prueba: test/es-185-landing-labels.test.mjs)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = path.resolve(process.env.FRONTEND); const F = path.join(FE, 'src/cartografia/cartografia.css'); const orig = fs.readFileSync(F, 'utf8')
const fails = () => { try { execSync('node --test test/es-185-landing-labels.test.mjs', { cwd: FE, stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
console.log('sin mutar:', fails() ? 'FALLA (mal)' : 'pasa')
const d = orig.indexOf('@media (prefers-color-scheme: dark)'); const light = orig.slice(orig.indexOf('.cg {'), d)
const sub = (name, hex, zone) => { const re = new RegExp('(--cg-' + name + ': )#[0-9a-f]{6}'); if (zone === 'light') { const i = orig.indexOf('.cg {'); const seg = orig.slice(i, d); return orig.slice(0, i) + seg.replace(re, '$1' + hex) + orig.slice(d) } const seg = orig.slice(d, d + 700); return orig.slice(0, d) + seg.replace(re, '$1' + hex) + orig.slice(d + 700) }
const M = (n, text) => { fs.writeFileSync(F, text); console.log(`M ${n}: ${fails() ? 'DETECTADO' : 'SOBREVIVE'}`); fs.writeFileSync(F, orig) }
M('good claro casi igual al panel (#e0f0e8)', sub('good', '#e0f0e8', 'light')); M('good claro #5aa889 (≈ 3:1)', sub('good', '#5aa889', 'light')); M('mark claro #aabbee', sub('mark', '#aabbee', 'light')); M('mark claro #6f95d0 (≈ 3:1)', sub('mark', '#6f95d0', 'light'))
M('good oscuro #1f5f46 (oscuro sobre oscuro)', sub('good', '#1f5f46', 'dark')); M('mark oscuro #1d4f91', sub('mark', '#1d4f91', 'dark')); M('mark oscuro #3b6aa8 (≈ 3:1)', sub('mark', '#3b6aa8', 'dark'))
M('el panel claro cambia a un verde que baja el contraste de good (#8fd0b0)', sub('panel', '#8fd0b0', 'light')); M('el panel oscuro sube (#5a7a6a) y baja el contraste de mark', sub('panel', '#5a7a6a', 'dark'))
fs.writeFileSync(F, orig); console.log('clon restaurado')
