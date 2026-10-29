import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
const moduleUrl = (file, replace = []) => {
  let source = readFileSync(new URL(file, import.meta.url), 'utf8')
  for (const [a, b] of replace) source = source.replace(a, b)
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = moduleUrl('../src/skill-map/model.ts')
const radar = await import(moduleUrl('../src/skill-map/radar.ts', [["from './model'", `from '${modelUrl}'`]]))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))
const read = f => readFileSync(new URL(f, import.meta.url), 'utf8')

const track = (level, extra = {}) => ({ level, state: 'initial', stale: false, catalogOutdated: false, confidence: 'low', confidenceReason: { es: 'x' }, evidenceCount: level === null ? 0 : 1, authoring: 'person', rationale: null, needsReview: false, ...extra })
const skill = (key, self = null, review = null) => ({ skillKey: key, type: 'transversal', labels: { es: key, en: key }, rubric: { levels: { 1: { es: 'a' }, 2: { es: 'b' }, 3: { es: 'c' }, 4: { es: 'd' } }, source: 's', verifiedAt: '2026-01-01T00:00:00Z' }, self, review, state: 'no_evidence' })

test('ES-30 radar: sin evidencia el nivel es null (hueco), nunca 0; nada se promedia', () => {
  const items = radar.radarItems([skill('a'), skill('b', track(null)), skill('c', track(3))])
  assert.deepEqual(items.map(i => i.level), [null, null, 3])
  assert.equal(radar.anyLevel(radar.radarItems([skill('a'), skill('b')])), false)
})
test('ES-30 radar: con dos pistas distintas muestra la más baja (no sobrestima ni promedia); una desactualizada no aporta nivel', () => {
  assert.equal(radar.radarItems([skill('a', track(4), track(2))])[0].level, 2)
  const stale = radar.radarItems([skill('a', track(3, { stale: true, state: 'stale' }))])[0]
  assert.equal(stale.level, null); assert.equal(stale.stale, true)
  assert.equal(radar.radarItems([skill('a', track(3, { stale: true, state: 'stale' }), track(2))])[0].level, 2)
})
test('ES-30 radar: puntos fuertes = hasta 3 con nivel, ordenados por nivel, evidencias y orden del catálogo; no se rellena con vacíos', () => {
  const items = radar.radarItems([skill('a', track(2)), skill('b', track(4)), skill('c', track(null)), skill('d', track(4, { evidenceCount: 5 })), skill('e', track(3)), skill('f', track(4))])
  assert.deepEqual(radar.strongest(items).map(i => i.skill.skillKey), ['d', 'b', 'f'])
  assert.deepEqual(radar.strongest(radar.radarItems([skill('a', track(1)), skill('b')])).map(i => i.skill.skillKey), ['a'])
  assert.deepEqual(radar.strongest(radar.radarItems([skill('a'), skill('b')])), [])
})
test('ES-30 radar: «un punto a mejorar» es la capacidad con nivel más bajo y su nivel siguiente; en nivel 4 o sin niveles no hay propuesta', () => {
  const items = radar.radarItems([skill('a', track(3)), skill('b', track(1)), skill('c', track(1)), skill('d')])
  const next = radar.improvement(items)
  assert.equal(next.item.skill.skillKey, 'b'); assert.equal(next.next, 2)
  assert.equal(radar.improvement(radar.radarItems([skill('a', track(4)), skill('b')])), null)
  assert.equal(radar.improvement(radar.radarItems([skill('a')])), null)
})
test('ES-30 radar: geometría determinista, dentro del radio y con una cuña por capacidad (de 1 a 24)', () => {
  for (const total of [1, 2, 3, 8, 24]) {
    for (let i = 0; i < total; i++) {
      const a = radar.wedge(i, total, 4), b = radar.wedge(i, total, 2), none = radar.wedge(i, total, null)
      assert.equal(a.path, radar.wedge(i, total, 4).path)
      assert.equal(none.path, a.path, 'el hueco ocupa el sector completo')
      assert.notEqual(b.path, a.path)
      assert.match(a.path, /^M280,250 L[\d.-]+,[\d.-]+ A[\d.]+,[\d.]+ 0 [01] 1 [\d.-]+,[\d.-]+ Z$/)
    }
  }
  assert.deepEqual(radar.wrapName('Planificación y organización de proyectos largos'), ['Planificación y', 'organización de', 'proyectos largos'])
})
test('ES-30 pantalla: cada cuña es un botón operable con teclado, con nombre y nivel; la lista de texto es la alternativa', () => {
  const view = read('../src/skill-map/RadarView.tsx')
  assert.match(view, /role="button" tabIndex=\{0\}/); assert.match(view, /event\.key === 'Enter' \|\| event\.key === ' '/)
  assert.match(view, /aria-pressed=\{active\}/); assert.match(view, /radar-none/); assert.match(view, /radar-list/)
  assert.equal(/dangerouslySetInnerHTML|innerHTML/.test(view), false)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(read('../src/skill-map/radar.css')), false, 'solo tokens')
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.match(page, /useState<'radar' \| 'territories'>\('radar'\)/); assert.match(page, /<RadarBoard/); assert.match(page, /<TerritoryMap/)
})
test('ES-30 textos del radar: ES y EN completos; «Conviene revisar» ya no promete una persona revisora', () => {
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
  for (const k of ['view_radar', 'view_territories', 'radar_title', 'radar_alt', 'radar_none', 'radar_level_of', 'radar_strong', 'radar_improve', 'radar_to_level', 'radar_empty_title', 'radar_list_title', 'radar_note', 'radar_reading']) {
    assert.ok(skillMapEs[`skill_map.${k}`]?.trim() && skillMapEn[`skill_map.${k}`]?.trim(), k)
  }
  assert.equal(skillMapEs['skill_map.contradictory'], 'Conviene revisar'); assert.equal(skillMapEn['skill_map.contradictory'], 'Worth reviewing')
  assert.match(skillMapEs['skill_map.radar_level_of'], /\{n\}.*\{max\}/)
})
