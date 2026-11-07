// ES-153: pantallas de la compuerta de acceso: verificando, sin conexión con el servidor y «tu rol no tiene acceso» (no es una redirección silenciosa).
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { sessionDestination, type SessionInfo } from '../access/session'
import { Button } from '../cartografia/controls'
import { Banner } from '../cartografia/pieces'
import { CartografiaRoot } from '../cartografia/theme'
import { shellCopy } from './copy'
import './shell.css'

export function GateStatus({ kind, onRetry }: { kind: 'checking' | 'unavailable'; onRetry?: () => void }) {
  const { lang } = useLanguage(); const c = shellCopy[lang]
  return (
    <CartografiaRoot theme="light">
      <main className="cg-gate" id="main">
        {kind === 'checking'
          ? <p role="status" aria-live="polite" className="cg-muted">{c.checking}</p>
          : <Banner kind="error" title={c.unavailable}><p>{c.unavailableBody}</p><div className="cg-row"><Button onClick={onRetry}>{c.retry}</Button></div></Banner>}
      </main>
    </CartografiaRoot>
  )
}

/** «Tu rol no tiene acceso a esta pantalla», con enlace al inicio que sí le corresponde. El servidor responde 403 a la API de esta pantalla. */
export function NoAccess({ session }: { session: SessionInfo }) {
  const { lang } = useLanguage(); const c = shellCopy[lang]
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])
  return (
    <CartografiaRoot theme="light">
      <main className="cg-gate" id="main">
        <div className="cg-banner cg-banner--error" role="alert">
          <h1 className="cg-banner__title cg-gate__title" ref={heading} tabIndex={-1}>{c.noAccess}</h1>
          <p>{c.noAccessBody}</p>
          <div className="cg-row"><Link className="cg-btn cg-btn--ghost" to={sessionDestination(session)}>{c.goHome}</Link></div>
        </div>
      </main>
    </CartografiaRoot>
  )
}
