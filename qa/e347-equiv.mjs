// QA-Claude-2 — PR #347 (ES-199): equivalencia EXACTA de layoutChips / separate / placeSkills(Cached) contra la versión de main.
// Uso: node qa/e347-equiv.mjs <carpeta con main/ y pr/> (cada una con layout.mjs, reliefSeparate.mjs, reliefPlace.mjs empaquetados con rolldown). Casos propios (semillas y generadores distintos a los de Dev).
import path from 'node:path'; import { pathToFileURL } from 'node:url'; import assert from 'node:assert/strict'
const D = path.resolve(process.argv[2]); const load = async (v, f) => import(pathToFileURL(path.join(D, v, f + '.mjs')).href)
const [LM, LP, SM, SP, PM, PP] = await Promise.all([load('main', 'layout'), load('pr', 'layout'), load('main', 'reliefSeparate'), load('pr', 'reliefSeparate'), load('main', 'reliefPlace'), load('pr', 'reliefPlace')])
let total = 0, fails = 0; const ck = (n, ok, d = '') => { total++; if (!ok) { fails++; if (fails <= 12) console.log('FALLA', n, String(d).slice(0, 300)) } }
const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const clone = (x) => JSON.parse(JSON.stringify(x))
const same = (name, a, b) => { try { assert.deepStrictEqual(a, b); ck(name, true) } catch (e) { ck(name, false, (e.message || '').split('\n').slice(0, 4).join(' | ')) } }
// ---------- layoutChips ----------
const DEF = LM.territoryBoxes; const ids = Object.keys(DEF)
const mkChips = (r, n, boxIds, mode) => Array.from({ length: n }, (_, i) => { let links; if (mode === 'mismo') links = [boxIds[0]]; else if (mode === 'ninguno') links = []; else if (mode === 'desconocidos') links = [boxIds[Math.floor(r() * boxIds.length)], 'zz' + i % 3]; else { const k = Math.floor(r() * 4); links = Array.from({ length: k }, () => boxIds[Math.floor(r() * boxIds.length)]) } return { key: 'c' + i, links } })
const mkBoxes = (r, kind) => { if (kind === 'defecto') return DEF; const m = 1 + Math.floor(r() * 8); const out = {}; for (let i = 0; i < m; i++) { const snap = kind === 'celdas' ? 256 : 1; const x = Math.round((r() * 1000) / snap) * snap, y = Math.round((r() * 700) / snap) * snap; out['b' + i] = { x: kind === 'fuera' ? x - 200 : x, y: kind === 'fuera' ? y - 150 : y, w: kind === 'celdas' ? 256 : 40 + Math.floor(r() * 320), h: kind === 'celdas' ? 256 : 40 + Math.floor(r() * 200) } } return out }
const r = rng(20261118); let cases = 0
for (const kind of ['defecto', 'aleatorio', 'celdas', 'fuera']) for (const mode of ['mezcla', 'mismo', 'ninguno', 'desconocidos']) for (const n of [1, 2, 3, 5, 8, 16, 30, 60, 150, 400]) for (let rep = 0; rep < (n >= 150 ? 3 : 18); rep++) {
  const boxes = mkBoxes(r, kind), bid = Object.keys(boxes); const chips = mkChips(r, n, bid, mode); const cb = clone(boxes), cc = clone(chips)
  const a = LM.layoutChips(chips, boxes), b = LP.layoutChips(clone(chips), clone(boxes)); cases++
  same(`layoutChips ${kind}/${mode}/n=${n}/#${rep}`, b, a); same(`layoutChips no muta entradas ${kind}/${mode}/n=${n}`, [chips, boxes], [cc, cb])
}
console.log('layoutChips: casos comparados', cases)
// espiral agotada: más capacidades que sitio con una sola caja gigante y ancla fija
{ const boxes = { b0: { x: 10, y: 10, w: 1090, h: 580 } }; for (const n of [3, 20, 80]) same(`layoutChips espiral agotada n=${n}`, LP.layoutChips(mkChips(rng(5), n, ['b0'], 'mismo'), boxes), LM.layoutChips(mkChips(rng(5), n, ['b0'], 'mismo'), boxes)) }
// el mismo mapa colocado dos veces da lo mismo (determinismo)
{ const chips = mkChips(rng(9), 150, ids, 'mezcla'); same('layoutChips determinista (dos llamadas) en el PR', LP.layoutChips(chips), LP.layoutChips(chips)) }
// ---------- separate ----------
const slotsOf = (rn, count, width, labels, dup) => { const height = width < 640 ? width * 1.25 : width * 0.625; return { slots: Array.from({ length: count }, (_, i) => { if (dup && i % 7 === 0) return { x: width / 2, y: height / 2, w: labels ? 90 : 28, h: labels ? 44 : 28, side: 'left', centered: !labels }; const x = rn(), y = rn(); return labels ? { x: x * width, y: y * height, w: 20 + Math.floor(rn() * 200), h: 44 + Math.floor(rn() * 40), side: x > 0.55 ? 'right' : 'left' } : { x: x * width, y: y * height, w: 28, h: 28, side: 'left', centered: true } }), bounds: { width, height } } }
const rs = rng(777); let sc = 0
for (const width of [320, 360, 390, 480, 639, 640, 641, 800, 1000, 1360]) for (const labels of [true, false]) for (const count of [1, 2, 3, 7, 12, 25, 40, 80, 150, 400]) for (const dup of [false, true]) { if (count >= 150 && !labels && width > 700 && !dup) { /* grande pero válido */ } const { slots, bounds } = slotsOf(rs, count, width, labels, dup); const a = SM.separate(clone(slots), bounds), b = SP.separate(clone(slots), bounds); sc++; same(`separate ${width}px ${labels ? 'rótulos' : 'marcas'} n=${count}${dup ? ' con coincidentes' : ''}`, b, a) }
console.log('separate: casos comparados', sc)
// no muta entradas y es determinista
{ const { slots, bounds } = slotsOf(rng(3), 60, 640, true, false); const before = clone(slots); SP.separate(slots, bounds); same('separate no muta la entrada', slots, before) }
// ---------- placeSkills / caché ----------
const terr = (await import(pathToFileURL(path.join(D, 'pr', 'reliefPlace.mjs')).href)) // solo para tipos
const TER = ['dir', 'con', 'com', 'ing', 'inn'].map((id) => ({ id, labels: { es: id, en: id }, roles: '' }))
const mkSkills = (n, seed) => { const rn = rng(seed); return Array.from({ length: n }, (_, i) => ({ skillKey: 'k' + i, labels: { es: 'Cap ' + i, en: 'Skill ' + i }, territories: i % 11 === 10 ? [] : Array.from({ length: 1 + Math.floor(rn() * 2) }, () => TER[Math.floor(rn() * 5)].id), self: { entries: [] } })) }
for (const n of [0, 1, 5, 16, 30, 150, 400]) { const skills = mkSkills(n, 100 + n); let a, b; try { a = PM.placeSkills(skills, TER) } catch (e) { a = 'ERR ' + e.message } try { b = PP.placeSkills(skills, TER) } catch (e) { b = 'ERR ' + e.message } same(`placeSkills n=${n}`, b, a)
  if (PP.placeSkillsCached) { let c1, c2; try { c1 = PP.placeSkillsCached(skills, TER); c2 = PP.placeSkillsCached(skills, TER) } catch (e) { c1 = c2 = 'ERR ' + e.message }; same(`placeSkillsCached n=${n} = placeSkills`, c1, b); ck(`placeSkillsCached n=${n}: segunda llamada devuelve el MISMO arreglo (sin recomputar)`, c1 === c2 || typeof c1 === 'string')
    const skills2 = skills.map((s) => ({ ...s })); const c3 = PP.placeSkillsCached(skills2, TER); ck(`placeSkillsCached n=${n}: arreglo nuevo (releer el mapa) recalcula`, c3 !== c1 || n === 0 && c3 === c1 ? true : c3 !== c1); same(`placeSkillsCached n=${n}: arreglo nuevo con el mismo contenido da lo mismo`, c3.map((p) => [p.x, p.y]), c1.map((p) => [p.x, p.y]))
    const TER2 = TER.map((t) => ({ ...t })); const c4 = PP.placeSkillsCached(skills, TER2); ck(`placeSkillsCached n=${n}: territorios nuevos recalculan`, n === 0 || c4 !== c1) } }
// el supuesto declarado: un arreglo mutado EN SITIO sirve la colocación vieja (riesgo documentado, no un defecto si SkillMapPage reemplaza el arreglo)
if (PP.placeSkillsCached) { const sk = mkSkills(16, 5); const c1 = PP.placeSkillsCached(sk, TER); sk[0].territories = ['inn']; const c2 = PP.placeSkillsCached(sk, TER); console.log(`INFO supuesto de caché: arreglo mutado en sitio → ${c2 === c1 ? 'devuelve la colocación VIEJA (mismo arreglo)' : 'recalcula'}`) }
console.log(`RESUMEN equivalencia: ${total - fails}/${total} OK, ${fails} FALLAS`); process.exit(fails ? 1 : 0)
