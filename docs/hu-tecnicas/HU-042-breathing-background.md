# HU-042 — BreathingBackground: fondo animado global

> Sprint 3 | Must Have | 3 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como usuario, quiero ver un fondo animado sutil en todas las pantallas de Elevation que transmita calma y tranquilidad, reforzando la experiencia emocional del producto.

---

## Concepto visual

Círculos que "respiran" (expand/contract) con movimiento lento de deriva (drift). Cada círculo tiene su propia fase de respiración, por lo que el conjunto nunca se ve mecánico ni sincronizado.

- **Colores:** paleta olive/sage del design system
- **Opacidad:** muy baja (0.06 – 0.14) — el contenido siempre tiene prioridad
- **Velocidad:** lenta, relajante
- **Tecnología:** Canvas HTML5 + `requestAnimationFrame`
- **Librerías:** ninguna — zero dependencies

---

## Criterios de aceptación

- [ ] Componente `BreathingBackground.tsx` funcional
- [ ] Presente en todas las pantallas: Landing, Login, Check-in, Chat, Precios
- [ ] Se adapta al tamaño del viewport (responsive)
- [ ] No afecta el rendimiento: máximo 2% CPU en idle
- [ ] No interfiere con la interacción del usuario (`pointer-events: none`)
- [ ] Se detiene correctamente al desmontar el componente (cleanup del `requestAnimationFrame`)
- [ ] Funciona en modo claro y oscuro
- [ ] Fondo base: `#F4F1EC` (warm beige del design system)

---

## Componente

```tsx
// frontend/src/components/BreathingBackground.tsx
import { useEffect, useRef } from 'react'

const PALETTE = [
  '107,125,92',   // olive #6B7D5C
  '168,181,162',  // sage  #A8B5A2
  '214,210,196',  // accent #D6D2C4
]

const CONFIG = {
  count:       6,
  baseOpacity: 0.06,
  speed:       0.0009,   // radianes por ms
  pulseAmp:    0.22,     // amplitud de respiración (22% del radio)
  driftX:      0.18,     // px por frame
  driftY:      0.12,
  minRadius:   40,
  maxRadius:   130,
}

interface Circle {
  x: number; y: number; r: number
  phase: number
  driftX: number; driftY: number
  colorIdx: number
}

export function BreathingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const circles: Circle[] = Array.from(
      { length: CONFIG.count }, (_, i) => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: CONFIG.minRadius + Math.random() * (CONFIG.maxRadius - CONFIG.minRadius),
        phase: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * CONFIG.driftX * 2,
        driftY: (Math.random() - 0.5) * CONFIG.driftY * 2,
        colorIdx: i % PALETTE.length,
      })
    )

    let start: number | null = null

    function draw(ts: number) {
      if (!start) start = ts
      const elapsed = ts - start
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#F4F1EC'
      ctx.fillRect(0, 0, W, H)

      circles.forEach(c => {
        const pulse = Math.sin(elapsed * CONFIG.speed * 1000 + c.phase)
        const r = c.r + pulse * c.r * CONFIG.pulseAmp

        c.x += c.driftX
        c.y += c.driftY
        if (c.x < -r * 1.5) c.x = W + r
        if (c.x > W + r * 1.5) c.x = -r
        if (c.y < -r * 1.5) c.y = H + r
        if (c.y > H + r * 1.5) c.y = -r

        const alpha = CONFIG.baseOpacity + pulse * CONFIG.baseOpacity * 0.3
        ctx.beginPath()
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${PALETTE[c.colorIdx]},${alpha.toFixed(3)})`
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
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
```

---

## Uso en cada pantalla

```tsx
// Cualquier Page component
export function LandingPage() {
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <BreathingBackground />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* contenido */}
      </div>
    </div>
  )
}
```

---

## Archivos

```
frontend/src/components/BreathingBackground.tsx   ← nuevo
```

---

## Definición de hecho

- [ ] Visible en las 5 pantallas principales
- [ ] Sin flickering ni artefactos visuales
- [ ] `cancelAnimationFrame` ejecutado en cleanup
- [ ] El contenido de la pantalla es siempre legible sobre el fondo
- [ ] Performance: sin drops de FPS perceptibles en mobile
- [ ] `pointer-events: none` — el fondo no captura clicks

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
