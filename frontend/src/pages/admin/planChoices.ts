// E366-2 (ES-357): lógica PURA del formulario de planes sobre moneda y período.
// El servidor solo acepta USD/COP/EUR y month/year (backend/utils/pricingValidation.js; la prueba es-278-moneda-periodo cruza ambas listas). Un plan HEREDADO con otro valor (p. ej. JPY o forever)
// mostraba USD / Mensual en los desplegables (el navegador enseña la primera opción) pero reenviaba el valor heredado y el servidor respondía 400: «Error guardando.» sin decir el campo.
// Ahora, al abrir «Editar»: el estado toma lo que el desplegable MUESTRA y el campo queda marcado con el mensaje de API (ya bilingüe y aprobado en #366) para que se vea que había que elegir; y cualquier
// 400 `invalid_plan` del servidor se pinta bajo SU campo en lugar del aviso genérico.
export const PLAN_CURRENCIES = ['USD', 'COP', 'EUR'] as const
export const PLAN_PERIODS = ['month', 'year'] as const

// Mismos textos que el servidor (backend/utils/pricingValidation.js MESSAGES.currency / .period); una prueba comprueba que coinciden.
export const PLAN_CHOICE_ERRORS = {
  currency: 'La moneda debe ser USD, COP o EUR. / The currency must be USD, COP or EUR.',
  period: 'El período debe ser month o year. / The period must be month or year.',
} as const

export type PlanChoices = { currency: string; period: string }

/** Lo que el formulario debe tener al abrir: los valores válidos se conservan; uno heredado pasa al primero de la lista (el que muestra el desplegable) y se marca `error`. */
export function normalizeChoices(plan: PlanChoices): { values: PlanChoices; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  let currency = plan.currency
  let period = plan.period
  if (!(PLAN_CURRENCIES as readonly string[]).includes(currency)) { currency = PLAN_CURRENCIES[0]; errors['plan-currency'] = PLAN_CHOICE_ERRORS.currency }
  if (!(PLAN_PERIODS as readonly string[]).includes(period)) { period = PLAN_PERIODS[0]; errors['plan-period'] = PLAN_CHOICE_ERRORS.period }
  return { values: { currency, period }, errors }
}

// Campo del servidor (`field` de un 400 invalid_plan) → id del campo del formulario.
const FIELD_ID: Record<string, string> = { slug: 'plan-slug', name_es: 'plan-name-es', name_en: 'plan-name-en', price: 'plan-price', currency: 'plan-currency', period: 'plan-period' }

/** De un 400 `invalid_plan` con campo conocido: { id del campo, mensaje bilingüe del servidor }; null si no es eso (entonces el aviso genérico). */
export function serverFieldError(status: number, body: unknown): { id: string; message: string } | null {
  if (status !== 400 || !body || typeof body !== 'object') return null
  const { code, field, error } = body as Record<string, unknown>
  if (code !== 'invalid_plan' || typeof field !== 'string' || typeof error !== 'string' || !Object.hasOwn(FIELD_ID, field)) return null
  if (error.length === 0 || error.length > 300) return null
  return { id: FIELD_ID[field], message: error }
}
