import { trackView, type Skill } from './model'

/** Radar de competencias (ES-30): una cuña por capacidad del catálogo; el nivel vigente da el largo y el color. Sin nivel = hueco, nunca cero. */
export type RadarItem = { skill: Skill; index: number; level: number | null; evidence: number; stale: boolean; needsReview: boolean }
export const MAX_LEVEL = 4
/** Con más capacidades que esto los nombres no caben alrededor del radar: se omiten y la lista de texto los lleva. */
export const MAX_LABELS = 12

/** Nivel que dibuja el radar. Nunca promedia pistas: con dos niveles vigentes distintos (autoevaluación y revisión) muestra el MÁS BAJO,
 *  para no sobrestimar; el detalle sigue mostrando cada pista por separado. Una pista desactualizada no aporta nivel. */
export function radarItems(skills: readonly Skill[]): RadarItem[] {
  return skills.map((skill, index) => {
    const views = [trackView(skill.self), trackView(skill.review)]
    const tracks = [skill.self, skill.review]
    const levels = views.map(view => view.level).filter((level): level is number => level !== null)
    const level = levels.length ? Math.min(...levels) : null
    const at = views.findIndex(view => view.level === level)
    return {
      skill, index, level,
      evidence: level === null ? 0 : tracks[at]?.evidenceCount ?? 0,
      stale: level === null && views.some(view => view.stale),
      needsReview: views.some(view => view.needsReview),
    }
  })
}

/** Hasta `count` capacidades con mayor nivel; empata por más evidencias y luego por orden del catálogo. Nunca rellena con capacidades sin nivel. */
export function strongest(items: readonly RadarItem[], count = 3): RadarItem[] {
  return items.filter(item => item.level !== null)
    .sort((a, b) => (b.level! - a.level!) || (b.evidence - a.evidence) || (a.index - b.index)).slice(0, count)
}

/** Capacidad con nivel más bajo que aún tiene un nivel siguiente (empata por orden del catálogo) y ese nivel siguiente. Sin ninguna con nivel: null. */
export function improvement(items: readonly RadarItem[]): { item: RadarItem; next: number } | null {
  const rated = items.filter(item => item.level !== null && item.level < MAX_LEVEL).sort((a, b) => (a.level! - b.level!) || (a.index - b.index))
  return rated.length ? { item: rated[0], next: rated[0].level! + 1 } : null
}
/** ¿Hay algún nivel vigente? Si no, el radar muestra el aviso en lugar de las tarjetas. */
export const anyLevel = (items: readonly RadarItem[]) => items.some(item => item.level !== null)

// H-96-01: el lienzo mide VIEW_W de ancho y el centro va en el medio; a cada lado quedan ~150 unidades para las etiquetas (antes ~89 y se recortaban).
export const VIEW_W = 680
export const VIEW_H = 520
export const CENTER = { x: VIEW_W / 2, y: 250 }
export const RADIUS = 165
const GAP = 0.02
const point = (angle: number, radius: number) => ({ x: CENTER.x + radius * Math.cos(angle), y: CENTER.y + radius * Math.sin(angle) })
const round = (value: number) => Math.round(value * 100) / 100

/** Geometría de la cuña `index` de `total`. Con nivel: sector hasta ese anillo; sin nivel: sector completo (se dibuja punteado). */
export function wedge(index: number, total: number, level: number | null) {
  const step = (Math.PI * 2) / Math.max(total, 1)
  const mid = -Math.PI / 2 + index * step
  const from = mid - step / 2 + GAP, to = mid + step / 2 - GAP
  const radius = RADIUS * (level ?? MAX_LEVEL) / MAX_LEVEL
  const a = point(from, radius), b = point(to, radius)
  const large = to - from > Math.PI ? 1 : 0
  const path = `M${CENTER.x},${CENTER.y} L${round(a.x)},${round(a.y)} A${round(radius)},${round(radius)} 0 ${large} 1 ${round(b.x)},${round(b.y)} Z`
  const number = point(mid, Math.max(radius * 0.62, 26))
  const label = point(mid, RADIUS + 26), cos = Math.cos(mid)
  return {
    path, spoke: point(mid, RADIUS),
    number: { x: round(number.x), y: round(number.y) },
    label: { x: round(label.x), y: round(label.y), anchor: (cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle') as 'start' | 'end' | 'middle', dy: Math.sin(mid) > 0.5 ? 8 : Math.sin(mid) < -0.5 ? -4 : 4 },
  }
}
export const wrapName = (text: string, width = 16): string[] => {
  const lines: string[] = []; let line = ''
  for (const word of text.split(/\s+/)) { if (line && `${line} ${word}`.length > width) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word }
  if (line) lines.push(line)
  return lines.length > 3 ? [lines[0], lines[1], `${lines.slice(2).join(' ').slice(0, width - 1)}…`] : lines
}
