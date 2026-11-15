// ES-186: formato de la fecha de caducidad de una invitación. (Los resultados de invitar / restablecer / eliminar viven en adminUsersLogic.ts y se deciden por el `code` del servidor.)
// E186-1: la fecha se muestra COMPLETA (sin recortar ningún carácter del formato local: «7:16 a. m.» / «7:16 AM»).
export function formatExpiry(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}
