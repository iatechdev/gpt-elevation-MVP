import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { registerSpaceGuard } from './navigationGuard'
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener); window.addEventListener('focus', listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('focus', listener) }
}
export function useSpaceToken() { return useSyncExternalStore(subscribe, () => localStorage.getItem('elevation_token') || '') }
export function useDraftGuard(dirty: boolean, message: string) {
  const location = useLocation()
  useEffect(() => {
    if (!dirty) return
    const cancel = () => !window.confirm(message)
    const unregister = registerSpaceGuard(cancel)
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (link && !link.getAttribute('href')?.startsWith('#') && !event.defaultPrevented && cancel()) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    document.addEventListener('click', click, true); window.addEventListener('beforeunload', unload)
    return () => { unregister(); document.removeEventListener('click', click, true); window.removeEventListener('beforeunload', unload) }
  }, [dirty, message, location.key])
}
