// frontend/src/i18n/serverError.ts
// ES-100 (ES93-B4): los errores del servidor llegan como «texto en español / text in English» (convención del backend) o, los más antiguos, solo en inglés.
// En español, un mensaje solo en inglés se traduce si es uno de los conocidos y, si no, se usa el texto de respaldo de la pantalla: la persona nunca ve inglés suelto.
const KNOWN_ES: Record<string, string> = {
  'Session not found.': 'No se encontró la sesión.',
  'Could not join session.': 'No pudimos unirte a la sesión.',
  'Could not start session.': 'No pudimos iniciar la sesión.',
  'Could not end session.': 'No pudimos finalizar la sesión.',
  'Could not create session.': 'No pudimos crear la sesión.',
  'Could not update session.': 'No pudimos actualizar la sesión.',
  'Could not generate summary.': 'No pudimos generar el resumen.',
  'Could not save note.': 'No pudimos guardar la nota.',
  'Could not update note.': 'No pudimos actualizar la nota.',
  'Meeting URL not available yet.': 'El enlace de la videollamada aún no está disponible.',
  'Session has not started yet.': 'La sesión todavía no ha comenzado.',
  'Session is not in progress.': 'La sesión no está en curso.',
  'Cannot edit a completed session.': 'No se puede editar una sesión finalizada.',
  'Note content is required.': 'La nota no puede estar vacía.',
  'Note not found or not authorized.': 'No se encontró la nota o no tienes acceso.',
  'Patient not found or not assigned to you.': 'No se encontró a la persona o no está asignada a ti.',
  'This patient is not assigned to you.': 'Esta persona no está asignada a ti.',
  'Therapists only.': 'Solo para terapeutas.',
  'Users only.': 'Solo para personas usuarias.',
  'AI usage limit reached.': 'Se alcanzó el límite de uso de IA del periodo.',
}

export function localizeServerError(message: unknown, lang: 'es' | 'en', fallback = ''): string {
  if (typeof message !== 'string' || !message.trim()) return fallback
  const parts = message.split(' / ')
  if (parts.length === 2) return (lang === 'es' ? parts[0] : parts[1]).trim() || fallback
  const text = message.trim()
  if (lang === 'en') return text
  if (KNOWN_ES[text]) return KNOWN_ES[text]
  if (/^Could not fetch /.test(text)) return fallback || 'No pudimos cargar la información. Intenta de nuevo.'
  return fallback // en español, un mensaje solo en inglés que no conocemos no se muestra tal cual
}
