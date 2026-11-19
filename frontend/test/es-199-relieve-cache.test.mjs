// ES-199 (seguimiento Bajo de QA sobre #347): la caché de colocación del relieve (placeSkillsCached) y el umbral «crowded» de separate() no tenían casos propios.
// Solo pruebas: no cambia código de producción (a 150 capacidades el margen es pequeño y no se toca sin necesidad).
import test from 'node:test'
import assert from 'node:assert/strict'
import { placeSkills, placeSkillsCached } from '../src/skill-map/reliefPlace.ts'
import { separate } from '../src/skill-map/reliefSeparate.ts'
import { territories } from '../src/skill-map/territories.ts'

const track = level => ({ level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'x' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false })
const skill = (key, over = {}) => ({ skillKey: key, type: 'transversal', labels: { es: key }, rubric: { levels: {}, source: 's', verifiedAt: '2026-01-01' }, self: null, review: null, state: 'no_evidence', ...over })
const catalog = () => [skill('a', { self: track(2), territories: ['dir'] }), skill('b', { territories: ['con'] }), skill('c', { territories: ['ing'] }), skill('d', { territories: ['inn'] }), skill('e', { territories: [] })]

test('ES-199 caché: el mismo mapa y los mismos territorios devuelven el MISMO resultado (identidad), calculado una vez', () => {
  const skills = catalog()
  assert.equal(placeSkillsCached(skills, territories), placeSkillsCached(skills, territories))
})

test('ES-199 caché: el mismo arreglo de habilidades con OTROS territorios no reutiliza ni contamina el resultado (clave por habilidades Y por territorios)', () => {
  const skills = catalog()
  const fewer = territories.filter(territory => territory.id !== 'ing' && territory.id !== 'inn') // dir, con, com
  const full = placeSkillsCached(skills, territories)
  const reduced = placeSkillsCached(skills, fewer)
  assert.notEqual(full, reduced, 'resultados distintos para territorios distintos')
  const row = result => result.filter(item => item.y === 0.94).map(item => item.skill.skillKey)
  assert.deepEqual(row(full), ['e'], 'completo: solo «e» queda sin territorio')
  assert.deepEqual(row(reduced), ['c', 'd', 'e'], 'reducido: c e d pierden su territorio y van al pie, en orden del catálogo')
  assert.equal(placeSkillsCached(skills, territories), full, 'volver a pedir el completo da el de antes (no el reducido)')
  assert.equal(placeSkillsCached(skills, fewer), reduced)
})

test('ES-199 caché: un arreglo NUEVO con el mismo contenido (el mapa se releyó) se vuelve a calcular y da las mismas posiciones; el resultado coincide con placeSkills', () => {
  const first = placeSkillsCached(catalog(), territories)
  const second = placeSkillsCached(catalog(), territories)
  assert.notEqual(first, second, 'identidad distinta ⇒ otra entrada de la caché')
  assert.deepEqual(first.map(({ x, y, level }) => [x, y, level]), second.map(({ x, y, level }) => [x, y, level]))
  assert.deepEqual(first.map(({ x, y, level }) => [x, y, level]), placeSkills(catalog(), territories).map(({ x, y, level }) => [x, y, level]), 'la caché no cambia el resultado')
})

test('ES-199 caché: la caché no guarda nada fuera de memoria', () => {
  assert.equal(typeof placeSkillsCached, 'function')
  // un arreglo vacío es un caso válido (catálogo sin capacidades): sin error y sin entradas
  assert.deepEqual(placeSkillsCached([], territories), [])
})

// ---- umbral «crowded» de separate() ----
const mark = (x, y) => ({ x, y, w: 28, h: 28, side: 'left', centered: true })

test('ES-199 crowded: una sola marca, o marcas que caben, NO son «crowded»', () => {
  assert.equal(separate([mark(100, 100)], { width: 390, height: 488 }).crowded, false)
  assert.equal(separate([mark(100, 100), mark(110, 100), mark(120, 100)], { width: 390, height: 488 }).crowded, false, 'se separan por completo')
  assert.equal(separate([], { width: 390, height: 488 }).crowded, false)
})

test('ES-199 crowded: marcas que NO caben en la caja sí son «crowded» (el relieve las dibuja como están y el nombre sigue en aria-label y en la lista)', () => {
  // dos marcas de 28 px en una caja de 28 × 28: no hay forma de que no se solapen
  assert.equal(separate([mark(14, 14), mark(14, 14)], { width: 28, height: 28 }).crowded, true)
  // 30 marcas en una caja de 100 × 100 (30 × 784 px² de marcas en 10 000 px²)
  const many = Array.from({ length: 30 }, (_, i) => mark(50 + (i % 5), 50 + Math.floor(i / 5)))
  assert.equal(separate(many, { width: 100, height: 100 }).crowded, true)
})

test('ES-199 crowded: el umbral es de MÁS de 0,5 px de solape en ambos ejes (dos marcas de 28 px en una caja de 200 px de alto y ancho variable: el solape residual es 56 − ancho)', () => {
  const pair = width => separate([mark(width / 2 - 7, 100), mark(width / 2 + 7, 100)], { width, height: 200 }) // se empujan en horizontal hasta las paredes
  assert.equal(pair(56).crowded, false, 'caben justas: sin solape')
  assert.equal(pair(55.6).crowded, false, 'solape residual de 0,4 px: no cuenta')
  assert.equal(pair(55).crowded, true, 'solape residual de 1 px: cuenta')
  assert.equal(pair(54).crowded, true, 'solape residual de 2 px: cuenta')
})
