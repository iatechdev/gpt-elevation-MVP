import type { ReactNode } from 'react'
import { useSpaceToken } from './hooks'
// ES-153 (paso 1): «Saltar al contenido» lo pone el marco de persona; aquí solo se reinicia la pantalla al cambiar de sesión.
export function SpaceSession({ children }: { children: ReactNode }) {
  const token = useSpaceToken()
  return <div key={token}>{children}</div>
}
