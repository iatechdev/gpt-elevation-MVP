// ES-186 parte D · Lógica PURA de /admin/users (sin React ni red): qué se le dice a quien administra a partir de la respuesta REAL del servidor.
// Los textos son claves en español que la pantalla pasa por tr() (el inglés vive en adminCopy.ts). Se decide por el `code` estable del servidor, nunca por su texto.

export type Role = 'user' | 'therapist' | 'admin' | 'superadmin' | 'board'
export const ROLES: Role[] = ['user', 'therapist', 'admin', 'superadmin', 'board']
// E186-8: nombres de rol traducibles (antes se pintaba el identificador crudo: «user», «therapist»…).
export const ROLE_LABEL: Record<Role, string> = {
  user: 'Persona usuaria', therapist: 'Profesional', admin: 'Administración', superadmin: 'Superadministración', board: 'Junta ética',
}

export type Data = Record<string, unknown> | null
const codeOf = (data: Data) => (typeof data?.code === 'string' ? data.code : '')

// Mensaje por código del servidor (y, si falta, por estado HTTP). 401 no pasa por aquí: la sesión vencida lleva al inicio de sesión (E186-7).
const BY_CODE: Record<string, string> = {
  deletion_pending: 'La cuenta ya tiene una solicitud de eliminación.',
  superadmin_only: 'Solo la superadministración puede hacer esto.',
  superadmin_target: 'No se puede enviar el enlace a otro superadmin: cada superadmin restablece su propia contraseña.',
  target_rank: 'No tienes permisos sobre una cuenta de administración.',
  last_superadmin: 'La plataforma debe conservar al menos una cuenta superadmin activa.',
  has_dependent_data: 'No se puede eliminar: la cuenta tiene datos o vínculos asociados.',
  request_closed: 'Otra persona ya resolvió esta solicitud. La lista se actualizó.',
  invalid_email: 'Correo inválido.',
  email_taken: 'Ya existe una cuenta con ese correo.',
  role_not_allowed: 'No tienes permiso para invitar con ese rol.',
  rate_limited: 'Demasiadas invitaciones seguidas. Espera un rato.',
  invalid_request_id: 'No se pudo crear la invitación. Vuelve a intentarlo.',
  invalid_id: 'No se encontró.',
  not_found: 'No se encontró.',
  person_unavailable: 'Esa persona no puede vincularse ahora.',
}
export function errorMessage(status: number, data: Data = null): string {
  const byCode = BY_CODE[codeOf(data)]
  if (byCode) return byCode
  if (status === 0) return 'Error de conexión.'
  if (status === 403) return 'No tienes permiso para hacer esto.'
  if (status === 404) return 'No se encontró.'
  if (status === 409) return 'La acción entra en conflicto con el estado actual. Actualiza la lista e inténtalo de nuevo.'
  if (status >= 500) return 'El servidor no pudo completar la acción. Inténtalo de nuevo.'
  return 'No se pudo completar la acción.'
}

// ---------------------------------------------------------------- invitar (parte B: requestId idempotente)
export const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/
export function newRequestId(random: () => string = () => crypto.randomUUID()): string {
  const id = random()
  if (!REQUEST_ID.test(id)) throw new Error('requestId inválido')
  return id
}

// Guarda el requestId de UN intento: el mismo para un doble clic o un reintento tras corte de red; nuevo si cambian el correo o el rol, o tras un éxito (E212-2).
export function createAttempt(random?: () => string) {
  let current: { id: string; email: string; role: string } | null = null
  return {
    idFor(email: string, role: string): string {
      const key = { email: email.trim().toLowerCase(), role }
      if (!current || current.email !== key.email || current.role !== key.role) current = { id: newRequestId(random), ...key }
      return current.id
    },
    renew() { current = null },
  }
}

export type InviteResult =
  | { kind: 'error'; message: string; field: 'email' | 'form' }
  | { kind: 'sent'; email: string; expiresAt: string | null }
  | { kind: 'recorded' } // creada, pero el servidor NO confirma que el correo salió
  | { kind: 'already'; email: string } // reintento del MISMO intento: la invitación ya existía y coincide con lo escrito
  | { kind: 'stale' } // el servidor devolvió OTRA invitación (otro correo/rol) o una ya anulada/usada: no es el éxito de lo que se pidió

export function inviteResult(status: number, data: Data, sent: { email: string; role: string }): InviteResult {
  if (status < 200 || status >= 300) {
    const code = codeOf(data)
    return { kind: 'error', message: errorMessage(status, data), field: code === 'invalid_email' || code === 'email_taken' ? 'email' : 'form' }
  }
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : ''
  const matches = email === sent.email.trim().toLowerCase() && data?.role === sent.role && data?.status === 'pending'
  if (!matches) return { kind: 'stale' }
  if (data?.replayed === true) return { kind: 'already', email }
  // Solo se afirma que se envió un correo cuando el servidor lo confirma con `emailSent === true`.
  if (data?.emailSent === true) return { kind: 'sent', email, expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null }
  return { kind: 'recorded' }
}

// ---------------------------------------------------------------- eliminar (parte C)
export type DeleteResult =
  | { kind: 'requested'; repeated: boolean } // personas: solicitud ES-23 (202); la cuenta ya no entra, los datos se borran en el mantenimiento
  | { kind: 'deleted' } // profesional / junta / administración sin dependencias (200)
  | { kind: 'blocked' } // 409 has_dependent_data
  | { kind: 'error'; message: string }
export function deleteResult(status: number, data: Data): DeleteResult {
  if (status === 202 && codeOf(data) === 'deletion_requested') return { kind: 'requested', repeated: data?.repeated === true }
  if (status === 200 && codeOf(data) === 'deleted') return { kind: 'deleted' }
  if (status === 409 && codeOf(data) === 'has_dependent_data') return { kind: 'blocked' }
  if (status >= 200 && status < 300) return { kind: 'error', message: 'No se pudo completar la acción.' } // 2xx inesperado: no se afirma un éxito que el servidor no dijo
  return { kind: 'error', message: errorMessage(status, data) }
}

// ---------------------------------------------------------------- enlace de restablecimiento (E186 A2: se decide por `code`)
export function resetLinkResult(status: number, data: Data): { ok: boolean; message: string } {
  if (status === 202) return { ok: true, message: 'Solicitud registrada. Si la cuenta puede recibirlo y el envío de correo está configurado, la persona recibirá el enlace.' }
  return { ok: false, message: errorMessage(status, data) }
}

// ---------------------------------------------------------------- solicitudes de plan y emparejamientos
export type ResolveResult = { kind: 'ok' } | { kind: 'closed'; message: string } | { kind: 'error'; message: string }
export function resolveResult(status: number, data: Data): ResolveResult {
  if (status >= 200 && status < 300) return { kind: 'ok' }
  if (status === 409 && codeOf(data) === 'request_closed') return { kind: 'closed', message: errorMessage(status, data) }
  return { kind: 'error', message: errorMessage(status, data) }
}

// ---------------------------------------------------------------- lista de personas
export interface Person {
  id: number; name: string; email: string; role: Role; active: boolean; therapistId: number | null; createdAt: string
  plan: { id: number; slug: string; name_es: string; name_en: string } | null
  isLocked: boolean; lockedUntil: string | null; deletionRequested: boolean
}
export type Status = 'active' | 'inactive' | 'locked' | 'deletion'
// «Eliminación solicitada» manda sobre todo; luego inactiva; luego bloqueada (por intentos) y por último activa.
export const statusOf = (p: Pick<Person, 'active' | 'isLocked' | 'deletionRequested'>): Status =>
  (p.deletionRequested ? 'deletion' : !p.active ? 'inactive' : p.isLocked ? 'locked' : 'active')
export const STATUS_LABEL: Record<Status, string> = { active: 'Activa', inactive: 'Inactiva', locked: 'Bloqueada', deletion: 'Eliminación solicitada' }

export function filterPeople(people: Person[], role: string, status: string): Person[] {
  return people.filter((p) => (!role || p.role === role) && (!status || statusOf(p) === status))
}

// Roles que quien administra puede asignar (el servidor es quien decide; esto solo evita ofrecer lo que sabemos que rechaza).
export const assignableRoles = (actor: string): Role[] => (actor === 'superadmin' ? ROLES : ['user', 'therapist'])
export const invitableRoles = assignableRoles

// ---------------------------------------------------------------- textos de la pantalla (claves en español; el inglés vive en adminCopy.ts y una prueba exige que todas lo tengan)
export const TAB_LABEL = { people: 'Personas', matching: 'Emparejamientos', plans: 'Solicitudes de plan' } as const
export const MSG = {
  nameMismatch: 'El nombre no coincide. Escríbelo exactamente como aparece.',
  active: 'La cuenta está activa.',
  deactivated: 'La cuenta quedó desactivada. Sus datos se conservan.',
  unlocked: 'Cuenta desbloqueada.',
  roleSaved: 'Rol actualizado.',
  assigned: 'Profesional actualizado.',
  deletionRepeated: 'La eliminación ya estaba solicitada.',
  deletionRequested: 'Eliminación solicitada. La cuenta ya no puede entrar. Los datos se borran en el proceso de mantenimiento, salvo los que deban conservarse según la política de retención, que está en definición.',
  deleteDialog: 'Se desactivará la cuenta y la persona no podrá entrar. Los datos se borran en el proceso de mantenimiento, salvo los que deban conservarse según la política de retención, que está en definición.',
  deletionLocked: 'La eliminación de esta cuenta ya fue solicitada. No se puede gestionar mientras tanto. Los datos se borran en el proceso de mantenimiento, salvo los que deban conservarse según la política de retención, que está en definición.',
  deleted: 'Cuenta eliminada.',
  deleteBlocked: 'No se puede eliminar: la cuenta tiene datos o vínculos asociados. Puedes desactivarla; sus datos se conservan.',
  inviteStale: 'Esta invitación ya no es válida. Revisa los datos y vuelve a intentarlo.',
  inviteAlready: 'Invitación ya creada para ese correo. Si no llegó, anúlala y crea otra.',
  inviteRecorded: 'Invitación registrada, pero no se envió ningún correo: el envío de correo no está configurado. La persona todavía no tiene su enlace.',
  noEmail: 'Escribe un correo.',
  noReason: 'Escribe el motivo.',
  noMatching: 'No hay emparejamientos pendientes.',
  noPlanRequests: 'No hay solicitudes pendientes.',
  filteredEmpty: 'Ninguna cuenta coincide con los filtros.',
  noAccounts: 'Todavía no hay cuentas.',
} as const

// E186-9: la hora local ya puede terminar en punto («8:01 a. m.»): no se añade otro.
export const endSentence = (text: string) => (text.endsWith('.') ? text : `${text}.`)
