// frontend/src/i18n/serverError.ts
// ES-100 (ES93-B4): los errores del servidor llegan como «texto en español / text in English» (convención del backend) o, los más antiguos, solo en inglés.
// Esta función elige el lado que corresponde al idioma de la persona; si el mensaje no trae los dos lados, se devuelve tal cual.

export function localizeServerError(message: unknown, lang: 'es' | 'en', fallback = ''): string {
  if (typeof message !== 'string' || !message.trim()) return fallback
  const parts = message.split(' / ')
  if (parts.length === 2) return (lang === 'es' ? parts[0] : parts[1]).trim() || fallback
  return message.trim()
}
