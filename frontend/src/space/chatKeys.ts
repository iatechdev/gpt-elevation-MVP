// ES-162: reglas puras del chat que no dependen de React (se prueban sin navegador).

/** Pasados estos milisegundos esperando la respuesta se avisa de la demora y se ofrece «Dejar de esperar». Aprobado por Mauricio: 15 s (el servidor espera hasta 60 s por intento). */
export const SLOW_AFTER_MS = 15000

type KeyLike = { key: string; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; isComposing?: boolean; keyCode?: number }

/**
 * ¿Esta pulsación envía el mensaje? Solo con la preferencia activada: Enter solo. Shift+Enter (y Ctrl/Alt/Meta+Enter) dejan el comportamiento nativo (salto de línea),
 * y durante la composición de un IME (japonés, chino, coreano, acentos muertos) Enter confirma el texto compuesto y NUNCA envía (`isComposing` o `keyCode` 229).
 */
export function enterShouldSend(event: KeyLike, enabled: boolean): boolean {
  return enabled && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && event.keyCode !== 229
}

const ENTER_KEY = 'elevation_chat_enter_sends'

/** Preferencia «Enter envía» de esta persona en este navegador: comodidad, no dato personal. Por defecto DESACTIVADA; si el almacenamiento falla, queda desactivada. */
export function readEnterSends(store?: Pick<Storage, 'getItem'>): boolean {
  try { return (store ?? localStorage).getItem(ENTER_KEY) === '1' } catch { return false }
}
export function writeEnterSends(enabled: boolean, store?: Pick<Storage, 'setItem' | 'removeItem'>): void {
  try { const s = store ?? localStorage; if (enabled) s.setItem(ENTER_KEY, '1'); else s.removeItem(ENTER_KEY) } catch { /* almacenamiento no disponible: la preferencia vale solo en esta pantalla */ }
}

/** Un fallo de `fetch` sin respuesta (red caída, DNS, CORS): TypeError. La cancelación pedida por la persona (AbortError) NO cuenta como falta de conexión. */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false
  return error instanceof TypeError // `fetch` rechaza con TypeError cuando no hay respuesta (también con el navegador sin conexión)
}
