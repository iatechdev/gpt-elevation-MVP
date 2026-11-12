// ES-160: el mapa usa Cartografía dentro del marco de persona. Estructura (sin estilos en línea ni texto fijo, claves ES/EN), lógica pura del relieve y reglas de datos
// (la autoevaluación pinta el relieve; sin nivel = plano, nunca cero); el comportamiento y la accesibilidad los mide scripts/es160-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { placeSkills, reliefLevel } from '../src/skill-map/reliefPlace.ts'
import { territories } from '../src/skill-map/territories.ts'
import { contrastRatio } from '../src/cartografia/contrast.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const track = (level, over = {}) => ({ level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'medium', confidenceReason: { es: 'x' }, evidenceCount: 2, authoring: 'person', rationale: null, needsReview: false, ...over })
const skill = (key, over = {}) => ({ skillKey: key, type: 'transversal', labels: { es: key }, rubric: { levels: {}, source: 's', verifiedAt: '2026-01-01' }, self: null, review: null, state: 'no_evidence', territories: ['dir'], ...over })

test('ES-160: el relieve pinta la AUTOEVALUACIÓN; una pista desactualizada o sin nivel es plano (null), nunca cero', () => {
  assert.equal(reliefLevel(skill('a', { self: track(3), review: track(1) })), 3) // la revisión humana va solo en el detalle
  assert.equal(reliefLevel(skill('b', { self: null, review: track(4) })), null)
  assert.equal(reliefLevel(skill('c', { self: track(2, { stale: true }) })), null)
  assert.equal(reliefLevel(skill('d', { self: track(null) })), null)
})

test('ES-160: cada capacidad tiene una posición 0–1 determinista; las que no tienen territorio van en una fila al pie, en orden', () => {
  const skills = [skill('a', { self: track(2), territories: ['dir'] }), skill('b', { territories: ['con', 'ing'] }), skill('u1', { territories: [] }), skill('u2', { territories: ['desconocido'] })]
  const first = placeSkills(skills, territories), again = placeSkills(skills, territories)
  assert.deepEqual(first, again, 'mismo catálogo → misma disposición')
  assert.equal(first.length, 4)
  for (const item of first) { assert.ok(item.x > 0 && item.x < 1 && item.y > 0 && item.y < 1, item.skill.skillKey) }
  const row = first.filter(item => ['u1', 'u2'].includes(item.skill.skillKey))
  assert.deepEqual(row.map(item => item.y), [0.94, 0.94]); assert.ok(row[0].x < row[1].x)
  assert.equal(first.find(item => item.skill.skillKey === 'a').level, 2)
  assert.equal(first.find(item => item.skill.skillKey === 'b').level, null)
})

test('ES-160: la pantalla y sus piezas nuevas no usan estilos en línea ni texto fijo; los textos salen de claves ES/EN', () => {
  const files = ['../src/skill-map/ReliefMap.tsx', '../src/skill-map/MapSummary.tsx', '../src/pages/SkillMapPage.tsx']
  for (const file of files) {
    const src = read(file)
    if (!file.endsWith('ReliefMap.tsx')) assert.ok(!src.includes('style={{'), `${file} sin estilos en línea`)
    assert.ok(!/lang === 'es' \?/.test(src), `${file} sin textos decididos por idioma`)
  }
  const relief = read('../src/skill-map/ReliefMap.tsx')
  assert.equal((relief.match(/style=\{\{/g) ?? []).length, 1, 'solo la posición de cada botón (left/top) va en línea: es un dato, no un estilo')
  assert.ok(relief.includes('style={{ left: `${x * 100}%`, top: `${y * 100}%` }}'))
  const copy = read('../src/skill-map/copy.ts')
  for (const key of ['view_relief', 'view_list_short', 'relief_reading', 'relief_alt']) assert.equal((copy.match(new RegExp(`'skill_map\.${key}'`, 'g')) ?? []).length, 2, key)
})

test('ES-160: tres vistas (Relieve por defecto, Lista, Radar) dentro de PersonFrame; el radar no se elimina', () => {
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.ok(page.includes('<PersonFrame migrated>'))
  assert.ok(page.includes("useState<'relief' | 'list' | 'radar'>('relief')"))
  for (const view of ['relief', 'list', 'radar']) assert.ok(page.includes(`setView('${view}')`), view)
  assert.ok(page.includes('<RadarBoard') && !/<main[ >]/.test(page.replace(/\/\/[^\n]*/g, '')), 'el <main> lo pone el marco')
  const frames = read('../src/shell/frames.tsx')
  assert.ok(frames.includes("mainClassName={migrated ? '' : 'elv-theme'} theme={migrated ? 'system' : 'light'}"), 'solo la pantalla migrada cambia de tema; el resto de /app/* queda igual')
})

test('ES-160: los pares clave del mapa cumplen WCAG AA en claro y oscuro (tokens de Cartografía)', () => {
  const light = { ground: '#e7ece8', panel: '#f2f5f2', ink: '#14201c', muted: '#475550', mark: '#1d4f91', err: '#a8321d', contour: '#8f5a33' }
  const dark = { ground: '#0e1613', panel: '#15201c', ink: '#e9efeb', muted: '#9daaa4', mark: '#7fb0e8', err: '#ff8a70', contour: '#c9976a' }
  for (const [name, p] of [['claro', light], ['oscuro', dark]]) {
    for (const [fg, bg, min] of [['ink', 'ground', 4.5], ['ink', 'panel', 4.5], ['muted', 'panel', 4.5], ['muted', 'ground', 4.5], ['mark', 'panel', 4.5], ['ground', 'mark', 4.5], ['ground', 'err', 4.5], ['contour', 'panel', 3]])
      assert.ok(contrastRatio(p[fg], p[bg]) >= min, `${name}: ${fg} sobre ${bg} = ${contrastRatio(p[fg], p[bg]).toFixed(2)}`)
  }
})
