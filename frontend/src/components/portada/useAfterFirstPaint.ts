import { useEffect, useState } from 'react'

const DEFER_MS = 300

/** El canvas decorativo espera al reposo del navegador (tope 300 ms): el texto y los botones de la portada no compiten con su pintado. */
export function useAfterFirstPaint() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const idle = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (idle.requestIdleCallback) { const id = idle.requestIdleCallback(() => setReady(true), { timeout: DEFER_MS }); return () => idle.cancelIdleCallback?.(id) }
    const id = window.setTimeout(() => setReady(true), 0)
    return () => window.clearTimeout(id)
  }, [])
  return ready
}
