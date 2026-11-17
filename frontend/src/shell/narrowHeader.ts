// ES-321 (E297-1): ¿el encabezado está en su disposición móvil? Es el mismo corte que el CSS de shell.css (max-width: 900px).
// Lectura síncrona al montar (useSyncExternalStore): el primer pintado ya tiene el orden correcto, sin parpadeo. Sin matchMedia (pruebas, navegadores raros) = escritorio.
import { useSyncExternalStore } from 'react'

export const NARROW_HEADER_QUERY = '(max-width: 900px)'
const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
const subscribe = (notify: () => void) => {
  if (!supported()) return () => {}
  const query = window.matchMedia(NARROW_HEADER_QUERY)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const read = () => supported() && window.matchMedia(NARROW_HEADER_QUERY).matches
export const useNarrowHeader = () => useSyncExternalStore(subscribe, read, () => false)
