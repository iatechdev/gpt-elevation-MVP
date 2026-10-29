// QA-Claude-2 — ES-30 F30-1: disposición del mapa sin solapes, independiente de la prueba de Dev.
// Uso: node qa/es30-layout.mjs <layout.mjs transpilado con typescript.transpileModule de frontend/src/skill-map/layout.ts>
const L = await import(new URL('file:///' + process.argv[2].split('\\').join('/')))
const ids = ['dir', 'con', 'com', 'ing', 'inn']
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
let bad = 0, cases = 0
for (const n of [1, 4, 8, 12, 20, 30, 40, 60]) for (let rep = 0; rep < 25; rep++) {
  const chips = Array.from({ length: n }, (_, i) => ({ key: 's' + i, links: ids.filter(() => rnd() < (rep % 3 === 0 ? 0.6 : 0.25)).slice(0, 1 + Math.floor(rnd() * 5)) })).map(c => ({ ...c, links: c.links.length ? c.links : [ids[Math.floor(rnd() * 5)]] }))
  const { positions, height } = L.layoutChips(chips); cases++
  const boxes = Object.entries(positions).map(([k, p]) => ({ k, x: p.x - L.CHIP_W / 2, y: p.y - L.CHIP_H / 2, w: L.CHIP_W, h: L.CHIP_H }))
  const problems = []
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]
    if (b.x < 0 || b.x + b.w > L.CANVAS_W || b.y < 0 || b.y + b.h > height) problems.push(`${b.k} fuera del lienzo`)
    for (const t of Object.values(L.territoryBoxes)) if (ov(b, t)) problems.push(`${b.k} tapa un territorio`)
    for (let j = i + 1; j < boxes.length; j++) if (ov(b, boxes[j])) problems.push(`${b.k} solapa ${boxes[j].k}`)
  }
  if (problems.length) { bad++; if (bad <= 5) console.log(`n=${n} rep=${rep}:`, problems.slice(0, 3).join('; ')) }
  const again = JSON.stringify(L.layoutChips(chips).positions); if (again !== JSON.stringify(positions)) { bad++; console.log('NO determinista') }
}
console.log(`casos ${cases}, con problemas ${bad}`); process.exit(bad ? 1 : 0)
