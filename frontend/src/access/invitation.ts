// ES-326: aceptar una invitación (pantalla pública /accept-invitation). El token viaja en el fragmento (#token=...), como el de restablecer contraseña.
import { readResetToken } from './passwordReset.ts'

export const readInvitationToken = readResetToken

export type InvitationFailure = 'password_policy' | 'invitation_invalid' | 'terms' | 'terms_changed' | 'rate_limited' | 'failed'

// Qué mensaje corresponde a una respuesta rechazada de POST /api/invitations/accept. Los 400 de aceptación son los mismos del registro (ES-301).
export function invitationFailure(status: number, code: unknown): InvitationFailure {
  if (code === 'password_policy') return 'password_policy'
  if (code === 'invitation_invalid') return 'invitation_invalid'
  if (code === 'terms_version_mismatch') return 'terms_changed'
  if (code === 'terms_required' || code === 'terms_not_accepted' || code === 'terms_version_invalid') return 'terms'
  if (status === 429) return 'rate_limited'
  return 'failed'
}
