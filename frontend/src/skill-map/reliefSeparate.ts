// ES-300 (E258-2): separa las capacidades del relieve para que sus botones no se solapen (WCAG 2.2 AA 2.5.8, tamaño del objetivo, y legibilidad). Función pura y DETERMINISTA:
// misma entrada ⇒ misma salida. Cada capacidad es un rectángulo (marca + rótulo) anclado en su punto; los pares que se solapan se empujan por el eje de menor penetración.
/** `centered`: solo la marca, centrada en su punto (sin rótulo). */
export type Slot = { x: number; y: number; w: number; h: number; side: 'left' | 'right'; centered?: boolean }
export type Bounds = { width: number; height: number }
const PASSES = 160
const ANCHOR = 8

const horizontal = (slot: Slot) => slot.centered ? { l: slot.x - slot.w / 2, r: slot.x + slot.w / 2 } : slot.side === 'right' ? { l: slot.x + ANCHOR - slot.w, r: slot.x + ANCHOR } : { l: slot.x - ANCHOR, r: slot.x - ANCHOR + slot.w }

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
  // ES-199 (PERF-05): las cajas se guardan en arreglos y solo se recalculan cuando un par se mueve; antes cada comparación creaba dos objetos (160 pasadas × n² pares: 26 ms con 30 capacidades, 426 ms con 150).
  // Misma aritmética y mismo orden de pares ⇒ las mismas posiciones que antes (lo fija es-199-relieve.test.mjs contra la versión anterior).
  const count = work.length
  const left = new Float64Array(count), right = new Float64Array(count), top = new Float64Array(count), bottom = new Float64Array(count)
  const refresh = (k: number) => { const slot = work[k]; const { l, r } = horizontal(slot); left[k] = l; right[k] = r; top[k] = slot.y - slot.h / 2; bottom[k] = slot.y + slot.h / 2 }
  for (let k = 0; k < count; k += 1) refresh(k)
  for (let pass = 0; pass < PASSES; pass += 1) {
    let moved = false
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const ox = Math.min(right[i], right[j]) - Math.max(left[i], left[j])
        if (ox <= 0) continue
        const oy = Math.min(bottom[i], bottom[j]) - Math.max(top[i], top[j])
        if (oy <= 0) continue
        moved = true
        if (oy <= ox) { const push = oy / 2 + 0.5, dir = work[i].y <= work[j].y ? -1 : 1; work[i].y += dir * push; work[j].y -= dir * push }
        else { const push = ox / 2 + 0.5, dir = work[i].x <= work[j].x ? -1 : 1; work[i].x += dir * push; work[j].x -= dir * push }
        keepInside(work[i]); keepInside(work[j]); refresh(i); refresh(j)
      }
    }
    if (!moved) break
  }
  let crowded = false
  for (let i = 0; i < count && !crowded; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const ox = Math.min(right[i], right[j]) - Math.max(left[i], left[j])
      const oy = Math.min(bottom[i], bottom[j]) - Math.max(top[i], top[j])
      if (ox > 0.5 && oy > 0.5) { crowded = true; break }
    }
  }
  return { positions: work.map(slot => ({ x: slot.x, y: slot.y })), crowded }
}
