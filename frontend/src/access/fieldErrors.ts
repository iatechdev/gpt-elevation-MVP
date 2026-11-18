// ES-155 (tramo B): validación por campo del lado del cliente y orden del foco. El servidor sigue siendo la autoridad (esto solo evita un viaje inútil y dice QUÉ campo falla).
// ES-301: en el registro, la casilla del aviso de privacidad y términos (`terms`) es el último campo.
export type AccessField = 'name' | 'email' | 'password' | 'terms'
export type FieldErrors = Partial<Record<AccessField, AccessField>>
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Errores por campo. `password` solo se exige vacío aquí; los requisitos de la contraseña de un registro los valida `passwordProblems` (ES-128). */
export function fieldErrors(values: { name: string; email: string; password: string; terms?: boolean }, mode: 'login' | 'register' | 'forgot' | 'invite'): FieldErrors {
  const errors: FieldErrors = {}
  if ((mode === 'register' || mode === 'invite') && !values.name.trim()) errors.name = 'name'
  if (mode !== 'invite' && !EMAIL.test(values.email.trim())) errors.email = 'email' // ES-326: con invitación el correo es el de la invitación, no se escribe
  if (mode !== 'forgot' && !values.password) errors.password = 'password'
  if ((mode === 'register' || mode === 'invite') && values.terms !== true) errors.terms = 'terms'
  return errors
}
/** El foco va al primer campo con error, en el orden en que se ven. */
export const firstInvalid = (errors: FieldErrors): AccessField | null => (['name', 'email', 'password', 'terms'] as const).find(field => errors[field]) ?? null
