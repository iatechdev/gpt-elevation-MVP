import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { dataCopy } from '../space/dataCopy'
import { sessionCopy } from './sessionCopy'
import { signOut } from './signOut'
import './sessionControl.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

// ES-136: nombre, rol, «Mis datos» y «Cerrar sesión» (con texto, no solo icono) en el encabezado de toda pantalla autenticada.
// `onRequestSignOut` deja que una pantalla pase antes por su despedida (el dashboard de la persona); esa pantalla llama luego a signOut().
export function SessionControl({ name, roleLabel, onRequestSignOut }: { name?: string; roleLabel?: string; onRequestSignOut?: () => void }) {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const c = sessionCopy[lang]
  const leave = async () => {
    if (onRequestSignOut) return onRequestSignOut()
    if (leaving) return
    setLeaving(true)
    await signOut(BACKEND)
    navigate('/', { replace: true })
  }
  return (
    <div className="session-control">
      {name && <span className="session-control-name">{name}</span>}
      {roleLabel && <span className="session-control-role">{roleLabel}</span>}
      <Link className="elv-link session-control-data" to="/app/data">{dataCopy[lang].menu}</Link>
      <button type="button" className="elv-btn elv-btn-outline session-control-out" onClick={() => void leave()} disabled={leaving} aria-busy={leaving}>
        {leaving ? c.signingOut : c.signOut}
      </button>
    </div>
  )
}
