// ES-359 (PR4): una pantalla puede añadir contenido propio ARRIBA del cajón móvil del marco (el chat: su grupo «Conversación») sin que el marco la conozca.
// Mismo patrón que leaveGuard: la pantalla se registra al montar y se retira al salir. `omit`: rutas que el cajón no repite porque ya están en ese contenido.
import { useSyncExternalStore, type ReactNode } from 'react'

export type DrawerExtra = { render: (close: () => void) => ReactNode; omit?: readonly string[] }

let current: DrawerExtra | null = null
const listeners = new Set<() => void>()
const notify = () => { for (const listener of [...listeners]) listener() }

export function registerDrawerExtra(extra: DrawerExtra) {
  current = extra; notify()
  return () => { if (current === extra) { current = null; notify() } }
}

export const useDrawerExtra = (): DrawerExtra | null => useSyncExternalStore(
  listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
  () => current,
  () => null,
)

// Una pantalla sin cabecera propia del marco (el chat a ≤ 900 px la oculta: su barra lleva el «☰») pide abrir el cajón del marco y le dice qué botón lo abrió, para devolverle el foco al cerrar.
const requesters = new Set<(opener: HTMLElement | null) => void>()
export const requestDrawer = (opener: HTMLElement | null) => { for (const fn of [...requesters]) fn(opener) }
export function onDrawerRequest(fn: (opener: HTMLElement | null) => void) { requesters.add(fn); return () => { requesters.delete(fn) } }
