// ES-153: quién entra a qué. La tabla es la fuente única del cliente; el SERVIDOR sigue siendo quien decide en cada petición (verificarToken,
// verificarAdmin, verificarTerapeuta, verificarBoard…): ocultar un enlace o mostrar esta pantalla no es seguridad, es explicación.
import type { SessionInfo } from '../access/session'

export type Role = SessionInfo['role']
export type Zone = 'person' | 'professional' | 'admin' | 'board' | 'member'

export const ZONE_ROLES: Record<Zone, readonly Role[]> = {
  person: ['user'],
  professional: ['therapist'],
  admin: ['admin', 'superadmin'],
  board: ['board', 'superadmin'], // ES-207: la junta ya no edita el manifiesto; su sesión aterriza en la página pública /manifiesto
  member: ['user', 'admin', 'superadmin', 'therapist', 'board'], // cualquier sesión válida (Mis datos, revisiones profesionales)
}

export const canEnter = (role: Role, zone: Zone) => ZONE_ROLES[zone].includes(role)

// Rutas de /app y /facilitation que no son solo de la persona usuaria.
const MEMBER_PATHS = ['/app/data', '/app/plan', '/app/professional-reviews', '/facilitation'] // ES-174: «Mi plan» como «Mis datos», para cualquier sesión válida

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Zona de una ruta protegida. Lo no listado es de la persona usuaria (/app) o de administración (/admin). */
export function zoneForPath(pathname: string): Zone | null {
  if (MEMBER_PATHS.some(base => under(pathname, base))) return 'member'
  if (under(pathname, '/admin')) return 'admin'
  if (under(pathname, '/board')) return 'board'
  if (under(pathname, '/therapist')) return 'professional'
  if (under(pathname, '/app')) return 'person'
  return null
}

export type GateDecision = 'login' | 'checking' | 'unavailable' | 'allow' | 'noAccess'

/** Qué hace la compuerta con el estado de la sesión verificada. `declared` es la zona del guardián; la de la ruta, si es más estricta, también se exige. */
export function gateDecision(
  state: { status: 'anonymous' } | { status: 'checking' } | { status: 'unavailable' } | { status: 'verified'; role: Role },
  pathname: string, declared?: Zone,
): GateDecision {
  if (state.status === 'anonymous') return 'login'
  if (state.status === 'checking') return 'checking'
  if (state.status === 'unavailable') return 'unavailable'
  const strict = zoneForPath(pathname)
  const needed = declared ?? strict ?? 'member'
  const zones: Zone[] = strict && strict !== needed ? [needed, strict] : [needed]
  return zones.every(zone => canEnter(state.role, zone)) ? 'allow' : 'noAccess'
}
