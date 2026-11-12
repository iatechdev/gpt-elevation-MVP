// ES-285 (seguimiento E243-2 / O247-A): «Entrar» tras un 401. Solo se avisa si existe un token DISTINTO al usado (un inicio de sesión más nuevo, en esta u otra pestaña): no se cierra.
// Con el token ausente (p. ej. se cerró la sesión en otra pestaña) o igual al usado, la sesión vencida se invalida y la compuerta lleva a /login.
import { invalidateStoredSession, readStoredToken } from '../../access/session.ts'

/** true = se llevó a /login (token igual o ausente); false = hay un token distinto (sesión más nueva) y no se tocó. */
export function enterAgain(usedToken: string): boolean {
  const current = readStoredToken()
  if (current !== '' && current !== usedToken) return false
  invalidateStoredSession(current) // con '' limpia restos (rol, nombre) y avisa a la compuerta, que lee el almacenamiento y va a /login
  return true
}
