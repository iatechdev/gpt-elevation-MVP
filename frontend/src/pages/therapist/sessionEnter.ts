// ES-285 (seguimiento E243-2): «Entrar» tras un 401. Si mientras tanto hubo un inicio de sesión más nuevo (esta u otra pestaña), no se cierra: se avisa y se puede reenviar.
import { invalidateStoredSession, readStoredToken } from '../../access/session.ts'

/** true = se invalidó la sesión vencida (la compuerta lleva a /login); false = ya hay una sesión más nueva y no se tocó. */
export function enterAgain(usedToken: string): boolean {
  if (readStoredToken() !== usedToken) return false
  invalidateStoredSession(usedToken)
  return true
}
