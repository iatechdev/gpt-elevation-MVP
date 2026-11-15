import type { ReactNode } from 'react'
import './space.css'
// ES-153 (paso 1): el encabezado, el idioma, la navegación y «Saltar al contenido» ya los pone el marco de persona (PersonLayout). Esto es solo el contenido de la pantalla.
export function SpaceShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-scope space-page ${className}`}><div className="space-body">{children}</div></div>
}
