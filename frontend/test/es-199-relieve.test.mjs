// ES-199 (PERF-05, resto): separate() del relieve del Skill Map se hizo más barata (cajas en arreglos en vez de dos objetos por comparación) SIN cambiar su resultado.
// Esta prueba guarda la equivalencia: compara la versión actual con la implementación anterior (copia literal, abajo) sobre entradas aleatorias reproducibles.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync(new URL('../src/skill-map/reliefSeparate.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { separate } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

// ---- Implementación ANTERIOR (ES-300), sin cambios ----
const PASSES = 160
const ANCHOR = 8
const horizontal = slot => slot.centered ? { l: slot.x - slot.w / 2, r: slot.x + slot.w / 2 } : slot.side === 'right' ? { l: slot.x + ANCHOR - slot.w, r: slot.x + ANCHOR } : { l: slot.x - ANCHOR, r: slot.x - ANCHOR + slot.w }
const box = slot => { const { l, r } = horizontal(slot); return { l, r, t: slot.y - slot.h / 2, b: slot.y + slot.h / 2 } }
const overlap = (a, b) => ({ x: Math.min(a.r, b.r) - Math.max(a.l, b.l), y: Math.min(a.b, b.b) - Math.max(a.t, b.t) })
function reference(slots, bounds) {
  const work = slots.map(slot => ({ ...slot }))
  const keepInside = slot => {
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

const random = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
function scenario(seed, count, width, labels) {
  const next = random(seed); const height = width < 640 ? width * 1.25 : width * 0.625
  const slots = Array.from({ length: count }, () => {
    const x = next(), y = next()
    return labels ? { x: x * width, y: y * height, w: 40 + Math.floor(next() * 140), h: 44 + Math.floor(next() * 20), side: x > 0.55 ? 'right' : 'left' } : { x: x * width, y: y * height, w: 28, h: 28, side: 'left', centered: true }
  })
  return { slots, bounds: { width, height } }
}

test('ES-199: separate() da exactamente las mismas posiciones y el mismo «crowded» que la versión anterior (con rótulos y solo marcas, anchos 320–1360, 1–120 capacidades)', () => {
  let seed = 1
  for (const width of [320, 390, 639, 640, 1000, 1360]) for (const labels of [true, false]) for (const count of [1, 2, 5, 12, 30, 60, 120]) {
    const { slots, bounds } = scenario(seed++, count, width, labels)
    assert.deepEqual(separate(slots, bounds), reference(slots, bounds), `${width}px ${labels ? 'rótulos' : 'marcas'} n=${count}`)
  }
})

test('ES-199: separate() no modifica sus entradas y es determinista', () => {
  const { slots, bounds } = scenario(99, 40, 390, true)
  const copy = JSON.parse(JSON.stringify(slots))
  const first = separate(slots, bounds); const second = separate(slots, bounds)
  assert.deepEqual(slots, copy); assert.deepEqual(first, second)
})

// ---- O248-B (QA): la memoización de la burbuja del chat se rompe si cada burbuja recibe un `children` nuevo en cada render ----
test('ES-199 (O248-B): solo la última burbuja del chat recibe `children`; las demás lo reciben `undefined` (un elemento nuevo en cada burbuja rompería memo)', () => {
  const page = fs.readFileSync(new URL('../src/pages/ChatPage.tsx', import.meta.url), 'utf8')
  const bubbles = page.match(/<ChatBubble [^>]*>[\s\S]*?<\/ChatBubble>/g) ?? []
  assert.equal(bubbles.length, 1)
  // el único hijo es una expresión condicional «solo la última»: el resultado es `false` (primitivo estable) en las demás
  assert.match(bubbles[0], /\{i === messages\.length - 1 && msg\.role !== 'user' && <TruncatedNotice chat=\{chat\} \/>\}/)
  // sin hijos incondicionales (<TruncatedNotice /> suelto, fragmentos, funciones o elementos creados en línea fuera de la condición)
  const inner = bubbles[0].replace(/^<ChatBubble [^>]*>/, '').replace(/<\/ChatBubble>$/, '').trim()
  assert.equal(inner, "{i === messages.length - 1 && msg.role !== 'user' && <TruncatedNotice chat={chat} />}")
  // las props son todas primitivas: ni objetos, ni arreglos, ni funciones en línea
  const opening = bubbles[0].match(/^<ChatBubble ([^>]*)>/)?.[1] ?? ''
  assert.doesNotMatch(opening, /=\{\s*(\{|\[|\(|function|async|\w+\s*=>)/)
})

// ---- layoutChips (colocación en espiral): misma equivalencia contra la implementación anterior ----
const layoutSource = ts.transpileModule(fs.readFileSync(new URL('../src/skill-map/layout.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const layout = await import('data:text/javascript;base64,' + Buffer.from(layoutSource).toString('base64'))
const { CANVAS_W, MIN_H, CHIP_W, CHIP_H, territoryBoxes } = layout
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const overlaps2 = (a, b, gap = 0) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
const chipBox = p => ({ x: p.x - CHIP_W / 2, y: p.y - CHIP_H / 2, w: CHIP_W, h: CHIP_H })
function layoutReference(chips, boxes = territoryBoxes) {
  const all = Object.values(boxes)
  const middle = { x: CANVAS_W / 2, y: MIN_H / 2 }
  const placed = []
  const positions = {}
  const free = p => {
    const b = chipBox(p)
    if (b.x < 10 || b.x + b.w > CANVAS_W - 10 || b.y < 10) return false
    return !all.some(t => overlaps2(b, t, 10)) && !placed.some(c => overlaps2(b, c, 10))
  }
  for (const chip of chips) {
    const ends = chip.links.map(id => boxes[id]).filter(b => !!b).map(center)
    let anchor = middle
    if (ends.length > 1) anchor = { x: ends.reduce((s, p) => s + p.x, 0) / ends.length, y: ends.reduce((s, p) => s + p.y, 0) / ends.length }
    else if (ends.length === 1) {
      const dx = middle.x - ends[0].x, dy = middle.y - ends[0].y, len = Math.hypot(dx, dy) || 1
      anchor = { x: ends[0].x + (dx / len) * 190, y: ends[0].y + (dy / len) * 190 }
    }
    let spot = null
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

test('ES-199: layoutChips() da exactamente las mismas posiciones y el mismo alto que la versión anterior (1–120 capacidades, con uno, dos y sin territorio válido)', () => {
  const ids = Object.keys(territoryBoxes)
  const next = random(7)
  for (const count of [1, 2, 5, 12, 30, 60, 120, 250, 400]) {
    const chips = Array.from({ length: count }, (_, i) => {
      const kind = Math.floor(next() * 4)
      const links = kind === 0 ? [] : kind === 1 ? ['no-existe'] : kind === 2 ? [ids[Math.floor(next() * ids.length)]] : [ids[Math.floor(next() * ids.length)], ids[Math.floor(next() * ids.length)]]
      return { key: `k${i}`, links }
    })
    assert.deepEqual(layout.layoutChips(chips), layoutReference(chips), `n=${count}`)
  }
})

test('ES-199: ReliefMap calcula la colocación una vez por mapa (placeSkillsCached) y no al volver a la vista', () => {
  const place = fs.readFileSync(new URL('../src/skill-map/reliefPlace.ts', import.meta.url), 'utf8')
  const map = fs.readFileSync(new URL('../src/skill-map/ReliefMap.tsx', import.meta.url), 'utf8')
  assert.match(place, /const placedCache = new WeakMap<readonly Skill\[\], WeakMap<readonly Territory\[\], Placed\[\]>>\(\)/) // WeakMap: se libera con el mapa y no persiste nada
  assert.doesNotMatch(place, /localStorage|sessionStorage|indexedDB/)
  assert.match(map, /useMemo\(\(\) => placeSkillsCached\(skills, territories\), \[skills, territories\]\)/)
})

// Guarda de complejidad SIN reloj (no depende de la carga de la máquina): se cuentan los puntos de la espiral que layoutChips prueba (cada uno llama a Math.cos una vez).
// Con 400 capacidades la implementación actual prueba ~17 000 puntos; la anterior (la copia de referencia de arriba), ~1 260 000. El tope deja un margen amplio y falla si reaparece la búsqueda completa por capacidad.
test('ES-199: layoutChips con 400 capacidades prueba menos de 100 000 puntos de la espiral (la versión anterior, más de un millón)', () => {
  const ids = Object.keys(territoryBoxes)
  const chips = Array.from({ length: 400 }, (_, i) => ({ key: `k${i}`, links: [ids[i % ids.length]] }))
  const real = Math.cos
  let points = 0
  Math.cos = value => { points += 1; return real(value) }
  try { layout.layoutChips(chips) } finally { Math.cos = real }
  assert.ok(points < 100_000, `probó ${points} puntos`)
})

test('ES-199: con solo marcas, las medidas de los rótulos no vuelven a calcular la disposición del relieve', () => {
  const map = fs.readFileSync(new URL('../src/skill-map/ReliefMap.tsx', import.meta.url), 'utf8')
  assert.match(map, /const measured = box\.w >= NARROW \? sizes : NO_SIZES/)
  assert.match(map, /\}, \[placed, names, box, measured\]\)/)
  assert.ok(!/\[placed, names, box, sizes\]/.test(map))
})
