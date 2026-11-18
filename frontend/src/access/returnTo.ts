// ES-330: volver a la ruta protegida que la persona pidió antes de iniciar sesión, SIN redirección abierta.
// Solo se acepta una ruta relativa interna de la lista permitida y que corresponda al ROL REAL verificado por el servidor; todo lo demás cae al inicio de su rol.
// El destino se recuerda en sessionStorage (por pestaña, caduca) para que sobreviva a login ↔ registro ↔ recuperar contraseña. No guarda hash ni datos de la persona: solo ruta y búsqueda.
import { canEnter, zoneForPath } from '../shell/access.ts'
import type { SessionInfo } from './session.ts'

const ALLOWED_BASES = ['/app', '/admin', '/therapist', '/facilitation'] as const
const MAX_LENGTH = 300
const KEY = 'elevation_return_to'
export const RETURN_TTL_MS = 30 * 60 * 1000
const SIGN_OUT_QUIET_MS = 3000
let quietUntil = 0

/** Ruta interna segura o null. Nunca devuelve una URL absoluta, un esquema, «//», «\», caracteres de control ni rutas fuera de la lista permitida. */
export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\\\x00-\x1f\x7f#]/.test(raw)) return null
  let url: URL
  try { url = new URL(raw, 'http://internal.invalid') } catch { return null }
  if (url.origin !== 'http://internal.invalid') return null
  // La ruta resuelta debe seguir bajo una base permitida (así «/app/../login» queda fuera) y no contener segmentos codificados de salto.
  const base = ALLOWED_BASES.find(candidate => url.pathname === candidate || url.pathname.startsWith(`${candidate}/`))
  if (!base || /%2e|%2f|%5c/i.test(url.pathname)) return null
  return url.pathname + url.search
}

/** La ruta recordada, solo si la zona de esa ruta corresponde al rol real; una persona sin onboarding terminado entra primero al onboarding. */
export function returnPathFor(raw: unknown, session: SessionInfo): string | null {
  const path = safeReturnPath(raw)
  if (!path) return null
  const zone = zoneForPath(new URL(path, 'http://internal.invalid').pathname)
  if (!zone || !canEnter(session.role, zone)) return null
  if (session.role === 'user' && !session.onboardingCompleted) return null
  return path
}

const storage = () => { try { return window.sessionStorage } catch { return null } }

export function rememberReturn(pathname: string, search: string, now = Date.now()) {
  if (now < quietUntil) return // acabo de cerrar sesión a propósito: no se recuerda la pantalla de la que salgo
  const path = safeReturnPath(pathname + search)
  const store = storage()
  if (!path || !store) return
  try { store.setItem(KEY, JSON.stringify({ path, at: now })) } catch { /* sin almacenamiento: se vuelve al inicio del rol */ }
}

export function peekReturn(now = Date.now()): string | null {
  const store = storage()
  if (!store) return null
  try {
    const value: unknown = JSON.parse(store.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const { path, at } = value as { path?: unknown; at?: unknown }
    if (typeof at !== 'number' || !Number.isFinite(at) || now - at > RETURN_TTL_MS || at - now > 60_000) return null
    return safeReturnPath(path)
  } catch { return null }
}

export function forgetReturn() {
  try { storage()?.removeItem(KEY) } catch { /* nada que borrar */ }
}

/** Cerrar sesión a propósito: borra lo recordado y evita que la compuerta recuerde la pantalla de la que se sale. */
export function signedOut(now = Date.now()) { quietUntil = now + SIGN_OUT_QUIET_MS; forgetReturn() }
