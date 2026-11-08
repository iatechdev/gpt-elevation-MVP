// ES-153: sesión verificada en el servidor (GET /api/session, ES-74) cada vez que se entra a una ruta protegida. El rol guardado en el
// navegador solo sirve para pintar sin esperar; quien manda es la respuesta del servidor, y el servidor además vuelve a decidir en cada API.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { invalidateStoredSession, readStoredToken, readVerifiedSession, type SessionInfo } from '../access/session'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export type VerifiedState =
  | { status: 'anonymous' }
  | { status: 'checking' }
  | { status: 'unavailable' }
  | { status: 'verified'; session: SessionInfo }

const subscribe = (notify: () => void) => {
  for (const name of ['storage', 'elevation-session-change']) window.addEventListener(name, notify)
  return () => { for (const name of ['storage', 'elevation-session-change']) window.removeEventListener(name, notify) }
}

export function useVerifiedSession(baseUrl: string = BACKEND): { state: VerifiedState; retry: () => void } {
  const token = useSyncExternalStore(subscribe, readStoredToken, () => '')
  const { pathname } = useLocation()
  const [attempt, setAttempt] = useState(0)
  // Última verificación buena de ESTE token (se conserva mientras se revalida al cambiar de ruta) y último fallo sin verificación previa.
  const [verified, setVerified] = useState<{ token: string; session: SessionInfo } | null>(null)
  const [failedToken, setFailedToken] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    void readVerifiedSession({ baseUrl, token, signal: controller.signal }).then(answer => {
      if (controller.signal.aborted || readStoredToken() !== token) return
      if (answer.status === 'verified') {
        // Los componentes antiguos leen el rol del navegador: se alinea con lo que dijo el servidor.
        try { localStorage.setItem('elevation_role', answer.session.role) } catch { /* sin almacenamiento */ }
        setVerified({ token, session: answer.session })
        setFailedToken(null)
      } else if (answer.status === 'invalid') {
        setVerified(null)
        invalidateStoredSession(token) // 401/403: la sesión ya no vale; el cambio de token lleva a «anonymous»
      } else {
        // Un fallo pasajero al cambiar de ruta no expulsa a quien ya fue verificado; el servidor sigue decidiendo en cada API.
        setFailedToken(token)
      }
    })
    return () => controller.abort()
  }, [baseUrl, token, pathname, attempt])

  const retry = useCallback(() => { setFailedToken(null); setAttempt(value => value + 1) }, [])
  if (!token) return { state: { status: 'anonymous' }, retry }
  if (verified?.token === token) return { state: { status: 'verified', session: verified.session }, retry }
  if (failedToken === token) return { state: { status: 'unavailable' }, retry }
  return { state: { status: 'checking' }, retry }
}
