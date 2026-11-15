import { Outlet, useLocation } from 'react-router-dom'
import { AdminFrame } from '../shell/frames'
import { isMigratedAdminPath } from '../shell/adminLayoutState'
import '../styles/accessAdmin.css'

// ES-153: marco de administración (barra lateral por rol, «Saltar al contenido», un solo <main>, aviso del pie).
// ES-310: las pantallas ya migradas a Cartografía (lista en shell/adminLayoutState.ts) usan el tema claro/oscuro del sistema; la prop `pilotPreview` (ES-183) no cambia.
export function AdminLayout({ pilotPreview = false }: { pilotPreview?: boolean }) {
  const { pathname } = useLocation()
  return <AdminFrame pilotPreview={pilotPreview} migrated={isMigratedAdminPath(pathname)}><Outlet /></AdminFrame>
}
