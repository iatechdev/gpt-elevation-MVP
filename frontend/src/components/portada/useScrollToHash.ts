import { useEffect } from 'react'

/** Las secciones de la portada llegan en bloques aparte: si la dirección trae un ancla (/#como-funciona, /#privacidad, /#planes), al montarse el bloque se lleva el foco de lectura a ella
 *  (el navegador ya intentó el salto antes de que existiera). Sin ancla o si no existe, no hace nada. */
export function useScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    const target = document.getElementById(id)
    if (target) target.scrollIntoView({ block: 'start' })
  }, [])
}
