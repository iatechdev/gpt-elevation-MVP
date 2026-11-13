// ES-300: geometría del radar a la forma del prototipo (funciones puras). Un eje por capacidad (N = las del catálogo, nunca fijo), anillos de nivel 1 a 4 (el exterior es el 4),
// una capacidad sin nivel NO lleva punto (no es cero), solo se unen con línea los puntos vecinos que tienen nivel y el relleno aparece solo cuando TODAS tienen nivel.
export const POLY_W = 500
export const POLY_H = 400
export const POLY_CENTER = { x: 250, y: 200 }
export const POLY_RADIUS = 120
/** Radio al que se colocan los botones de los ejes (un poco fuera del anillo exterior). */
export const POLY_LABEL_RADIUS = 134
export const POLY_LEVELS = 4
/** Hasta aquí cada eje lleva su nombre y su nivel visibles (en pantallas anchas); más ejes: solo la marca, con el nombre en aria-label y en la tabla. */
export const NAMED_AXES_MAX = 12
/** Más ejes que esto no caben como botones de 24 px alrededor del círculo: el gráfico queda como imagen y la tabla es la superficie interactiva. */
export const BUTTON_AXES_MAX = 24

const round = (value: number) => Math.round(value * 100) / 100
const angle = (index: number, total: number) => -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(total, 1)
export const polyPoint = (index: number, total: number, radius: number) => ({
  x: round(POLY_CENTER.x + radius * Math.cos(angle(index, total))),
  y: round(POLY_CENTER.y + radius * Math.sin(angle(index, total))),
})

const closed = (points: { x: number; y: number }[]) => points.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join('') + 'Z'
/** Contorno del anillo del nivel `level` (1–4): un polígono de N lados. */
export const ringPath = (total: number, level: number) => closed(Array.from({ length: total }, (_, i) => polyPoint(i, total, (POLY_RADIUS * level) / POLY_LEVELS)))
export const axisEnd = (index: number, total: number) => polyPoint(index, total, POLY_RADIUS)

export type RadarShape = {
  /** Puntos solo de las capacidades CON nivel. */
  dots: { index: number; x: number; y: number }[]
  /** Segmentos entre vecinos que ambos tienen nivel (con todas, también cierra el último con el primero). */
  segments: { from: { x: number; y: number }; to: { x: number; y: number } }[]
  /** Relleno: solo cuando todas las capacidades tienen nivel. */
  fill: string | null
  /** Cuántas capacidades aún no tienen nivel. */
  missing: number
}
export function radarShape(levels: readonly (number | null)[]): RadarShape {
  const total = levels.length
  const all = total > 0 && levels.every(level => level !== null)
  const at = (index: number) => polyPoint(index, total, (POLY_RADIUS * (levels[index] as number)) / POLY_LEVELS)
  const dots: RadarShape['dots'] = []
  const segments: RadarShape['segments'] = []
  levels.forEach((level, index) => {
    if (level === null) return
    dots.push({ index, ...at(index) })
    const next = (index + 1) % total
    if (next !== index && levels[next] !== null && (all || next > index)) segments.push({ from: at(index), to: at(next) })
  })
  return { dots, segments, fill: all && total >= 3 ? closed(levels.map((_, index) => at(index))) : null, missing: levels.filter(level => level === null).length }
}
export const segmentsPath = (shape: RadarShape) => shape.segments.map(({ from, to }) => `M${from.x} ${from.y}L${to.x} ${to.y}`).join('')

/** Dónde va el botón del eje `index` (% del lienzo) y hacia qué lado crece (a la derecha, a la izquierda o centrado; arriba, abajo o al medio). */
export function axisPlacement(index: number, total: number) {
  const point = polyPoint(index, total, POLY_LABEL_RADIUS)
  const cos = Math.cos(angle(index, total)), sin = Math.sin(angle(index, total))
  return {
    left: round((point.x / POLY_W) * 100), top: round((point.y / POLY_H) * 100),
    h: cos > 0.3 ? 'right' : cos < -0.3 ? 'left' : 'center',
    v: Math.abs(cos) > 0.3 ? 'middle' : sin < 0 ? 'above' : 'below',
  } as { left: number; top: number; h: 'right' | 'left' | 'center'; v: 'above' | 'below' | 'middle' }
}
/** Móvil y tableta (< 900 px): con más de 12 capacidades el gráfico es una imagen y la tabla es la superficie interactiva (las marcas de 24 px no caben sin solaparse). */
export const DESKTOP_MIN = 900
/** Marca del radar: 24 px, el mínimo de WCAG 2.2 AA 2.5.8. Dos cuadrados de 24 px no se solapan si sus centros distan ≥ 24 en algún eje; con ejes a ±45° eso exige una cuerda ≥ 24·√2 ≈ 34 px. */
export const MARK_PX = 24
export const MARK_CHORD_PX = 34
/** ¿Caben N marcas sobre el círculo de los ejes? La tarjeta del radar ocupa ~46 % del ancho de la ventana (tope 1240 px). */
export const fitsAsMarks = (total: number, viewport: number) => 2 * ((Math.min(viewport, 1240) * 0.46 * POLY_LABEL_RADIUS) / POLY_W) * Math.sin(Math.PI / Math.max(total, 2)) >= MARK_CHORD_PX
/** Cómo se presenta el radar: hasta 12 capacidades, ejes con nombre; en escritorio con más (hasta 24 y mientras quepan sin solapar), solo marcas; en lo demás, imagen + tabla interactiva. */
export const radarMode = (total: number, viewport = 1200): 'named' | 'marks' | 'image' => (total <= NAMED_AXES_MAX ? 'named' : viewport >= DESKTOP_MIN && total <= BUTTON_AXES_MAX && fitsAsMarks(total, viewport) ? 'marks' : 'image')
