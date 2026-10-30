// ES-112: «Pausar» (decisión D1, aprobada por Mauricio). Solo del lado del cliente: detiene el envío al acompañante hasta que la persona retome.
// No borra nada, no toca el servidor y no cambia el presupuesto. Se conserva al recargar la pestaña (sessionStorage), nunca entre sesiones del navegador.
import { useSyncExternalStore } from 'react'

const KEY = 'elevation_space_paused'
const listeners = new Set<() => void>()
const read = () => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } }
let paused = read()
const emit = () => listeners.forEach(listener => listener())

export function setPaused(value: boolean) {
  paused = value
  try { if (value) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY) } catch { /* sin almacenamiento: la pausa vive en memoria */ }
  emit()
}
export function usePaused() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => paused, () => false)
}
