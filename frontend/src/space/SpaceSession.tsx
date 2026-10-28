import type { ReactNode } from 'react'
import { useSpaceToken } from './hooks'
export function SpaceSession({ children }: { children: ReactNode }) {
  const token = useSpaceToken()
  return <div key={token}>{children}</div>
}
