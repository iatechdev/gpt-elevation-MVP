// QA-34 obs. 2 y 3: un control deshabilitado debe explicar por qué (aria-describedby). El motivo sale de una función pura para poder probarla.
import type { CopyKey } from './copy'

// Orden de prioridad: guardando, resultado incierto (hay que recuperar), cambios sin guardar. Sin ninguno, el motivo propio del control.
export function blockReason(state: { busy: boolean; uncertain: boolean; dirty: boolean }, own: CopyKey | null = null): CopyKey | null {
  if (state.busy) return 'saving'
  if (state.uncertain) return 'recover'
  if (state.dirty) return 'unsaved'
  return own
}
