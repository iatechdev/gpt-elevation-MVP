// frontend/src/components/BoardRoute.tsx
import { type ReactNode } from 'react'
import { RoleGate } from '../shell/RoleGate'

// ES-153: junta ética y superadministración.
export function BoardRoute({ children }: { children: ReactNode }) {
  return <RoleGate zone="board">{children}</RoleGate>
}
