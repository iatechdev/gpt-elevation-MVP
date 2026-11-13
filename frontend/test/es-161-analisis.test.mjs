// ES-161: el análisis con IA del mapa (tres pasos) y el diálogo de revocación con Cartografía. Estructura y reglas puras; el comportamiento, el teclado y axe los mide scripts/es161-check.cjs en navegador,
// y «una propuesta nueva no pisa decisiones» lo prueba backend/test/integration/es-161-postgres.cjs con PostgreSQL real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Se ejecuta el TS de producción (no una reimplementación); las reglas de elección ya las prueban es-30-ai (nunca subir).
const moduleUrl = file => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString('base64')
const { skillMapEn, skillMapEs } = await import(moduleUrl('../src/skill-map/copy.ts'))

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
test('ES-161: el panel muestra el nivel con «nivel n de 4» (LevelTicks) y un indicador de pasos con paso actual y hechos; sin los cuadros de calor del radar', () => {
  const panel = read('../src/skill-map/AiAnalysisPanel.tsx')
  assert.ok(panel.includes('<LevelTicks level={proposal.level} t={t} />') && !panel.includes('radar-swatch'))
  assert.ok(panel.includes("aria-current={i + 1 === n ? 'step' : undefined}") && panel.includes("i + 1 < n ? 'is-done' : undefined") && panel.includes("t('skill_map.ai_step_done')"))
  assert.ok(panel.includes('role="alert" className="ai-error"'), 'los errores se anuncian')
  for (const piece of ['newRequestId', 'requestId.current ??=', 'choicesFor(proposal, current)', 'buildConfirmBody', "step === 'noev'"]) assert.ok(panel.includes(piece), piece)
})

test('ES-161: la hoja de Cartografía del panel y del diálogo no trae colores fijos ni estilos en línea y respeta prefers-reduced-motion', () => {
  const css = read('../src/skill-map/aiCartografia.css')
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(css), 'todo sale de --cg-*')
  assert.ok(!/\bstyle=\{\{/.test(read('../src/skill-map/AiAnalysisPanel.tsx')))
  for (const rule of ['.cg-map .ai-steps', '.cg-map .ai-prop', '.cg-map .ai-error', '.cg-map .skill-map-dialog']) assert.ok(css.includes(rule), rule)
  assert.ok(read('../src/skill-map/radar.css').includes('prefers-reduced-motion'), 'la animación del indicador de análisis se apaga')
})

test('ES-161: el diálogo de revocación sigue siendo el <dialog> nativo (foco, Esc) y el panel se abre también desde las vistas Relieve y Lista, devolviendo el foco al cerrar', () => {
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.ok(page.includes('<dialog ref={dialogRef} className="skill-map-dialog"') && page.includes('dialog.showModal()') && page.includes('onCancel='))
  assert.ok(page.includes("{state.status === 'ready' && view !== 'radar' && <button") && page.includes('openAi(state.map.skills.slice(0, MAX_SKILLS)'))
  assert.ok(page.includes('aiOpener.current') && page.includes('target?.isConnected') && page.includes('onClose={closeAi}'))
})

test('ES-161: los textos nuevos existen en ES y EN y no hay números de contacto ni diagnóstico escritos', () => {
  for (const key of ['skill_map.ai_step_done']) { assert.ok(skillMapEs[key], key); assert.ok(skillMapEn[key], key) }
  assert.deepEqual(Object.keys(skillMapEs).sort(), Object.keys(skillMapEn).sort(), 'mismas claves en ES y EN')
})
