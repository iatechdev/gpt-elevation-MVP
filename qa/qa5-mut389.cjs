// Mutaciones de #389 sobre la copia tools/qa5/pr389 (solo local). Uso: node qa5-mut389.cjs N1..N6
const fs = require('fs'); const D = (process.env.QA_TOOLS || '.') + '/qa5/pr389/frontend/src/pages/admin/'; const PC = D + 'planChoices.ts'; const AC = D + 'AdminContent.tsx'
const muts = {
  N1: [PC, s => s.replace("if (!(PLAN_CURRENCIES as readonly string[]).includes(currency)) { currency = PLAN_CURRENCIES[0]; errors['plan-currency'] = PLAN_CHOICE_ERRORS.currency }", "if (false as boolean) { currency = PLAN_CURRENCIES[0]; errors['plan-currency'] = PLAN_CHOICE_ERRORS.currency }").replace("if (!(PLAN_PERIODS as readonly string[]).includes(period)) { period = PLAN_PERIODS[0]; errors['plan-period'] = PLAN_CHOICE_ERRORS.period }", "if (false as boolean) { period = PLAN_PERIODS[0]; errors['plan-period'] = PLAN_CHOICE_ERRORS.period }")],
  N2: [AC, s => s.replace("setForm(f => ({ ...f, currency: e.target.value })); setErrors(current => ({ ...current, 'plan-currency': '' }))", "setForm(f => ({ ...f, currency: e.target.value }))")],
  N3: [AC, s => s.replace("focusAfterSave.current = fieldError.id; return", "return")],
  N4: [PC, s => s.replace('|| !Object.hasOwn(FIELD_ID, field)', '|| false')],
  N5: [PC, s => s.replace("if (error.length === 0 || error.length > 300) return null", "if (error.length === 0) return null")],
  N6: [AC, s => s.replace('setErrors(legacy)', 'void legacy; setErrors({})')],
}
const [f, fn] = muts[process.argv[2]]; const a = fs.readFileSync(f, 'utf8'); const b = fn(a); if (a === b) { console.log(process.argv[2], 'NO APLICA'); process.exit(3) } fs.writeFileSync(f, b)
