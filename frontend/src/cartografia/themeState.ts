// ES-152: elección de tema claro/oscuro de «Cartografía». Sin elección guardada se respeta prefers-color-scheme (lo resuelve el CSS);
// con elección se fija data-theme. El almacenamiento puede estar bloqueado: la página debe seguir funcionando.
// ES-153 (paso 3): el estado es UNO para toda la página (almacén compartido): el selector del marco, el marco mismo y la página de diseño se ven entre sí
// y entre pestañas (evento «storage»). La lectura es síncrona: el primer pintado ya sale con el tema elegido (sin parpadeo).
import { useSyncExternalStore } from 'react'

export type CgTheme = 'system' | 'light' | 'dark'
const KEY = 'elv_theme'

// Si el almacenamiento no deja escribir, la elección vive en memoria durante la sesión de la pestaña (no se pierde al cambiar de pantalla).
let memory: CgTheme | null = null
const listeners = new Set<() => void>()

export const readTheme = (): CgTheme => {
  if (memory) return memory
  try { const value = localStorage.getItem(KEY); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
}
const saveTheme = (theme: CgTheme): boolean => {
  try { if (theme === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, theme); return true } catch { return false }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { memory = null; listener() } }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

export function setTheme(theme: CgTheme) {
  memory = saveTheme(theme) ? null : theme
  listeners.forEach(listener => listener())
}

export function useCgTheme(): [CgTheme, (theme: CgTheme) => void] {
  return [useSyncExternalStore(subscribe, readTheme, () => 'system'), setTheme]
}
