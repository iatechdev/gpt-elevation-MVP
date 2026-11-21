// QA-Claude-2 — PR #333 (ES-338) mutaciones sobre el clon: node qa/mut333.cjs <clon>. Corre es-338-borrado-ia.test.mjs.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const ROOT = process.argv[2]; const F = path.join(ROOT, 'frontend/src/space/dataCopy.ts'); const orig = fs.readFileSync(F, 'utf8')
const run = () => { try { execSync('node --test test/es-338-borrado-ia.test.mjs 2>&1', { cwd: path.join(ROOT, 'frontend'), stdio: 'pipe', timeout: 120000, shell: true }); return false } catch (e) { return true } }
const M = (name, a, b) => { if (!orig.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(F, orig.replace(a, () => b)); console.log(`M ${name}: ${run() ? 'DETECTADO por las pruebas' : 'SOBREVIVE a las pruebas'}`); fs.writeFileSync(F, orig) }
M('a ES vuelve a «incluidos los que usa la IA»', 'Se borran tus datos en Elevation, incluidos los que se usan para generar respuestas con IA. Lo que ya se envió al proveedor de IA se rige por los plazos de ese proveedor, que aún no podemos confirmar.', 'Se borran tus datos, incluidos los que usa la IA.')
M('b EN pierde la salvedad del proveedor', ' What was already sent to the AI provider follows that provider’s own timelines, which we cannot confirm yet.', '')
M('c ES pierde la salvedad del proveedor', ' Lo que ya se envió al proveedor de IA se rige por los plazos de ese proveedor, que aún no podemos confirmar.', '')
M('d otra consecuencia cambia (no se puede deshacer)', 'No se puede deshacer. Si quieres conservar algo, descárgalo antes.', 'Se puede deshacer. Si quieres conservar algo, descárgalo antes.')
M('e EN vuelve a «including what the AI uses»', 'Your data in Elevation is deleted, including what is used to generate AI replies.', 'Your data is deleted, including what the AI uses.')
M('f se promete una fecha de borrado (ES)', 'Todavía no podemos indicarte una fecha para completar el borrado.', 'Tu cuenta se borra en 7 días.')
fs.writeFileSync(F, orig); console.log('clon restaurado')
