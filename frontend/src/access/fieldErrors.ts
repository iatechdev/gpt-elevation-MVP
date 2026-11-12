// ES-155 (tramo B): validación por campo del lado del cliente y orden del foco. El servidor sigue siendo la autoridad (esto solo evita un viaje inútil y dice QUÉ campo falla).
export type AccessField = 'name' | 'email' | 'password'
export type FieldErrors = Partial<Record<AccessField, 'name' | 'email' | 'password'>>
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Errores por campo. `password` solo se exige vacío aquí; los requisitos de la contraseña de un registro los valida `passwordProblems` (ES-128). */
export function fieldErrors(values: { name: string; email: string; password: string }, mode: 'login' | 'register' | 'forgot'): FieldErrors {
  const errors: FieldErrors = {}
  if (mode === 'register' && !values.name.trim()) errors.name = 'name'
  if (!EMAIL.test(values.email.trim())) errors.email = 'email'
  if (mode !== 'forgot' && !values.password) errors.password = 'password'
  return errors
}
/** El foco va al primer campo con error, en el orden en que se ven. */
export const firstInvalid = (errors: FieldErrors): AccessField | null => (['name', 'email', 'password'] as const).find(field => errors[field]) ?? null
