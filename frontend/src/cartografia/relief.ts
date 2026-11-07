// ES-152: relieve del mapa. Cada pico es un nivel registrado por la persona (h = nivel × 0,25); donde no hay evidencia el terreno queda plano.
// Portado de docs/ux/plataforma/nucleo.js (rama ES-148). Funciones puras salvo paintRelief, que dibuja en un canvas.

export type ReliefPoint = { x: number; y: number; level: number }
export type ReliefOptions = { levels: number; step: number; heavy: number; cell: number; decor?: boolean }
export type ReliefColors = { contour: string; soft: string }

const hash = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s) }
function vnoise(x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y)
  const fx0 = x - i, fy0 = y - j
  const fx = fx0 * fx0 * (3 - 2 * fx0), fy = fy0 * fy0 * (3 - 2 * fy0)
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}
const fbm = (x: number, y: number) => 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 5, y * 2.1 + 9) + 0.15 * vnoise(x * 4.3 + 2, y * 4.3 + 7)

export type ReliefField = (x: number, y: number, aw: number, ah: number) => number

/** Campo de alturas: suma de picos gaussianos por nivel; `decor` agrega ruido de fondo (portadas), nunca en datos reales. */
export function reliefField(points: ReliefPoint[], decor = false): ReliefField {
  return (x, y, aw, ah) => {
    let s = decor ? 0.55 * fbm(x * 2.3 + 3, y * 2.3 + 1) : 0
    for (const p of points) {
      if (!p.level) continue
      const dx = x - p.x * aw, dy = y - p.y * ah
      s += p.level * 0.25 * Math.exp(-(dx * dx + dy * dy) / (2 * 0.15 * 0.15))
    }
    return s
  }
}

// Tabla de marching squares: por cada combinación de esquinas, los pares de aristas (0 arriba, 1 derecha, 2 abajo, 3 izquierda) que une cada segmento.
const SEGMENTS: (number[] | number[][] | null)[] = [
  null, [3, 0], [0, 1], [3, 1], [1, 2], [[3, 0], [1, 2]], [0, 2], [3, 2], [2, 3], [0, 2], [[0, 1], [2, 3]], [2, 1], [3, 1], [0, 1], [3, 0], null,
]

/** Segmentos [x1, y1, x2, y2] de la curva de nivel `level` sobre una malla de `cols × rows` celdas de tamaño `cell`. */
export function contourSegments(values: Float32Array, cols: number, rows: number, cell: number, level: number): number[][] {
  const out: number[][] = []
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = values[j * cols + i], b = values[j * cols + i + 1], c = values[(j + 1) * cols + i + 1], d = values[(j + 1) * cols + i]
      const code = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0)
      const entry = SEGMENTS[code]
      if (!entry) continue
      const segs = (typeof entry[0] === 'number' ? [entry] : entry) as number[][]
      const x0 = i * cell, y0 = j * cell
      for (const seg of segs) {
        const pts: number[] = []
        for (const edge of seg) {
          if (edge === 0) pts.push(x0 + (cell * (level - a)) / (b - a), y0)
          else if (edge === 1) pts.push(x0 + cell, y0 + (cell * (level - b)) / (c - b))
          else if (edge === 2) pts.push(x0 + (cell * (level - d)) / (c - d), y0 + cell)
          else pts.push(x0, y0 + (cell * (level - a)) / (d - a))
        }
        out.push(pts)
      }
    }
  }
  return out
}

/** Dibuja el relieve. Devuelve false si el canvas aún no tiene tamaño (oculto o sin montar). */
export function paintRelief(canvas: HTMLCanvasElement, field: ReliefField, options: ReliefOptions, colors: ReliefColors): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth, h = canvas.clientHeight
  if (!w || !h) return false
  canvas.width = w * dpr
  canvas.height = h * dpr
  const g = canvas.getContext('2d')
  if (!g) return false
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const { cell, levels, step, heavy } = options
  const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1, ref = Math.min(w, h)
  const values = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) values[j * cols + i] = field((i * cell) / ref, (j * cell) / ref, w / ref, h / ref)
  for (let k = 1; k <= levels; k++) {
    const isHeavy = k % heavy === 0
    g.beginPath()
    g.strokeStyle = isHeavy ? colors.contour : colors.soft
    g.lineWidth = isHeavy ? 2 : 1
    for (const [x1, y1, x2, y2] of contourSegments(values, cols, rows, cell, k * step)) { g.moveTo(x1, y1); g.lineTo(x2, y2) }
    g.stroke()
  }
  return true
}
