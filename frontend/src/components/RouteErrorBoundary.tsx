import { Component, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { isChunkLoadError } from './chunkError'

// ES-129 (QA-129-02): si falla la descarga de un bloque diferido (404, corte de red o index.html servido en su lugar) la persona ve un aviso
// con «Recargar» en vez de una pantalla en blanco. No se llama preventDefault en vite:preloadError: Vite relanza el error y lo recibe este límite
// (con preventDefault el import() resolvía undefined y la pantalla seguía en blanco). Cualquier otro error de render se relanza tal cual, como antes.
function ReloadNotice() {
  const { t } = useLanguage()
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => { button.current?.focus() }, [])
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="elv-alert w-full max-w-md" role="alert">
        <div className="flex flex-col items-start gap-3">
          <p>{t('route_error')}</p>
          <button ref={button} type="button" className="elv-btn elv-btn-primary min-h-11" onClick={() => window.location.reload()}>{t('route_error_reload')}</button>
        </div>
      </div>
    </div>
  )
}

interface Props { children: ReactNode; resetKey?: string }
interface State { error: unknown; failed: boolean }

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false }
  static getDerivedStateFromError(error: unknown): State { return { error, failed: isChunkLoadError(error) } }
  componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && (this.state.failed || this.state.error)) this.setState({ error: null, failed: false }) }
  render() {
    if (this.state.failed) return <ReloadNotice />
    if (this.state.error) throw this.state.error
    return this.props.children
  }
}
