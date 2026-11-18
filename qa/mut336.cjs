// QA-Claude-2 — PR #336 (ES-237 2a) mutaciones del cliente sobre el clon: FRONTEND=<clon>/frontend BACKEND=<clon>/backend QA_PG=... node qa/mut336.cjs
// Primero la prueba estructural del PR; si sobrevive, mi guion contra el servidor real (qa/e336-cliente-rutas.cjs).
const fs = require('fs'), path = require('path'), { execSync } = require('child_process'); const FE = process.env.FRONTEND; const F = path.join(FE, 'src/career/api.ts'); const orig = fs.readFileSync(F, 'utf8')
const run = (cmd, cwd, env) => { try { execSync(cmd, { cwd, stdio: 'pipe', timeout: 600000, shell: true, maxBuffer: 1e8, env: { ...process.env, ...env } }); return false } catch (e) { return true } }
const M = (name, a, b) => { fs.writeFileSync(F, orig); if (!orig.includes(a)) { console.log(`M ${name}: SIN ANCLA`); return } fs.writeFileSync(F, orig.replace(a, () => b))
  let r = run('node --test test/es-237-api-career.test.mjs', FE), how = 'por la prueba estructural del PR'
  if (!r) { r = run(`node ${path.join(__dirname, 'e336-cliente-rutas.cjs')}`, FE, { FRONTEND: FE }); how = 'solo por mi guion contra el servidor real' }
  console.log(`M ${name}: ${r ? 'DETECTADO ' + how : 'SOBREVIVE'}`); fs.writeFileSync(F, orig) }
M('a se quita la comprobación E307-1 (2xx no legible = éxito con null)', "  if (!readable || value === null || typeof value !== 'object' || Array.isArray(value)) throw new CareerApiError('unavailable', response.status, '')\n", '')
M('b un arreglo cuenta como éxito', " || Array.isArray(value)", '')
M("c el 2xx ilegible deja de ser incierto ('rejected')", "throw new CareerApiError('unavailable', response.status, '')\n  return value", "throw new CareerApiError('rejected', response.status, '')\n  return value")
M('d restricciones usa POST en vez de PUT', "'/api/routes/constraints', 'PUT', input", "'/api/routes/constraints', 'POST', input")
M('e el roleKey ya no se codifica', "/api/route-catalog/roles/${encodeURIComponent(roleKey)}", "/api/route-catalog/roles/${roleKey}")
M("f la elección acepta 'postponed' en el tipo", "decision: 'accepted' | 'rejected'; basisHash: string }) => call(o, '/api/routes/choices'", "decision: 'accepted' | 'rejected' | 'postponed'; basisHash: string }) => call(o, '/api/routes/choices'")
M('g putConstraints deja de enviar baseVersion', "'/api/routes/constraints', 'PUT', input", "'/api/routes/constraints', 'PUT', { requestId: input.requestId, payload: input.payload }")
M('h se quita Authorization', "headers: { Authorization: `Bearer ${token}`, Accept", "headers: { Accept")
fs.writeFileSync(F, orig); console.log('clon restaurado')
