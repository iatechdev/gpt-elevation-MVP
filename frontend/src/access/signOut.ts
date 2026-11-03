import { clearPending } from '../space/pending.ts'
import { readStoredToken } from './session.ts'

// ES-136: cierre de sesión único. Pide al servidor revocar el token (POST /api/logout, ES-18) y, pase lo que pase, borra la sesión local y el
// mensaje pendiente del chat. Si el servidor no responde, el token sigue válido hasta vencer: salir no se bloquea por eso.
export const SIGN_OUT_TIMEOUT_MS = 5000
const SESSION_KEYS = ['elevation_token', 'elevation_role', 'elevation_name', 'elevation_checkin_date']

export async function signOut(backend: string, fetcher: typeof fetch = fetch): Promise<{ revoked: boolean }> {
  const token = readStoredToken()
  let revoked = false
  if (token) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SIGN_OUT_TIMEOUT_MS)
    try {
      const response = await fetcher(`${backend}/api/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      revoked = response.ok
    } catch { /* sin red o sin respuesta: se cierra igual en este navegador */ } finally { clearTimeout(timer) }
  }
  clearPending() // QA-134-01: el mensaje pendiente del chat no sobrevive al cierre de sesión
  try { for (const key of SESSION_KEYS) localStorage.removeItem(key) } catch { /* almacenamiento no disponible */ }
  window.dispatchEvent(new Event('elevation-session-change'))
  return { revoked }
}
