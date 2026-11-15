// ES-186 parte D · Diálogo modal accesible de administración (E186-5): role="dialog", aria-modal, nombre accesible, foco atrapado, Esc con modalKeys y el foco
// vuelve al botón que lo abrió. Sin colores nuevos: tokens del sistema de diseño.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { modalKeyDown } from '../../a11y/modalKeys.ts'
import { colors, radius, shadow, spacing, typography } from '../../styles/tokens'

export function AdminDialog({ title, onClose, busy = false, children, width = 460 }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    opener.current = document.activeElement
    const first = ref.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ;(first ?? ref.current)?.focus()
    return () => { if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus() }
  }, [])
  const id = useId()
  // Si el control enfocado desaparece (p. ej. «Desbloquear» tras desbloquear, o el botón que abrió un paso de confirmación), el foco cae al documento: se recupera DENTRO del diálogo.
  useEffect(() => { const root = ref.current; if (root && !root.contains(document.activeElement)) root.focus() })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: spacing.lg }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        onKeyDown={(e) => modalKeyDown(e, ref.current, () => { if (!busy) onClose() })}
        style={{ background: colors.bgCard, borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: shadow.modal, fontFamily: typography.fontBody }}>
        <h2 id={id} style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.2rem', color: colors.text, margin: `0 0 ${spacing.lg}` }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}
