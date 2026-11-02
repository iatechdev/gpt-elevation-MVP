// ES-112: estado compartido del uso de IA (lo leen la barra y el campo de escritura).
import { useSyncExternalStore } from 'react'
import { usePaused } from './pause'
import { request } from './api'
import { isExhausted, parseUsage } from './usage'
import type { Usage } from './usage'

export type UsageState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; usage: Usage }
let state: UsageState = { status: 'loading' }
const listeners = new Set<() => void>()
export const publish = (next: UsageState) => { state = next; listeners.forEach(listener => listener()) }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const useUsageState = () => useSyncExternalStore(subscribe, () => state, () => state)
// La conversación se bloquea solo si el servidor dice que el límite se agotó; sin dato no se bloquea (el servidor sigue siendo quien rechaza).
export const useChatBlocked = () => { const paused = usePaused(); const s = useUsageState(); return { paused, exhausted: s.status === 'ready' && isExhausted(s.usage) } }

const fetchUsage = async (token: string): Promise<Usage> => parseUsage(await request(token, '/api/ai/usage'))

export function load(token: string, isActive: () => boolean = () => true) {
  fetchUsage(token).then(usage => { if (isActive()) publish({ status: 'ready', usage }) }).catch(() => { if (isActive()) publish({ status: 'error' }) })
}

