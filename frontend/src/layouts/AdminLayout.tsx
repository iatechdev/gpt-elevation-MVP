import { Outlet } from 'react-router-dom'
import { AdminFrame } from '../shell/frames'
import '../styles/accessAdmin.css'

// ES-153: marco de administración (barra lateral por rol, «Saltar al contenido», un solo <main>, aviso del pie).
export function AdminLayout({ pilotPreview = false }: { pilotPreview?: boolean }) {
  return <AdminFrame pilotPreview={pilotPreview}><Outlet /></AdminFrame>
}
