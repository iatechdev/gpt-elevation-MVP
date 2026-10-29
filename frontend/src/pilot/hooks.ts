import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { registerPilotGuard } from './navigationGuard'
function subscribe(callback: () => void) { window.addEventListener('storage', callback); window.addEventListener('focus', callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener('focus', callback) } }
export function usePilotToken() { return useSyncExternalStore(subscribe, () => localStorage.getItem('elevation_token') || '') }
export function usePilotGuard(active: boolean, message: string) {
  const location = useLocation()
  useEffect(() => {
    if (!active) return
    const cancel = () => !window.confirm(message)
    const remove = registerPilotGuard(cancel)
    const click = (event: MouseEvent) => { const link = event.target instanceof Element ? event.target.closest('a[href]') : null; if (link && !link.getAttribute('href')?.startsWith('#') && !event.defaultPrevented && cancel()) { event.preventDefault(); event.stopImmediatePropagation() } }
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload)
    return () => { remove(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload) }
  }, [active, message, location.key])
}
