import type { ReactNode } from 'react'
import { useSpaceToken } from './hooks'
import { SpaceSkip } from './SpaceNav'
export function SpaceSession({ children }: { children: ReactNode }) {
  const token = useSpaceToken()
  return <div key={token}><SpaceSkip />{children}</div>
}
