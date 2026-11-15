// ES-186 parte D · Red de /admin/users: una sola puerta para llamar al servidor (token, 401 → inicio de sesión) y una carga con estado propio y «Reintentar».
import { useCallback, useEffect, useState } from 'react'
import { invalidateStoredSession, readStoredToken } from '../../access/session.ts'
import type { Data, Person } from './adminUsersLogic.ts'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export type Reply = { status: number; data: Data }
export type Call = () => Promise<Reply>

// status 0 = no hubo respuesta (red). Un 401 invalida la sesión guardada (E186-7): la pantalla vuelve al inicio de sesión en vez de decir «Error de conexión».
export async function adminRequest(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<Reply> {
  const token = readStoredToken()
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    })
    if (res.status === 401) invalidateStoredSession(token)
    const parsed = await res.json().catch(() => null)
    // Un arreglo (las listas) viaja como { value: [...] } para que `data` sea siempre un objeto o null.
    return { status: res.status, data: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Data : parsed === null ? null : { value: parsed } }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error
    return { status: 0, data: null }
  }
}

// Lista con estado propio: cargando / ok / error (cada pestaña falla por separado, nunca se traga el error).
export function useAdminList<T>(path: string, pick: (data: Data) => T[] | null) {
  const [items, setItems] = useState<T[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    adminRequest(path, { signal: controller.signal }).then((reply) => {
      const list = reply.status >= 200 && reply.status < 300 ? pick(reply.data) : null
      if (list) { setItems(list); setState('ok') } else setState('error')
    }).catch(() => { /* cancelada */ })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce])
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const retry = useCallback(() => { setState('loading'); setNonce((n) => n + 1) }, [])
  return { items, state, reload, retry }
}

// El servidor devuelve un arreglo; si llegara otra forma, la sección falla (no se muestra una lista vacía engañosa).
export const asArray = <T,>(data: Data): T[] | null => (Array.isArray(data?.value) ? data!.value as T[] : null)

// Lista de cuentas: una forma distinta hace fallar la sección (no una lista vacía engañosa). `deletionRequested` ausente = false.
export const pickPeople = (data: Data): Person[] | null => {
  const list = asArray<Person>(data)
  return list ? list.map((p) => ({ ...p, deletionRequested: p.deletionRequested === true })) : null
}
