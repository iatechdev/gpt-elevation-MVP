export type Box = { x: number; y: number; w: number; h: number }
export type Point = { x: number; y: number }
export type ChipInput = { key: string; links: readonly string[] }

export const CANVAS_W = 1120
export const MIN_H = 600
export const CHIP_W = 220
export const CHIP_H = 64
/** Recuadros fijos de los cinco territorios (disposición del Figma, sin solapes). */
export const territoryBoxes: Readonly<Record<string, Box>> = {
  dir: { x: 40, y: 50, w: 320, h: 170 },
  con: { x: 770, y: 40, w: 310, h: 180 },
  com: { x: 40, y: 400, w: 300, h: 160 },
  ing: { x: 420, y: 390, w: 320, h: 170 },
  inn: { x: 790, y: 400, w: 290, h: 160 },
}
const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const overlaps = (a: Box, b: Box, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
const chipBox = (p: Point): Box => ({ x: p.x - CHIP_W / 2, y: p.y - CHIP_H / 2, w: CHIP_W, h: CHIP_H })

/** Punto del borde del recuadro por donde sale la línea hacia `from`. */
export function edgePoint(box: Box, from: Point): Point {
  const c = center(box), dx = from.x - c.x, dy = from.y - c.y
  if (dx === 0 && dy === 0) return c
  const k = 1 / Math.max(Math.abs(dx) / (box.w / 2), Math.abs(dy) / (box.h / 2))
  return { x: c.x + dx * k, y: c.y + dy * k }
}

/** Coloca cada habilidad cerca de sus territorios (entre ellos si son varios) sin tapar recuadros ni otras habilidades.
 *  Determinista: mismo catálogo → misma disposición. Devuelve también el alto necesario del lienzo. */
export function layoutChips(chips: readonly ChipInput[], boxes: Readonly<Record<string, Box>> = territoryBoxes) {
  const all = Object.values(boxes)
  const middle = { x: CANVAS_W / 2, y: MIN_H / 2 }
  const placed: Box[] = []
  const positions: Record<string, Point> = {}
  const free = (p: Point) => {
    const b = chipBox(p)
    if (b.x < 10 || b.x + b.w > CANVAS_W - 10 || b.y < 10) return false
    return !all.some(t => overlaps(b, t, 10)) && !placed.some(c => overlaps(b, c, 10))
  }
  for (const chip of chips) {
    const ends = chip.links.map(id => boxes[id]).filter((b): b is Box => !!b).map(center)
    let anchor: Point = middle
    if (ends.length > 1) anchor = { x: ends.reduce((s, p) => s + p.x, 0) / ends.length, y: ends.reduce((s, p) => s + p.y, 0) / ends.length }
    else if (ends.length === 1) {
      const dx = middle.x - ends[0].x, dy = middle.y - ends[0].y, len = Math.hypot(dx, dy) || 1
      anchor = { x: ends[0].x + (dx / len) * 190, y: ends[0].y + (dy / len) * 190 }
    }
    let spot: Point | null = null
    for (let r = 0; r <= 1400 && !spot; r += 24) {
      const steps = r === 0 ? 1 : Math.max(8, Math.round(r / 12))
      for (let i = 0; i < steps && !spot; i++) {
        const a = (i / steps) * Math.PI * 2
        const p = { x: Math.round(anchor.x + r * Math.cos(a)), y: Math.round(anchor.y + r * Math.sin(a)) }
        if (free(p)) spot = p
      }
    }
    const at = spot ?? { x: CANVAS_W / 2, y: MIN_H + placed.length * (CHIP_H + 10) }
    positions[chip.key] = at
    placed.push(chipBox(at))
  }
  const bottom = Math.max(MIN_H, ...placed.map(b => b.y + b.h + 30))
  return { positions, height: Math.ceil(bottom) }
}
