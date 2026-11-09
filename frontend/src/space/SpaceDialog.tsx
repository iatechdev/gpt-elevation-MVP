import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
// ES-174: diálogo modal sobre <dialog>.showModal(). El foco entra al abrir y vuelve al disparador al cerrar (el navegador lo restaura), Tab da la vuelta dentro
// del diálogo, Escape pide cerrar (el padre decide si puede: no mientras envía) y el título queda enlazado con aria-labelledby.
export function SpaceDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  const trap = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    if (!items.length) { event.preventDefault(); return }
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  return <dialog ref={ref} className="space-dialog" aria-labelledby={titleId} onKeyDown={trap} onCancel={event => { event.preventDefault(); onClose() }}>
    {open && <><h2 id={titleId}>{title}</h2>{children}</>}
  </dialog>
}
