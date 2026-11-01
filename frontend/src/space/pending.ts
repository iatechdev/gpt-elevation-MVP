// ES-134: el envío sin confirmar sobrevive a navegar y recargar. Solo en sessionStorage de la pestaña, ligado a la sesión (huella del token):
// se descarta al confirmar, al cerrar sesión, al vencer el token y con otra cuenta. Si el almacenamiento no está disponible, no se persiste.
import { makeIntent } from './api.ts'
import type { Intent } from './api.ts'
const KEY = 'elevation_pending_chat'
const fingerprint = (token: string) => token.slice(-24)
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
