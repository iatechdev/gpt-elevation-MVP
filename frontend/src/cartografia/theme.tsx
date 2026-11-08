// ES-152: raíz del sistema «Cartografía»: aplica los tokens (.cg) y, si la persona eligió tema, data-theme.
import type { ReactNode } from 'react'
import type { CgTheme } from './themeState'

export function CartografiaRoot({ theme = 'system', className, children }: { theme?: CgTheme; className?: string; children: ReactNode }) {
  return <div className={className ? `cg ${className}` : 'cg'} data-theme={theme === 'system' ? undefined : theme}>{children}</div>
}
