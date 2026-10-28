import { useEffect, useState, useSyncExternalStore } from 'react'
import { invalidateStoredSession, readStoredToken, readVerifiedSession, type SessionResult } from './session'

const subscribe = (notify: () => void) => {
  const names = ['storage', 'focus', 'elevation-session-change']
  for (const name of names) window.addEventListener(name, notify)
  return () => { for (const name of names) window.removeEventListener(name, notify) }
}

export function useSessionEntry(baseUrl: string) {
  const token = useSyncExternalStore(subscribe, readStoredToken, () => '')
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ token: string; attempt: number; result: SessionResult } | null>(null)
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    void readVerifiedSession({ baseUrl, token, signal: controller.signal }).then(result => {
      if (controller.signal.aborted || readStoredToken() !== token) return
      if (result.status === 'verified') {
        try { localStorage.setItem('elevation_role', result.session.role) }
        catch { setLoaded({ token, attempt, result: { status: 'unavailable' } }); return }
      }
      setLoaded({ token, attempt, result })
      if (result.status === 'invalid') invalidateStoredSession(token)
    })
    return () => controller.abort()
  }, [baseUrl, token, attempt])
  const result = !token
    ? { status: loaded?.result.status === 'invalid' ? 'invalid' as const : 'anonymous' as const }
    : loaded?.token === token && loaded.attempt === attempt ? loaded.result : { status: 'checking' as const }
  return { result, retry: () => setAttempt(value => value + 1) }
}
