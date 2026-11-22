// ES-153: quién entra a qué. La tabla es la fuente única del cliente; el SERVIDOR sigue siendo quien decide en cada petición (verificarToken,
// verificarAdmin, verificarTerapeuta, verificarBoard…): ocultar un enlace o mostrar esta pantalla no es seguridad, es explicación.
import type { SessionInfo } from '../access/session'

export type Role = SessionInfo['role']
export type Zone = 'person' | 'participant' | 'professional' | 'admin' | 'board' | 'member'

export const ZONE_ROLES: Record<Zone, readonly Role[]> = {
  person: ['user', 'superadmin'], // ES-334: superadministración entra a toda la plataforma (incl. /app/chat); administración NO entra a las pantallas de persona (conserva «Administración»)
  // ES-359 (M3): pantallas cuyas APIs el servidor SOLO abre a la persona usuaria (contexto, hojas de vida, profesional asignado, sesión, siguiente paso): superadministración no las ve rotas, ve «sin acceso». El servidor no cambió.
  participant: ['user'],
  professional: ['therapist'], // ES-359 (M3): el lado profesional es del profesional; /api/therapist/* responde 403 a superadministración (ES-334 lo dejó cerrado), así que ya no se le muestra el panel roto
  admin: ['admin', 'superadmin'],
  board: ['board', 'superadmin'], // ES-207: la junta ya no edita el manifiesto; su sesión aterriza en la página pública /manifiesto
  member: ['user', 'admin', 'superadmin', 'therapist', 'board'], // cualquier sesión válida (Mis datos, revisiones profesionales)
}

export const canEnter = (role: Role, zone: Zone) => ZONE_ROLES[zone].includes(role)

// ES-359: rutas de /app que dependen de APIs solo-persona (role 'user' en el servidor: /api/user/context, /api/user/resumes, /api/user/resume-skills, /api/sessions/user/*, /api/routes, /api/experiments, /api/career-plan).
const PARTICIPANT_PATHS = ['/app/onboarding', '/app/context', '/app/evidence/resume-skills', '/app/my-therapist', '/app/session', '/app/next-step']

// Rutas de /app y /facilitation que no son solo de la persona usuaria.
const MEMBER_PATHS = ['/app/data', '/app/plan', '/app/professional-reviews', '/facilitation'] // ES-174: «Mi plan» como «Mis datos», para cualquier sesión válida

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Zona de una ruta protegida. Lo no listado es de la persona usuaria (/app) o de administración (/admin). */
export function zoneForPath(pathname: string): Zone | null {
  if (MEMBER_PATHS.some(base => under(pathname, base))) return 'member'
  if (under(pathname, '/admin')) return 'admin'
  if (under(pathname, '/board')) return 'board'
  if (under(pathname, '/therapist')) return 'professional'
  if (PARTICIPANT_PATHS.some(base => under(pathname, base))) return 'participant'
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

/** ES-346: tras pedir la eliminación de la cuenta la sesión local ya se cerró; en la ruta marcada («Mis datos») «login» pasa a «allow» para mostrar el aviso. Nada más cambia. */
export const withFarewell = (decision: GateDecision, farewell: boolean): GateDecision => (decision === 'login' && farewell ? 'allow' : decision)
