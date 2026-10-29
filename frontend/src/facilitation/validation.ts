// QA-35 obs. 2: la validación de texto vive en la lógica, no solo en maxLength del navegador. La usan la interfaz (mensaje por problema) y el
// servicio simulado (rechazo 'invalid'), de modo que un texto pegado o puesto por código no llega a la vista previa ni al registro.
export const LIMITS = { observation: 4000, limits: 2000, reason: 2000, response: 2000 } as const

// Se permiten salto de línea (0x0A), retorno (0x0D) y tabulación (0x09); el resto de caracteres de control, incluido DEL (0x7F), no.
// Se comparan códigos en vez de usar una expresión regular para no depender de la regla no-control-regex de ESLint.
const isControl = (code: number) => code <= 0x08 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f) || code === 0x7f
function hasControl(value: string) {
  for (let i = 0; i < value.length; i++) if (isControl(value.charCodeAt(i))) return true
  return false
}

export type TextProblem = 'controlChars' | 'required' | 'tooLong' | null

export function textProblem(value: unknown, max: number): TextProblem {
  if (typeof value !== 'string') return 'required'
  if (hasControl(value)) return 'controlChars'
  if (!value.trim()) return 'required'
  if (value.length > max) return 'tooLong'
  return null
}
