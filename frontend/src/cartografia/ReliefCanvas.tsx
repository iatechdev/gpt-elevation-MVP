// ES-152: relieve del mapa en canvas. Redibuja al cambiar de tamaño y de tema. Con `loading` muestra el relieve de espera (la animación se apaga con prefers-reduced-motion).
import { useEffect, useRef } from 'react'
import { paintRelief, reliefField, type ReliefPoint } from './relief'

export function ReliefCanvas({ points, label, decor = false, loading = false }: { points: ReliefPoint[]; label: string; decor?: boolean; loading?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || loading) return
    const field = reliefField(points, decor)
    const options = decor ? { levels: 9, step: 0.07, heavy: 3, cell: 8 } : { levels: 8, step: 0.125, heavy: 2, cell: 6 }
    const draw = () => {
      const style = getComputedStyle(canvas)
      paintRelief(canvas, field, options, { contour: style.getPropertyValue('--cg-contour').trim(), soft: style.getPropertyValue('--cg-contour-soft').trim() })
    }
    draw()
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw)
    resize?.observe(canvas)
    const root = canvas.closest('.cg')
    const theme = typeof MutationObserver === 'undefined' || !root ? null : new MutationObserver(draw)
    if (theme && root) theme.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener('change', draw)
    return () => { resize?.disconnect(); theme?.disconnect(); scheme?.removeEventListener('change', draw) }
  }, [points, decor, loading])
  return (
    <div className={loading ? 'cg-relief cg-relief--loading' : 'cg-relief'} role="img" aria-label={label}>
      {!loading && <canvas ref={ref} aria-hidden="true" />}
    </div>
  )
}
