import { useEffect } from 'react'

const SETTLE_LIMIT_MS = 4000

/** Las secciones de la portada llegan en bloques aparte: si la dirección trae un ancla (/#como-funciona, /#privacidad, /#planes), al montarse el bloque se lleva el foco de lectura a ella
 *  (el navegador ya intentó el salto antes de que existiera). Sin ancla o si no existe, no hace nada.
 *  El salto espera a que el catálogo de planes deje de estar «cargando» (máximo 4 s) y se hace DOS cuadros después: si crece la sección en el mismo cuadro del salto,
 *  lo que queda en pantalla cuenta como desplazado aunque la persona nunca lo viera en su sitio anterior (E282-1). */
export function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    let done = false; let frame = 0; let frame2 = 0
    const settled = () => !document.querySelector('.landing-plan-skeleton')
    const scroll = () => { document.getElementById(id)?.scrollIntoView({ block: 'start' }) }
    const go = () => {
      if (done) return
      done = true; observer.disconnect(); window.clearTimeout(timer)
      frame = window.requestAnimationFrame(() => { frame2 = window.requestAnimationFrame(scroll) })
    }
    const observer = new MutationObserver(() => { if (settled()) go() })
    const timer = window.setTimeout(go, SETTLE_LIMIT_MS)
    if (settled()) go(); else observer.observe(document.body, { childList: true, subtree: true })
    return () => { done = true; observer.disconnect(); window.clearTimeout(timer); window.cancelAnimationFrame(frame); window.cancelAnimationFrame(frame2) }
  }, [])
}
