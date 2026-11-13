// ES-300: radar a la forma del prototipo + seguimiento E258-2…E258-5 de ES-160. Geometría y separación (puras) y render estático del TS/TSX de producción:
// el accesible (aria-label, aria-pressed, is-flat, nivel en la Lista) lo ven estas pruebas; el comportamiento, axe 2.2 AA y el rendimiento los mide scripts/es300-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { createLoader } from './support/loadTsx.mjs'

const moduleUrl = file => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')
const geo = await import(moduleUrl('../src/skill-map/radarGeometry.ts'))
const { separate } = await import(moduleUrl('../src/skill-map/reliefSeparate.ts'))
const load = createLoader()
const root = new URL('../src/skill-map/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const { RadarPolygon, RadarTable } = load(`${root}RadarView.tsx`)
const { ReliefMap } = load(`${root}ReliefMap.tsx`)
const { TerritoryList } = load(`${root}SkillViews.tsx`)
const { skillMapEs } = load(`${root}copy.ts`)
const { radarItems } = load(`${root}radar.ts`)
const { territories } = load(`${root}territories.ts`)
const t = key => skillMapEs[key] ?? key
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const html = element => renderToStaticMarkup(createElement(MemoryRouter, null, element))

const track = level => (level ? { level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'x' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false } : null)
const skills = levels => levels.map((level, i) => ({ skillKey: `k${i}`, type: 'transversal', labels: { es: `Capacidad ${i + 1}`, en: `Skill ${i + 1}` }, territories: [['dir', 'con', 'com', 'ing', 'inn'][i % 5]],
  rubric: { levels: { 1: { es: 'a' }, 2: { es: 'b' }, 3: { es: 'c' }, 4: { es: 'd' } }, source: 's', verifiedAt: '2026-01-01' }, self: track(level), review: null, state: level ? 'initial' : 'no_evidence' }))
const poly = (levels, selected = null, viewport) => html(createElement(RadarPolygon, { items: radarItems(skills(levels)), selected, onSelect() {}, lang: 'es', t, viewport }))

test('ES-300: la forma del radar — sin nivel no hay punto; solo se unen vecinos con nivel; el relleno solo cuando todas tienen nivel', () => {
  const some = geo.radarShape([3, null, 2, 4, null, 1])
  assert.deepEqual(some.dots.map(d => d.index), [0, 2, 3, 5], 'puntos solo de las capacidades con nivel (null no es cero)')
  assert.equal(some.missing, 2); assert.equal(some.fill, null, 'sin relleno si falta alguna')
  assert.equal(some.segments.length, 1, 'solo 2→3: los vecinos con nivel se unen; el cierre 5→0 solo existe cuando TODAS tienen nivel')
  const all = geo.radarShape([3, 2, 4, 1])
  assert.equal(all.missing, 0); assert.ok(all.fill?.startsWith('M') && all.fill.endsWith('Z'), 'con todas, relleno'); assert.equal(all.segments.length, 4, 'con todas se cierra el último con el primero')
  const none = geo.radarShape([null, null, null])
  assert.deepEqual([none.dots.length, none.segments.length, none.fill], [0, 0, null])
  assert.equal(geo.radarShape([2]).segments.length, 0); assert.equal(geo.radarShape([]).fill, null)
  // el anillo exterior es el nivel 4 y un nivel 4 cae sobre él
  const four = geo.radarShape([4, 4, 4]); const end = geo.axisEnd(0, 3)
  assert.deepEqual([four.dots[0].x, four.dots[0].y], [end.x, end.y])
  assert.equal(geo.ringPath(7, 3).split('L').length, 7, 'un polígono de N lados por anillo (N = capacidades, no fijo en 8)')
})

test('ES-300: el modo del radar según cuántas capacidades y qué ventana (nombres hasta 12; con más, marcas solo en escritorio mientras quepan; si no, imagen + tabla)', () => {
  assert.deepEqual([1, 8, 12].map(n => geo.radarMode(n, 390)), ['named', 'named', 'named']); assert.deepEqual([1, 8, 12].map(n => geo.radarMode(n, 1360)), ['named', 'named', 'named'])
  assert.deepEqual([13, 16, 24].map(n => geo.radarMode(n, 1360)), ['marks', 'marks', 'marks']); assert.deepEqual([25, 100].map(n => geo.radarMode(n, 1360)), ['image', 'image'])
  assert.deepEqual([13, 16, 24, 30].map(n => geo.radarMode(n, 390)), ['image', 'image', 'image', 'image'], 'en móvil, más de 12 = imagen + tabla (las marcas de 24 px no caben sin solaparse)')
  assert.deepEqual([13, 16].map(n => geo.radarMode(n, 700)), ['image', 'image'], 'tableta (< 900 px) también')
  // en escritorio solo hay marcas mientras quepan sin solaparse (cuerda entre vecinas >= 34 px)
  for (const viewport of [900, 1024, 1360, 1920]) for (let n = 13; n <= 24; n++) if (geo.radarMode(n, viewport) === 'marks') assert.ok(2 * (Math.min(viewport, 1240) * 0.46 * 134 / 500) * Math.sin(Math.PI / n) >= 34, `${n} marcas a ${viewport} px: la cuerda entre vecinas debe ser ≥ 34 px (dos cuadrados de 24 px a ±45° no se solapan)`)
})

test('ES-300 (render): cada eje es un botón con nombre y «Nivel n de 4» o «Sin nivel», aria-pressed, puntos solo con nivel', () => {
  const out = poly([3, null, 2, 4], 'k2')
  assert.equal((out.match(/<button /g) ?? []).length, 4, 'un botón por capacidad')
  assert.ok(out.includes('<b>Capacidad 1</b><span>Nivel 3 de 4</span>') && out.includes('<b>Capacidad 2</b><span>Sin nivel</span>'), 'nombre y nivel en el contenido'); assert.ok(!out.includes('aria-label="Capacidad'), 'el nombre accesible sale del contenido (2.5.3): los ejes no llevan aria-label')
  assert.equal((out.match(/aria-pressed="true"/g) ?? []).length, 1); assert.ok(out.includes('aria-pressed="true"') && out.indexOf('<b>Capacidad 3</b>') > out.indexOf('aria-pressed="true"'))
  assert.equal((out.match(/<circle /g) ?? []).length, 3, 'tres puntos: la capacidad sin nivel no lleva punto')
  assert.ok(!out.includes('class="radar-fill"'), 'sin relleno porque falta una')
  assert.match(out, /role="img" aria-label="[^"]*3 de 4 capacidades tienen nivel/)
  const full = poly([1, 2, 3, 4]); assert.ok(full.includes('class="radar-fill"') && (full.match(/<circle /g) ?? []).length === 4, 'con todas: relleno y 4 puntos')
  const empty = poly([null, null, null]); assert.equal((empty.match(/<circle /g) ?? []).length, 0); assert.ok(!empty.includes('radar-line') && !empty.includes('radar-fill'))
})

test('ES-300 (render): N dinámico — con 12 nombres, con 16 solo marcas, con 30 imagen sin botones y la tabla abierta', () => {
  const twelve = poly(Array(12).fill(2)); assert.match(twelve, /radar-poly is-named/); assert.equal((twelve.match(/<button /g) ?? []).length, 12)
  const sixteen = poly(Array(16).fill(2)); assert.match(sixteen, /radar-poly is-marks/); assert.equal((sixteen.match(/<button /g) ?? []).length, 16); assert.ok(sixteen.includes('<b>Capacidad 16</b><span>Nivel 2 de 4</span>'))
  const mobile16 = poly(Array(16).fill(2), null, 390); assert.match(mobile16, /radar-poly is-image/); assert.equal((mobile16.match(/<button /g) ?? []).length, 0, 'en móvil con más de 12 el gráfico es imagen: sin marcas que se solapen')
  const thirty = poly(Array(30).fill(2)); assert.match(thirty, /radar-poly is-image/); assert.equal((thirty.match(/<button /g) ?? []).length, 0)
  const table = n => html(createElement(RadarTable, { items: radarItems(skills(Array(n).fill(null))), selected: null, onSelect() {}, lang: 'es', t }))
  assert.match(table(30), /<details class="radar-table" open="">/); assert.ok(!/<details class="radar-table" open/.test(table(12)))
  assert.equal((table(12).match(/<tr>/g) ?? []).length, 13, 'encabezado + una fila por capacidad: el mismo contenido que el gráfico')
  assert.match(table(3), /<th scope="col">Capacidad<\/th><th scope="col">Nivel<\/th>/); assert.match(table(3), /<th scope="row"><button[^>]*>Capacidad 1<\/button><\/th><td>Sin nivel<\/td>/)
})

const sample = (n, seed, w, h, labelW) => { let s = seed; const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }; return Array.from({ length: n }, () => ({ x: 40 + r() * (w - 80), y: 30 + r() * (h - 60), w: labelW, h: labelW === 28 ? 28 : 44, side: r() > 0.5 ? 'right' : 'left', ...(labelW === 28 ? { centered: true } : {}) })) }
const rectOf = s => (s.centered ? { l: s.x - s.w / 2, r: s.x + s.w / 2 } : s.side === 'right' ? { l: s.x + 8 - s.w, r: s.x + 8 } : { l: s.x - 8, r: s.x - 8 + s.w })
const overlaps = (slots, pos) => { let count = 0; slots.forEach((a, i) => slots.forEach((b, j) => { if (j <= i) return; const A = rectOf({ ...a, ...pos[i] }), B = rectOf({ ...b, ...pos[j] }); if (Math.min(A.r, B.r) - Math.max(A.l, B.l) > 0.5 && Math.min(pos[i].y + a.h / 2, pos[j].y + b.h / 2) - Math.max(pos[i].y - a.h / 2, pos[j].y - b.h / 2) > 0.5) count += 1 })); return count }

test('ES-300 (E258-2): separate() deja las marcas sin solape y dentro de la caja, y es determinista', () => {
  for (const [n, w, h, labelW] of [[1, 800, 500, 150], [12, 800, 500, 150], [16, 820, 512, 150], [12, 358, 448, 28], [30, 358, 448, 28], [24, 358, 448, 28]]) {
    const slots = sample(n, n * 7 + w, w, h, labelW)
    const out = separate(slots, { width: w, height: h })
    assert.deepEqual(out.positions, separate(slots, { width: w, height: h }).positions, 'misma entrada ⇒ misma salida')
    assert.equal(out.crowded, false, `N=${n} ${w}x${h}`)
    assert.equal(overlaps(slots, out.positions), 0, `N=${n} ${w}x${h}: ningún par se solapa`)
    out.positions.forEach((p, i) => { const r = rectOf({ ...slots[i], ...p }); assert.ok(r.l >= -0.5 && r.r <= w + 0.5 && p.y - slots[i].h / 2 >= -0.5 && p.y + slots[i].h / 2 <= h + 0.5, `N=${n} dentro de la caja`) })
  }
  const impossible = separate(sample(30, 5, 400, 300, 150), { width: 400, height: 300 })
  assert.equal(impossible.crowded, true, 'si no caben los rótulos lo dice (quien llama usa solo la marca)')
})

test('ES-300 (E258-5): el relieve lleva aria-label «nombre: Nivel n de 4» o «Sin evidencia vigente», is-flat solo sin nivel y aria-pressed', () => {
  const out = html(createElement(ReliefMap, { skills: skills([3, null, 2]), territories, selected: 'k0', onSelect() {}, lang: 'es', t }))
  assert.match(out, /aria-label="Capacidad 1: Nivel 3 de 4"/); assert.match(out, /aria-label="Capacidad 2: Sin evidencia vigente"/); assert.match(out, /aria-label="Capacidad 3: Nivel 2 de 4"/)
  const buttons = out.match(/<button [^>]*>/g) ?? []
  assert.equal(buttons.length, 3)
  assert.deepEqual(buttons.map(b => b.includes('is-flat')), [false, true, false], 'is-flat solo en la capacidad sin nivel')
  assert.deepEqual(buttons.map(b => b.includes('aria-pressed="true"')), [true, false, false])
  assert.ok(out.includes('cg-relief--loading'), 'el canvas espera al primer contenido (E258-4): primero el marco plano')
})

test('ES-300 (E258-3): la Lista dice «Nivel n de 4» en cada capacidad con nivel (autoevaluación) y nada en las que no lo tienen', () => {
  const out = html(createElement(TerritoryList, { skills: skills([3, null, 2]), territories, selected: null, onSelect() {}, lang: 'es', t }))
  assert.equal((out.match(/class="skill-map-pick-level">Nivel 3 de 4</g) ?? []).length, 1); assert.equal((out.match(/class="skill-map-pick-level">Nivel 2 de 4</g) ?? []).length, 1)
  assert.equal((out.match(/skill-map-pick-level/g) ?? []).length, 2, 'sin nivel no hay texto de nivel')
  assert.match(out, /Capacidad 1<\/span><span class="skill-map-pick-level">Nivel 3 de 4<\/span>/)
})

test('ES-300: las hojas nuevas no traen colores fijos ni estilos en línea salvo la posición (left/top) de cada botón', () => {
  for (const file of ['../src/skill-map/radarPolygon.css']) assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(read(file)), file)
  assert.equal((read('../src/skill-map/RadarView.tsx').match(/style=\{\{/g) ?? []).length, 1)
  assert.ok(read('../src/skill-map/RadarView.tsx').includes("style={{ left: `${place.left}%`, top: `${place.top}%` }}"))
  for (const key of ['radar_poly_alt', 'radar_with', 'radar_poly_intro', 'radar_gap', 'radar_gap_one', 'radar_no_level', 'radar_table', 'radar_col_skill', 'radar_col_level', 'radar_many']) assert.ok(skillMapEs[`skill_map.${key}`], key)
})

test('ES-300: los anillos están a R/4, R/2, 3R/4 y R del centro (cambiar el radio o el nivel del anillo rompe la prueba)', () => {
  const distance = (point) => Math.hypot(point.x - geo.POLY_CENTER.x, point.y - geo.POLY_CENTER.y)
  for (const level of [1, 2, 3, 4]) for (let index = 0; index < 6; index++) assert.ok(Math.abs(distance(geo.polyPoint(index, 6, (geo.POLY_RADIUS * level) / geo.POLY_LEVELS)) - (geo.POLY_RADIUS * level) / 4) < 0.1)
  assert.equal(geo.POLY_RADIUS, 120); assert.equal(geo.POLY_LEVELS, 4)
  const first = geo.ringPath(4, 4).split('L')[0]; assert.equal(first, 'M250 80', 'el anillo exterior (nivel 4) pasa por R = 120 sobre el eje vertical')
  assert.equal(geo.ringPath(4, 1).split('L')[0], 'M250 170', 'el anillo 1 está a R/4 = 30')
  assert.deepEqual([geo.radarShape([4, 4, 4]).dots[0].y, geo.radarShape([1, 1, 1]).dots[0].y], [80, 170], 'un nivel 4 cae sobre el anillo exterior y un 1 sobre el primero')
})
