// ES-152: pestañas y diálogo modal accesibles. Sin texto visible propio ni estilos en línea.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type TabItem = { id: string; label: string; panel: ReactNode }

/** Grupo de pestañas (patrón WAI-ARIA): una sola parada de Tab, flechas / Inicio / Fin para moverse, el panel se enlaza con su pestaña. */
export function Tabs({ tabs, label, defaultId, onChange }: { tabs: TabItem[]; label: string; defaultId?: string; onChange?: (id: string) => void }) {
  const base = useId()
  const [current, setCurrent] = useState(defaultId ?? tabs[0]?.id)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const select = (id: string, focus = false) => {
    setCurrent(id); onChange?.(id)
    if (focus) refs.current[id]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + last) % tabs.length
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    select(tabs[next].id, true)
  }
  return (
    <div>
      <div className="cg-tablist" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id} type="button" role="tab" className="cg-tab" id={`${base}-tab-${tab.id}`} aria-controls={`${base}-panel-${tab.id}`}
            aria-selected={current === tab.id} tabIndex={current === tab.id ? 0 : -1} ref={node => { refs.current[tab.id] = node }}
            onClick={() => select(tab.id)} onKeyDown={event => onKeyDown(event, index)}
          >{tab.label}</button>
        ))}
      </div>
      {tabs.map(tab => (
        <div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`} hidden={current !== tab.id}>{current === tab.id ? tab.panel : null}</div>
      ))}
    </div>
  )
}

/** Diálogo modal sobre <dialog>.showModal(): el foco entra al abrir y vuelve al disparador al cerrar, Tab queda atrapado, Escape cierra
 *  (lo resuelve el padre con `onClose`), aria-modal y el título enlazado con aria-labelledby. El contenido solo existe mientras está abierto. */
export function Dialog({ open, onClose, title, children, actions }: { open: boolean; onClose: () => void; title: string; children?: ReactNode; actions: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  // Tab y Shift+Tab dan la vuelta dentro del diálogo (el <dialog> modal ya vuelve inerte el resto; esto evita que el foco salga a la barra del navegador).
  const trap = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    if (!items.length) { event.preventDefault(); return }
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
    if (!open && opener.current) {
      const target = opener.current; opener.current = null
      if (target.isConnected) target.focus()
    }
  }, [open])
  return (
    <dialog ref={ref} className="cg-dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trap} onCancel={event => { event.preventDefault(); onClose() }}>
      {open && (
        <>
          <h2 className="cg-h2" id={titleId}>{title}</h2>
          {children}
          <div className="cg-dialog__actions">{actions}</div>
        </>
      )}
    </dialog>
  )
}
