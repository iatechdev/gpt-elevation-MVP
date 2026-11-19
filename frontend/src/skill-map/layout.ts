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
const CELL = 256
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
  // ES-199 (PERF-05): sin crear una caja por cada punto probado (la búsqueda en espiral prueba miles); misma aritmética que overlaps(chipBox(p), …) ⇒ mismas posiciones (lo fija es-199-relieve.test.mjs).
  const hits = (x: number, y: number, other: Box) => x < other.x + other.w + 10 && x + CHIP_W + 10 > other.x && y < other.y + other.h + 10 && y + CHIP_H + 10 > other.y
  // Las cajas ya colocadas se guardan en una cuadrícula: cada punto de la espiral solo se compara con las de su vecindad (antes, con todas: 56 ms con 30 capacidades, 506 ms con 150). Mismo resultado: una caja que choca comparte celda.
  const grid = new Map<number, Box[]>()
  const resume = new Map<string, { r: number; i: number }>()
  const remember = (b: Box) => { for (let cx = Math.floor(b.x / CELL); cx <= Math.floor((b.x + b.w) / CELL); cx += 1) for (let cy = Math.floor(b.y / CELL); cy <= Math.floor((b.y + b.h) / CELL); cy += 1) { const key = cx * 100003 + cy; const list = grid.get(key); if (list) list.push(b); else grid.set(key, [b]) } }
  const free = (p: Point) => {
    const x = p.x - CHIP_W / 2, y = p.y - CHIP_H / 2
    if (x < 10 || x + CHIP_W > CANVAS_W - 10 || y < 10) return false
    for (const t of all) if (hits(x, y, t)) return false
    const x0 = Math.floor((x - 10) / CELL), x1 = Math.floor((x + CHIP_W + 10) / CELL), y0 = Math.floor((y - 10) / CELL), y1 = Math.floor((y + CHIP_H + 10) / CELL)
    for (let cx = x0; cx <= x1; cx += 1) for (let cy = y0; cy <= y1; cy += 1) for (const c of grid.get(cx * 100003 + cy) ?? []) if (hits(x, y, c)) return false
    return true
  }
  for (const chip of chips) {
    const ends = chip.links.map(id => boxes[id]).filter((b): b is Box => !!b).map(center)
    let anchor: Point = middle
    if (ends.length > 1) anchor = { x: ends.reduce((s, p) => s + p.x, 0) / ends.length, y: ends.reduce((s, p) => s + p.y, 0) / ends.length }
    else if (ends.length === 1) {
      const dx = middle.x - ends[0].x, dy = middle.y - ends[0].y, len = Math.hypot(dx, dy) || 1
      anchor = { x: ends[0].x + (dx / len) * 190, y: ends[0].y + (dy / len) * 190 }
    }
    // Lo libre solo puede encoger (las cajas colocadas solo aumentan): los puntos de la espiral de ESTE ancla que ya se rechazaron seguirán rechazados, así que la búsqueda de la siguiente capacidad con el mismo ancla
    // continúa donde se quedó la anterior (mismos resultados que empezar desde el centro; antes cada capacidad recorría la espiral completa).
    const anchorKey = `${anchor.x},${anchor.y}`
    const from = resume.get(anchorKey) ?? { r: 0, i: 0 }
    let spot: Point | null = null
    for (let r = from.r; r <= 1400 && !spot; r += 24) {
      const steps = r === 0 ? 1 : Math.max(8, Math.round(r / 12))
      for (let i = r === from.r ? from.i : 0; i < steps && !spot; i++) {
        const a = (i / steps) * Math.PI * 2
        const p = { x: Math.round(anchor.x + r * Math.cos(a)), y: Math.round(anchor.y + r * Math.sin(a)) }
        if (free(p)) { spot = p; resume.set(anchorKey, { r, i }) }
      }
    }
    if (!spot) resume.set(anchorKey, { r: 1424, i: 0 })
    const at = spot ?? { x: CANVAS_W / 2, y: MIN_H + placed.length * (CHIP_H + 10) }
    positions[chip.key] = at
    const box = chipBox(at)
    placed.push(box); remember(box)
  }
  const bottom = Math.max(MIN_H, ...placed.map(b => b.y + b.h + 30))
  return { positions, height: Math.ceil(bottom) }
}
