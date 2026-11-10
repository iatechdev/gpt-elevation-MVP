// ES-236: teclado común de los diálogos modales hechos con un contenedor (role="dialog" / "alertdialog"): Esc cierra por el mismo camino que «Cancelar»
// y Tab / Shift+Tab ciclan dentro del contenedor. Devolver el foco al botón que abrió el diálogo es cosa de quien lo cierra (cada pantalla ya lo hace en su `close`).
// Los <dialog> nativos (showModal) ya traen Esc y atrapan el foco; no necesitan esto.
import { trapTab } from '../evidence/focusTrap.ts'

type KeyEventLike = { key: string; shiftKey: boolean; preventDefault: () => void; stopPropagation: () => void }

export function modalKeyDown(event: KeyEventLike, container: HTMLElement | null, close: () => void) {
  if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(); return }
  trapTab(event, container)
}
