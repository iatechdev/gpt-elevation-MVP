// ES-359: cerrar sesión desde cualquier menú del marco (menú de cuenta, cajón móvil, menú del chat). Mismo comportamiento que el antiguo «Salir»:
// si una pantalla tiene un borrador sin guardar (leaveGuard), la guardia pregunta y bloquea; si no, revoca la sesión en el servidor, borra la local y vuelve al inicio.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../access/signOut'
import { leaveBlocked } from './leaveGuard'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export function useSignOut(): { leave: () => Promise<void>; leaving: boolean } {
  const navigate = useNavigate(); const [leaving, setLeaving] = useState(false)
  const leave = async () => {
    if (leaving || leaveBlocked('/', 'action')) return
    setLeaving(true)
    await signOut(BACKEND)
    navigate('/', { replace: true })
  }
  return { leave, leaving }
}
