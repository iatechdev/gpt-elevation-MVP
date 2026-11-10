// ES-177 (B1): cada bloque del panel profesional carga su propio endpoint y falla por separado, con «Reintentar» propio.
// Hasta ahora 4 de 5 cargas tragaban el error en silencio y el bloque quedaba vacío como si no hubiera nada.
import { useCallback, useEffect, useRef, useState } from 'react'

const API = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
const getToken = () => localStorage.getItem('elevation_token') || ''

export type SectionState<T> = {
  status: 'loading' | 'error' | 'ready'
  data: T | null
  /** Vuelve a pedir el bloque. `silent` conserva lo que se ve (para releer tras guardar) en vez de mostrar «Cargando». */
  reload: (options?: { silent?: boolean }) => void
}

export function useSection<T>(path: string): SectionState<T> {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [data, setData] = useState<T | null>(null)
  const [attempt, setAttempt] = useState(0)
  const silent = useRef(false)

  useEffect(() => {
    let cancelled = false
    void fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(async res => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json() as Promise<T>
      })
      .then(value => { if (!cancelled) { setData(value); setStatus('ready') } })
      .catch(() => { if (!cancelled && !silent.current) setStatus('error') })
      .finally(() => { silent.current = false })
    return () => { cancelled = true }
  }, [path, attempt])

  const reload = useCallback((options?: { silent?: boolean }) => {
    silent.current = options?.silent === true
    if (!silent.current) setStatus('loading') // en el manejador, no en el efecto: el primer estado ya es «loading»
    setAttempt(n => n + 1)
  }, [])
  return { status, data, reload }
}
