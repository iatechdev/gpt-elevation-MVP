import policy from '../../../shared/registration-password-policy.json' with { type: 'json' }

// ES-128: misma política y mismas reglas que backend/utils/registrationPassword.js (el servidor es la fuente de verdad).
export type PasswordProblem = 'length' | 'upper' | 'lower' | 'digit' | 'special' | 'max_bytes' | 'common'
export const PASSWORD_RULES = policy.rules as readonly ('length' | 'upper' | 'lower' | 'digit' | 'special')[]
export const PASSWORD_PROBLEMS: readonly PasswordProblem[] = [...PASSWORD_RULES, 'max_bytes', 'common']

const common = new Set(policy.common)
// Carácter especial: ni letra, ni número, ni espacio en blanco (símbolos, puntuación y emojis cuentan; el espacio no).
const RULES: Record<(typeof PASSWORD_RULES)[number], (value: string) => boolean> = {
  length: value => [...value].length >= policy.minCharacters,
  upper: value => /\p{Lu}/u.test(value),
  lower: value => /\p{Ll}/u.test(value),
  digit: value => /[0-9]/.test(value),
  special: value => /[^\p{L}\p{N}\s]/u.test(value),
}

export function passwordProblems(value: string): PasswordProblem[] {
  const missing: PasswordProblem[] = PASSWORD_RULES.filter(id => !RULES[id](value))
  if (new TextEncoder().encode(value).length > policy.maxUtf8Bytes) missing.push('max_bytes')
  if (value.trim().length > 0 && common.has(value.trim().toLowerCase())) missing.push('common')
  return missing
}

export function validRegistrationPassword(value: string): boolean {
  return passwordProblems(value).length === 0
}

// Ids de requisitos que el servidor puede devolver en `missing`; lo desconocido se descarta.
export function knownProblems(value: unknown): PasswordProblem[] {
  return Array.isArray(value) ? PASSWORD_PROBLEMS.filter(id => value.includes(id)) : []
}
