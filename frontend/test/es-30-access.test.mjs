import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); tsc comprueba los tipos aparte.
function moduleUrl(file, replacements = []) {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  for (const [from, to] of replacements) code = code.replaceAll(from, to)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = moduleUrl('../src/skill-map/model.ts')
const { noLevelAnywhere } = await import(moduleUrl('../src/skill-map/status.ts', [["'./model'", JSON.stringify(modelUrl)]]))
const { skillMapEs, skillMapEn } = await import(moduleUrl('../src/skill-map/copy.ts'))
const { contextEs, contextEn } = await import(moduleUrl('../src/context/contextCopy.ts'))
const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')

const track = (over = {}) => ({ level: 2, state: 'initial', stale: false, catalogOutdated: false, confidence: 'low', confidenceReason: { es: 'a', en: 'a' }, evidenceCount: 1, authoring: 'person', rationale: null, needsReview: false, ...over })
const skill = (over = {}) => ({ skillKey: 'k', type: 'transversal', labels: { es: 'K' }, rubric: {}, self: null, review: null, state: 'no_evidence', ...over })

test('ES-30 acceso: la guía solo aparece con capacidades y NINGUNA con nivel vigente; se oculta en cuanto una lo tiene', () => {
  assert.equal(noLevelAnywhere([]), false) // catálogo vacío: se mantiene el aviso actual, no la guía
  assert.equal(noLevelAnywhere([skill(), skill({ skillKey: 'b' })]), true)
  assert.equal(noLevelAnywhere([skill({ self: track({ level: null, evidenceCount: 0 }) })]), true) // nivel null = sin evidencia
  assert.equal(noLevelAnywhere([skill({ self: track({ stale: true, level: 4 }) })]), true) // caducado no cuenta como nivel
  assert.equal(noLevelAnywhere([skill(), skill({ skillKey: 'b', self: track() })]), false)
  assert.equal(noLevelAnywhere([skill({ review: track({ level: 3 }) })]), false)
  assert.equal(noLevelAnywhere([skill({ self: track({ needsReview: true }) })]), false) // pide revisión pero tiene nivel vigente
})
test('ES-30 acceso: inicio con la tarjeta del mapa antes que lo demás y sin el botón plano', () => {
  const dash = read('../src/pages/UserDashboard.tsx')
  assert.match(dash, /<MapAccessCard \/>\s*<CareerEntry \/>/)
  assert.equal(/skill-map-entry/.test(dash), false)
  const nav = read('../src/space/SpaceNav.tsx')
  assert.equal((nav.match(/to="\/app\/skill-map"/g) || []).length, 1)
  assert.match(nav, /\{c\.map\}/)
  const space = read('../src/space/copy.ts')
  assert.match(space, /map: 'Mapa de competencias'/); assert.match(space, /map: 'Skills map'/)
})
test('ES-30 acceso: la tarjeta no pide datos al servidor ni muestra datos de la persona; la ilustración es decorativa', () => {
  const card = read('../src/skill-map/MapAccess.tsx')
  assert.equal(/fetch|readSkillMap|localStorage|useEffect|useState/.test(card), false)
  assert.match(card, /<svg[^>]*aria-hidden="true"/)
  assert.match(card, /to="\/app\/skill-map"/); assert.match(card, /to="\/app\/evidence"/)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(read('../src/skill-map/mapAccess.css')), false)
})
test('ES-30 acceso: el registro guardado ofrece «Siguiente paso» hacia el mapa y el inicio; la página del mapa muestra la guía solo si corresponde', () => {
  const form = read('../src/context/ParticipantContextForm.tsx')
  assert.match(form, /context-next-title[\s\S]*leave\('\/app\/skill-map'\)[\s\S]*leave\('\/app\/dashboard'\)/)
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.match(page, /noLevelAnywhere\(map\.skills\) && <MapGuide \/>/)
})
test('ES-30 acceso: textos ES/EN completos, sin porcentajes ni promesas de nivel automático', () => {
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort())
  assert.deepEqual(Object.keys(contextEs).sort(), Object.keys(contextEn).sort())
  for (const k of ['access_text', 'access_cta', 'guide_title', 'guide_text', 'guide_1', 'guide_2', 'guide_3', 'guide_cta']) {
    assert.ok(skillMapEs[`skill_map.${k}`]?.trim() && skillMapEn[`skill_map.${k}`]?.trim(), k)
    assert.equal(/%|déficit garantizado|garantiz|automátic|automatic/i.test(skillMapEs[`skill_map.${k}`] + skillMapEn[`skill_map.${k}`]), false, k)
  }
  for (const k of ['context_next_title', 'context_next_text', 'context_next_map', 'context_next_home']) assert.ok(contextEs[k]?.trim() && contextEn[k]?.trim(), k)
})
