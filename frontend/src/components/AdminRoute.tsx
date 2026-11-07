import { type ReactNode } from 'react'
import { RoleGate } from '../shell/RoleGate'

// ES-153: administración y superadministración; /admin/manifest exige superadministración (Personas usuarias: admin y superadmin) (shell/access.ts).
// Un rol sin permiso ve la pantalla «Tu rol no tiene acceso a esta pantalla» en vez de una redirección silenciosa.
export function AdminRoute({ children }: { children: ReactNode }) {
  return <RoleGate zone="admin">{children}</RoleGate>
}
