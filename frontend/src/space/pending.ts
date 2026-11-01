// ES-134: el envío sin confirmar sobrevive a navegar y recargar. Solo en sessionStorage de la pestaña, ligado a la sesión (huella del token):
// se descarta al confirmar, al cerrar sesión, al vencer el token y con otra cuenta. Si el almacenamiento no está disponible, no se persiste.
import { makeIntent } from './api.ts'
import type { Intent } from './api.ts'
const KEY = 'elevation_pending_chat'
// Huella de 53 bits del token completo (cyrb53): identifica la sesión sin guardar ningún fragmento del token.
const fingerprint = (token: string) => {
  let a = 0xdeadbeef, b = 0x41c6ce57
  for (let i = 0; i < token.length; i++) { const c = token.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677) }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36)
}
export function savePending(token: string, intent: Intent, store?: Storage) {
  try {
    (store ?? sessionStorage).setItem(KEY, JSON.stringify({ t: fingerprint(token), message: intent.message, lang: intent.lang, requestId: intent.requestId, ids: intent.contextEntryIds ?? [], mode: intent.mode }))
  } catch { /* almacenamiento no disponible */ }
}
export function clearPending(store?: Storage) { try { (store ?? sessionStorage).removeItem(KEY) } catch { /* almacenamiento no disponible */ } }
export function loadPending(token: string, store?: Storage): Intent | null {
  try {
    const raw = (store ?? sessionStorage).getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { t?: unknown; message?: unknown; lang?: unknown; requestId?: unknown; ids?: unknown; mode?: unknown }
    if (!token || v.t !== fingerprint(token)) { clearPending(store); return null }
    if (typeof v.message !== 'string' || typeof v.lang !== 'string' || typeof v.requestId !== 'string' || !Array.isArray(v.ids) || (v.mode != null && v.mode !== 'compass')) throw new Error('shape')
    return makeIntent(v.message, v.lang, v.ids as number[], v.requestId, v.mode ?? undefined)
  } catch { clearPending(store); return null }
}
