// ES-186 (parche): qué se le dice a quien invita o envía un enlace, a partir de la respuesta REAL del servidor (sin inventar nada que el servidor no diga).
// Las claves devueltas son textos en español que la pantalla pasa por tr() (el inglés vive en adminCopy.ts).

const INVITE_ERRORS: Record<string, string> = {
  email_taken: 'Ya existe una cuenta con ese correo.',
  invalid_email: 'Correo inválido.',
  role_not_allowed: 'No tienes permiso para invitar con ese rol.',
  rate_limited: 'Demasiadas invitaciones seguidas. Espera un rato.',
}

export type InviteOutcome =
  | { kind: 'error'; message: string }
  | { kind: 'sent'; email: string; expiresAt: string | null }
  | { kind: 'recorded'; message: string }

// POST /api/admin/invitations → 201 { id, email, role, expiresAt, status, emailSent, … } (NUNCA trae el enlace) | 4xx { code, error }.
export function inviteOutcome(status: number, data: Record<string, unknown> | null): InviteOutcome {
  if (status < 200 || status >= 300) {
    const code = typeof data?.code === 'string' ? data.code : ''
    return { kind: 'error', message: INVITE_ERRORS[code] ?? (status === 403 ? INVITE_ERRORS.role_not_allowed : 'No se pudo crear la invitación.') }
  }
  // Solo se afirma que se envió un correo cuando el servidor lo confirma con `emailSent === true`.
  if (data?.emailSent === true && typeof data.email === 'string') return { kind: 'sent', email: data.email, expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null }
  return { kind: 'recorded', message: 'Invitación registrada, pero no se envió ningún correo: el envío de correo no está configurado. La persona todavía no tiene su enlace.' }
}

// POST /api/admin/usuarios/:id/reset-link → 202 { message } (no confirma que el correo salga ni devuelve el enlace) | 403 | 404 | 5xx.
export function resetLinkOutcome(status: number): { ok: boolean; message: string } {
  if (status >= 200 && status < 300) return { ok: true, message: 'Solicitud registrada. Si la cuenta puede recibirlo y el envío de correo está configurado, la persona recibirá el enlace.' }
  if (status === 403) return { ok: false, message: 'Solo la superadministración puede enviar enlaces de restablecimiento.' }
  if (status === 404) return { ok: false, message: 'Usuario no encontrado.' }
  return { ok: false, message: 'No se pudo enviar el enlace.' }
}
