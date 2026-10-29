import { useEffect, useRef, useState } from 'react'
import { invalidateStoredSession, readStoredToken } from '../access/session'
import { PlansError, readPending, readPlans, requestPlan, type PendingRequest, type Plan } from './plans'

export function usePlans(base: string) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ attempt: number; plans: Plan[]; failed: boolean } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void readPlans(base, controller.signal).then(plans => {
      if (!controller.signal.aborted) setLoaded({ attempt, plans, failed: false })
    }).catch(() => { if (!controller.signal.aborted) setLoaded({ attempt, plans: [], failed: true }) })
    return () => controller.abort()
  }, [base, attempt])
  useEffect(() => {
    const focus = () => setAttempt(value => value + 1)
    window.addEventListener('focus', focus)
    return () => window.removeEventListener('focus', focus)
  }, [])
  return { state: loaded?.attempt === attempt ? loaded.failed ? 'error' as const : 'ready' as const : 'loading' as const,
    plans: loaded?.attempt === attempt ? loaded.plans : [], refresh: () => setAttempt(value => value + 1) }
}

type WriteState = 'idle' | 'sending' | 'submitted' | 'pending' | 'unknown' | 'unavailable'
export function usePlanRequests(base: string, verified: boolean, token: string) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ token: string; attempt: number; pending: PendingRequest | null; failed: boolean } | null>(null)
  const [write, setWrite] = useState<{ token: string; state: WriteState }>({ token: '', state: 'idle' })
  const running = useRef(new Set<string>())
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!verified || !token) return
    const controller = new AbortController()
    void readPending(base, token, controller.signal).then(pending => {
      if (!controller.signal.aborted && readStoredToken() === token) setLoaded({ token, attempt, pending, failed: false })
    }).catch(error => {
      if (controller.signal.aborted || readStoredToken() !== token) return
      if (error instanceof PlansError && [401, 403].includes(error.status)) invalidateStoredSession(token)
      setLoaded({ token, attempt, pending: null, failed: true })
    })
    return () => controller.abort()
  }, [base, token, verified, attempt])
  const ready = verified && loaded?.token === token && loaded.attempt === attempt && !loaded.failed
  const failed = verified && loaded?.token === token && loaded.attempt === attempt && loaded.failed
  const pending = ready ? loaded.pending : null
  const state = write.token === token && verified ? write.state : 'idle'
  const refresh = () => { setWrite({ token, state: 'idle' }); setAttempt(value => value + 1) }
  const send = async (planId: number) => {
    if (!ready || pending || running.current.has(token) || readStoredToken() !== token) return false
    running.current.add(token)
    setWrite({ token, state: 'sending' })
    const current = () => mounted.current && readStoredToken() === token
    try {
      const created = await requestPlan(base, token, planId)
      if (current()) { setLoaded({ token, attempt, pending: created, failed: false }); setWrite({ token, state: 'submitted' }) }
    } catch (error) {
      if (!current()) return false
      if (error instanceof PlansError && [401, 403].includes(error.status)) { invalidateStoredSession(token); return false }
      // POST may have committed even if its acknowledgement was lost. Reconcile, never retry blindly.
      try {
        const found = await readPending(base, token)
        if (current()) {
          const knownRejection = error instanceof PlansError && [400, 404].includes(error.status)
          setLoaded({ token, attempt, pending: found, failed: !found && !knownRejection })
          setWrite({ token, state: found ? 'pending' : knownRejection ? 'unavailable' : 'unknown' })
          return knownRejection
        }
      } catch (checkError) {
        if (current()) {
          if (checkError instanceof PlansError && [401, 403].includes(checkError.status)) invalidateStoredSession(token)
          setLoaded({ token, attempt, pending: null, failed: true }); setWrite({ token, state: 'unknown' })
        }
      }
    } finally { running.current.delete(token) }
    return false
  }
  return { ready, failed, pending, state, send, refresh }
}
