// QA-Claude-2 — PR #372 (ES-356): mutaciones sobre un clon en la cabeza del PR; cada una debe hacer fallar la prueba del PR (frontend pricing.test.mjs o backend es-278 unitaria).
// Uso: CLONE=<clon en la cabeza del PR> node qa/mut372.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE
const F = { plans: 'frontend/src/pricing/plans.ts', val: 'backend/utils/pricingValidation.js', adm: 'frontend/src/pages/admin/AdminContent.tsx' }
const run = (cwd, args) => { const r = spawnSync('node', ['--test', ...args], { cwd: path.join(R, cwd), encoding: 'utf8' }); const m = /ℹ fail (\d+)/.exec(r.stdout); return m ? Number(m[1]) : -1 }
const M = [
  ['M1 una fila inválida vuelve a tumbar toda la lista', 'plans', "catch { onSkip({ id: object(raw) ? raw.id : undefined, reason: planProblem(raw, ids) }) }", "catch { throw new PlansError() }"],
  ['M2 parsePlans admite forever', 'plans', "if (!['month', 'year'].includes(String(raw.period)) || typeof raw.isHighlighted", "if (!['month', 'year', 'forever'].includes(String(raw.period)) || typeof raw.isHighlighted"],
  ['M3 el motivo del registro repite el nombre del plan', 'plans', "return 'período no admitido'", "return 'período no admitido ' + String(raw.name_es)"],
  ['M4 no se detectan ids repetidos', 'plans', "  if (ids.has(raw.id)) throw new PlansError()\n  if (!text(raw.name_es)", "  if (!text(raw.name_es)"],
  ['M5 el tope de 1000 filas desaparece', 'plans', "if (!Array.isArray(value) || value.length > 1000) throw new PlansError()", "if (!Array.isArray(value)) throw new PlansError()"],
  ['M6 lo que no es lista devuelve [] sin error', 'plans', "if (!Array.isArray(value) || value.length > 1000) throw new PlansError()", "if (!Array.isArray(value)) return []\n  if (value.length > 1000) throw new PlansError()"],
  ['M7 todas inválidas = error (en vez de lista vacía)', 'plans', "  return result.sort((a, b) => a.order - b.order || a.id - b.id)\n}\n// Motivo", "  if (value.length && !result.length) throw new PlansError()\n  return result.sort((a, b) => a.order - b.order || a.id - b.id)\n}\n// Motivo"],
  ['M8 el servidor vuelve a aceptar forever', 'val', "const PERIODS = Object.freeze(['month', 'year'])", "const PERIODS = Object.freeze(['month', 'year', 'forever'])"],
  ['M9 el desplegable de administración vuelve a ofrecer forever', 'adm', '<option value="year">{tr("Anual")}</option>', '<option value="year">{tr("Anual")}</option><option value="forever">{tr("Para siempre")}</option>'],
  ['M10 se pierde la ordenación', 'plans', "return result.sort((a, b) => a.order - b.order || a.id - b.id)\n}\n// Motivo", "return result\n}\n// Motivo"],
  ['M11 el registro por defecto no avisa (callback vacío)', 'plans', "const logSkip = (skip: PlanSkip) => { console.warn(", "const logSkip = (skip: PlanSkip) => { void (" ],
  ['M12 el registro dice el id aunque no sea número (repite contenido ajeno)', 'plans', "String(typeof skip.id === 'number' ? skip.id : '?')", "String(skip.id)"],
  ['M13 mensaje de período del servidor sin la parte en inglés', 'val', "El período debe ser month o year. / The period must be month or year.", "El período debe ser month o year."],
]
let det = 0; for (const [name, k, from, to] of M) { const file = path.join(R, F[k]); const orig = fs.readFileSync(file, 'utf8'); const o = orig.split('\r\n').join('\n'); if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(file, o.split(from).join(to)); const fe = run('frontend', ['test/pricing.test.mjs']); const be = run('backend', ['test/es-278-moneda-periodo.test.cjs']); fs.writeFileSync(file, orig)
  const caught = fe > 0 || be > 0; if (caught) det++; console.log(caught ? 'DETECTADA  ' : 'SOBREVIVE  ', name, `(front fallos=${fe}, back fallos=${be})`) }
console.log(`${det}/${M.length} detectadas`)
