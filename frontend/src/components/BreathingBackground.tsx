import { useEffect, useRef } from 'react'

const PALETTE = ['107,125,92', '168,181,162', '214,210,196']

export function BreathingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const circles = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 60 + Math.random() * 120,
      phase: Math.random() * Math.PI * 2,
      dx: (Math.random() - 0.5) * 0.18,
      dy: (Math.random() - 0.5) * 0.12,
      ci: i % 3,
    }))

    let start: number | null = null

    const draw = (ts: number) => {
      if (!start) start = ts
      const elapsed = ts - start
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#f9f9f7'
      ctx.fillRect(0, 0, W, H)

      circles.forEach(c => {
        const pulse = Math.sin(elapsed * 0.0009 + c.phase)
        const r = c.r + pulse * c.r * 0.22
        c.x += c.dx
        c.y += c.dy
        if (c.x < -r * 1.5) c.x = W + r
        if (c.x > W + r * 1.5) c.x = -r
        if (c.y < -r * 1.5) c.y = H + r
        if (c.y > H + r * 1.5) c.y = -r
        const alpha = (0.07 + pulse * 0.02).toFixed(3)
        ctx.beginPath()
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${PALETTE[c.ci]},${alpha})`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}