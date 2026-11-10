import { Component, useEffect, useRef, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { classifyFailure, safeBoundaryLog } from './chunkError'
import type { FailureKind } from './chunkError'

// ES-129 (QA-129-02): si falla la descarga de un bloque diferido (404, corte de red o index.html servido en su lugar) la persona ve un aviso
// con «Recargar» en vez de una pantalla en blanco. No se llama preventDefault en vite:preloadError: Vite relanza el error y lo recibe este límite
// (con preventDefault el import() resolvía undefined y la pantalla seguía en blanco).
// ES-250: además (1) un error REAL de código al renderizar ya no deja el cuerpo en blanco: aviso recuperable con «Reintentar» (manual, sin bucles);
// (2) el aviso de descarga distingue «Sin conexión» de «Hay una versión nueva»; (3) <SectionBoundary> aísla bloques independientes de una pantalla.
// Un límite de error solo atrapa errores de render/ciclo de vida: no los de manejadores de eventos ni asíncronos.
type Scope = 'route' | 'section'
function FailureNotice({ kind, scope, onRetry, takeFocus }: { kind: FailureKind; scope: Scope; onRetry: () => void; takeFocus: boolean }) {
  const { t } = useLanguage()
  const button = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (takeFocus) button.current?.focus() }, [takeFocus])
  useEffect(() => { if (!busy) return; const timer = window.setTimeout(() => setBusy(false), 600); return () => window.clearTimeout(timer) }, [busy])
  const retry = kind === 'code'
  const text = kind === 'offline' ? t('route_error_offline') : kind === 'version' ? t('route_error') : kind === 'resource' ? t('route_error_resource') : scope === 'section' ? t('route_error_section') : t('route_error_screen')
  return (
    <div className={scope === 'route' ? 'flex min-h-[40vh] items-center justify-center px-4' : 'flex items-center justify-center px-4 py-6'}>
      <div className="elv-alert w-full max-w-md" role="alert">
        <div className="flex flex-col items-start gap-3">
          <p>{text}</p>
          <button ref={button} type="button" className="elv-btn elv-btn-primary min-h-11" disabled={busy}
            onClick={() => { if (retry) { setBusy(true); onRetry() } else window.location.reload() }}>{t(retry ? 'route_error_retry' : 'route_error_reload')}</button>
        </div>
      </div>
    </div>
  )
}

interface Props { children: ReactNode; resetKey?: string; scope?: Scope }
interface State { error: unknown; kind: FailureKind | null; hadFocus: boolean }

abstract class Boundary extends Component<Props, State> {
  state: State = { error: null, kind: null, hadFocus: false }
  static getDerivedStateFromError(error: unknown): Partial<State> { return { error, kind: classifyFailure(error) } }
  componentDidCatch(error: unknown, info: ErrorInfo) { console.error(...safeBoundaryLog(error, info.componentStack, window.location.pathname)) }
  componentDidUpdate(prev: Props) { if (prev.resetKey !== this.props.resetKey && this.state.kind) this.setState({ error: null, kind: null }) }
  retry = () => this.setState({ error: null, kind: null })
}

export class RouteErrorBoundary extends Boundary {
  render() {
    if (this.state.kind) return <FailureNotice kind={this.state.kind} scope="route" onRetry={this.retry} takeFocus />
    return this.props.children
  }
}

// Aísla un bloque: si falla, solo ese bloque se sustituye por el aviso y el resto de la pantalla sigue viva. El envoltorio no cambia el diseño (display: contents).
// El foco solo pasa al aviso si estaba dentro del bloque que falló.
export class SectionBoundary extends Boundary {
  focusInside = false
  render() {
    if (this.state.kind) return <FailureNotice kind={this.state.kind} scope="section" onRetry={this.retry} takeFocus={this.focusInside} />
    return <div className="contents" onFocusCapture={() => { this.focusInside = true }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget) this.focusInside = false }}>{this.props.children}</div>
  }
}
