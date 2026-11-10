import { Component, createRef, useEffect, useRef, useState } from 'react'
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

// ES-256: tras «Reintentar» con éxito el aviso (y su botón con el foco) se desmonta y el foco caía a body: se coloca en un elemento estable DESPUÉS de renderizar.
// Solo ocurre tras un reintento con éxito: un cambio de ruta que limpia el aviso no mueve el foco.
const FOCUSABLE = 'button, a[href], input, select, textarea'
function focusStable(target: Element | null) {
  const element = target as HTMLElement | null
  if (!element) return
  if (!element.matches(FOCUSABLE) && !element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1')
  element.focus()
}

abstract class Boundary extends Component<Props, State> {
  state: State = { error: null, kind: null, hadFocus: false }
  recovering = false
  static getDerivedStateFromError(error: unknown): Partial<State> { return { error, kind: classifyFailure(error) } }
  componentDidCatch(error: unknown, info: ErrorInfo) { this.recovering = false; console.error(...safeBoundaryLog(error, info.componentStack, window.location.pathname)) }
  componentDidUpdate(prev: Props, prevState: State) {
    if (prev.resetKey !== this.props.resetKey && this.state.kind) { this.recovering = false; this.setState({ error: null, kind: null }); return }
    if (prevState.kind && !this.state.kind && this.recovering) { this.recovering = false; this.refocus() }
  }
  retry = () => { this.recovering = true; this.setState({ error: null, kind: null }) }
  abstract refocus(): void
}

export class RouteErrorBoundary extends Boundary {
  // La pantalla puede ser un bloque diferido que aún está bajando cuando el límite se limpia: se espera (hasta ~3 s) a que exista su título o región principal.
  refocus() {
    let tries = 0
    const attempt = () => {
      const target = document.querySelector('h1') ?? (tries > 20 ? document.querySelector('main') : null)
      if (target) {
        focusStable(target)
        // si la pantalla se vuelve a montar (p. ej. al terminar de cargar sus datos) y el foco cae a body, se repite una vez
        if (tries < 25) { tries = 25; window.setTimeout(() => { if (document.activeElement === document.body) focusStable(document.querySelector('h1') ?? document.querySelector('main')) }, 500) }
        return
      }
      if (++tries < 30) window.setTimeout(attempt, 100)
    }
    attempt()
  }
  render() {
    if (this.state.kind) return <FailureNotice kind={this.state.kind} scope="route" onRetry={this.retry} takeFocus />
    return this.props.children
  }
}

// Aísla un bloque: si falla, solo ese bloque se sustituye por el aviso y el resto de la pantalla sigue viva. El envoltorio no cambia el diseño (display: contents).
// El foco solo pasa al aviso si estaba dentro del bloque que falló.
export class SectionBoundary extends Boundary {
  focusInside = false
  wrapper = createRef<HTMLDivElement>()
  refocus() { focusStable(this.wrapper.current?.querySelector(`h2, h3, [tabindex="-1"], ${FOCUSABLE}`) ?? null) }
  render() {
    if (this.state.kind) return <FailureNotice kind={this.state.kind} scope="section" onRetry={this.retry} takeFocus={this.focusInside} />
    return <div ref={this.wrapper} className="contents" onFocusCapture={() => { this.focusInside = true }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null) && event.relatedTarget) this.focusInside = false }}>{this.props.children}</div>
  }
}
