import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

// ES-394: política de desplazamiento del hilo del chat. Solo mueve el contenedor del hilo (nunca el marco ni la ventana, que es lo que movía el método anterior).
//  · al enviar, baja al final (indicador «preparando» y avisos a la vista) y sigue ahí;
//  · cuando llega una respuesta: si la persona está al final (margen ≤ 80 px) la sigue; si es más alta que la vista, se muestra desde su INICIO;
//  · si la persona subió a leer algo anterior, NO se la arrastra y aparece el control «Ir al último mensaje».
export const NEAR_BOTTOM_PX = 80
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useThreadScroll(scroller: RefObject<HTMLDivElement | null>, transcript: RefObject<HTMLDivElement | null>, messageCount: number, busy: boolean, loaded: boolean) {
  const following = useRef(true) // la persona está (o pidió estar) al final
  const [away, setAway] = useState(false)
  const seen = useRef(0)
  const initial = useRef(false)
  const wasBusy = useRef(false)
  const userUntil = useRef(0); const lastTop = useRef(0); const programmaticUntil = useRef(0) // los desplazamientos propios (siempre hacia abajo) no cuentan como «la persona subió»
  const behavior = () => (reduced() ? 'auto' : 'smooth') as ScrollBehavior
  const bottom = (smooth: boolean) => {
    const el = scroller.current; if (!el) return
    programmaticUntil.current = Date.now() + 900
    el.scrollTo({ top: el.scrollHeight - el.clientHeight, behavior: smooth ? behavior() : 'auto' })
  }
  // Solo un movimiento HACIA ARRIBA de la persona deja de seguir el final; volver a ≤ 80 px del final lo retoma. Cambiar el alto del contenido no cambia lo que la persona eligió.
  const measure = (scrolled = false) => {
    const el = scroller.current; if (!el) return
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop
    const up = el.scrollTop < lastTop.current; lastTop.current = el.scrollTop
    if (distance <= NEAR_BOTTOM_PX) following.current = true
    else if (scrolled && up && (Date.now() < userUntil.current || Date.now() > programmaticUntil.current)) following.current = false
    setAway(distance > NEAR_BOTTOM_PX)
  }

  // Envío: la persona pidió ver la respuesta, así que se baja al final aunque estuviera arriba.
  useLayoutEffect(() => {
    if (busy && !wasBusy.current) { following.current = true; bottom(true) }
    wasBusy.current = busy
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al cambiar el envío; bottom() solo lee refs

  // Mensajes nuevos: primera carga (sin animación) o respuesta recién llegada.
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return
    if (!loaded) return
    const previous = seen.current; seen.current = messageCount
    if (!initial.current) { initial.current = true; bottom(false); return } // historial recién cargado: al final, sin animar
    if (messageCount === previous) return
    if (messageCount < previous || !following.current) { return } // la persona no está al final: no se la arrastra (el observador del hilo actualiza el control)
    const lastBot = [...el.querySelectorAll<HTMLElement>('.chat-msg--bot')].pop()
    const maxTop = el.scrollHeight - el.clientHeight
    if (!lastBot) { bottom(true); return }
    programmaticUntil.current = Date.now() + 900
    const start = lastBot.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8
    const top = Math.max(0, Math.min(maxTop, start))
    following.current = maxTop - top <= NEAR_BOTTOM_PX // una respuesta larga queda alineada a su inicio: ya no se «pega» al final
    el.scrollTo({ top, behavior: behavior() }) // respuesta larga: desde su inicio; corta: hasta el final
  }, [messageCount, loaded]) // eslint-disable-line react-hooks/exhaustive-deps -- solo cuando cambia el número de mensajes

  // Lo que crece debajo (avisos de estado, error, límite o pausa) mientras se sigue el final se mantiene a la vista.
  useEffect(() => {
    const box = transcript.current; if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => { if (following.current) bottom(false); else measure() })
    observer.observe(box); return () => observer.disconnect()
  }, [transcript]) // eslint-disable-line react-hooks/exhaustive-deps -- el observador se crea una vez; bottom() y measure() solo leen refs

  // El botón se desmonta al llegar al final: el foco pasa antes al hilo (región con tabIndex 0) para no caer a <body> (E394-1).
  const jump = () => { scroller.current?.focus({ preventScroll: true }); following.current = true; bottom(true); setAway(false) }
  const touched = () => { userUntil.current = Date.now() + 1500 } // rueda, dedos, teclas o barra: la persona está moviendo el hilo
  return { onScroll: () => measure(true), onWheel: touched, onTouchMove: touched, onKeyDown: touched, onPointerDown: touched, away, jump }
}
