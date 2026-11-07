// ES-152: elección de tema claro/oscuro de «Cartografía». Sin elección guardada se respeta prefers-color-scheme (lo resuelve el CSS);
// con elección se fija data-theme. El almacenamiento puede estar bloqueado: la página debe seguir funcionando.
import { useState } from 'react'

export type CgTheme = 'system' | 'light' | 'dark'
const KEY = 'elv_theme'

export const readTheme = (): CgTheme => {
  try { const value = localStorage.getItem(KEY); return value === 'light' || value === 'dark' ? value : 'system' } catch { return 'system' }
}
const saveTheme = (theme: CgTheme) => {
  try { if (theme === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, theme) } catch { /* sin persistencia */ }
}

export function useCgTheme(): [CgTheme, (theme: CgTheme) => void] {
  const [theme, set] = useState<CgTheme>(readTheme)
  return [theme, next => { set(next); saveTheme(next) }]
}
