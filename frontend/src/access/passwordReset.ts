// ES-132: el token del enlace de restablecimiento viaja en el fragmento (#token=...), que el navegador no envía al servidor ni a otros sitios.
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/

export function readResetToken(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return value && TOKEN.test(value) ? value : null
}

export type ResetFailure = 'password_policy' | 'reset_invalid' | 'rate_limited' | 'failed'

// Qué mensaje corresponde a una respuesta rechazada de /api/password-reset/*.
export function resetFailure(status: number, code: unknown): ResetFailure {
  if (code === 'password_policy') return 'password_policy'
  if (code === 'reset_invalid') return 'reset_invalid'
  if (status === 429 || code === 'rate_limited') return 'rate_limited'
  return 'failed'
}
