import { useEffect } from 'react'

const SETTLE_LIMIT_MS = 4000

/** Las secciones de la portada llegan en bloques aparte: si la dirección trae un ancla (/#como-funciona, /#privacidad, /#planes), al montarse el bloque se lleva el foco de lectura a ella
 *  (el navegador ya intentó el salto antes de que existiera). Sin ancla o si no existe, no hace nada.
 *  El salto espera a que el catálogo de planes deje de estar «cargando» (máximo 4 s): si el catálogo llega con la ancla ya en pantalla, la sección crece por encima y empuja lo que se está leyendo (E282-1). */
export function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    let done = false
    const settled = () => !document.querySelector('.landing-plan-skeleton')
    const go = () => {
      if (done) return
      done = true; observer.disconnect(); window.clearTimeout(timer)
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    }
    const observer = new MutationObserver(() => { if (settled()) go() })
    const timer = window.setTimeout(go, SETTLE_LIMIT_MS)
    if (settled()) go(); else observer.observe(document.body, { childList: true, subtree: true })
    return () => { done = true; observer.disconnect(); window.clearTimeout(timer) }
  }, [])
}
