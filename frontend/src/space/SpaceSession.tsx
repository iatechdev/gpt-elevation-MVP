import type { ReactNode } from 'react'
import { useSpaceToken } from './hooks'
import { SpaceSkip } from './SpaceSkip'
export function SpaceSession({ children }: { children: ReactNode }) {
  const token = useSpaceToken()
  return <div key={token}><SpaceSkip />{children}</div>
}
