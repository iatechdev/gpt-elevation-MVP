// ES-300 (E258-2): separa las capacidades del relieve para que sus botones no se solapen (WCAG 2.2 AA 2.5.8, tamaño del objetivo, y legibilidad). Función pura y DETERMINISTA:
// misma entrada ⇒ misma salida. Cada capacidad es un rectángulo (marca + rótulo) anclado en su punto; los pares que se solapan se empujan por el eje de menor penetración.
/** `centered`: solo la marca, centrada en su punto (sin rótulo). */
export type Slot = { x: number; y: number; w: number; h: number; side: 'left' | 'right'; centered?: boolean }
export type Bounds = { width: number; height: number }
const PASSES = 160
const ANCHOR = 8

const horizontal = (slot: Slot) => slot.centered ? { l: slot.x - slot.w / 2, r: slot.x + slot.w / 2 } : slot.side === 'right' ? { l: slot.x + ANCHOR - slot.w, r: slot.x + ANCHOR } : { l: slot.x - ANCHOR, r: slot.x - ANCHOR + slot.w }
const box = (slot: Slot) => { const { l, r } = horizontal(slot); return { l, r, t: slot.y - slot.h / 2, b: slot.y + slot.h / 2 } }
const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => ({ x: Math.min(a.r, b.r) - Math.max(a.l, b.l), y: Math.min(a.b, b.b) - Math.max(a.t, b.t) })

/** Posiciones (px) sin solapes y dentro de la caja. `crowded` = tras las pasadas todavía queda algún solape (no cabe): quien llama reduce el rótulo. */
export function separate(slots: readonly Slot[], bounds: Bounds): { positions: { x: number; y: number }[]; crowded: boolean } {
  const work = slots.map(slot => ({ ...slot }))
  const keepInside = (slot: Slot) => {
    const { l, r } = horizontal(slot)
    if (l < 0) slot.x += -l
    if (r > bounds.width) slot.x -= r - bounds.width
    const half = slot.h / 2
    slot.y = Math.min(Math.max(slot.y, half), Math.max(bounds.height - half, half))
  }
  work.forEach(keepInside)
  for (let pass = 0; pass < PASSES; pass += 1) {
    let moved = false
    for (let i = 0; i < work.length; i += 1) {
      for (let j = i + 1; j < work.length; j += 1) {
        const o = overlap(box(work[i]), box(work[j]))
        if (o.x <= 0 || o.y <= 0) continue
        moved = true
        if (o.y <= o.x) { const push = o.y / 2 + 0.5, dir = work[i].y <= work[j].y ? -1 : 1; work[i].y += dir * push; work[j].y -= dir * push }
        else { const push = o.x / 2 + 0.5, dir = work[i].x <= work[j].x ? -1 : 1; work[i].x += dir * push; work[j].x -= dir * push }
        keepInside(work[i]); keepInside(work[j])
      }
    }
    if (!moved) break
  }
  let crowded = false
  for (let i = 0; i < work.length && !crowded; i += 1) {
    for (let j = i + 1; j < work.length; j += 1) {
      const o = overlap(box(work[i]), box(work[j]))
      if (o.x > 0.5 && o.y > 0.5) { crowded = true; break }
    }
  }
  return { positions: work.map(slot => ({ x: slot.x, y: slot.y })), crowded }
}
