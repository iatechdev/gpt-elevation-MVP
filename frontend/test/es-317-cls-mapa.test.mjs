// ES-317: CLS de /app/skill-map con el mapa cargado. Reglas estructurales; el CLS real (API simulada con 12 capacidades), el estado de carga y axe los mide scripts/es317-cls-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-317: «Analizar con IA» ocupa su sitio desde la carga y se habilita al estar el mapa listo (fuera del radar)', () => {
  const page = read('../src/pages/SkillMapPage.tsx')
  assert.ok(page.includes("{view !== 'radar' && <button type=\"button\" className=\"elv-btn skill-map-primary\" disabled={state.status !== 'ready'}"), 'siempre presente salvo en radar, deshabilitado hasta que el mapa está listo')
  assert.ok(page.includes("if (state.status === 'ready') openAi("), 'sin mapa no abre el análisis')
  assert.ok(!page.includes("{state.status === 'ready' && view !== 'radar' && <button"), 'ya no aparece de golpe al llegar el mapa')
})

test('ES-317: el pie no se pinta mientras el mapa carga (mismo patrón que E280-2)', () => {
  assert.ok(read('../src/pages/SkillMapPage.tsx').includes("data-loading={state.status === 'loading' ? '' : undefined}"))
  const css = read('../src/shell/shell.css')
  assert.ok(css.includes('.cg-frame:has(.cg-screen-loading) .cg-footer { visibility: hidden; }'), 'la regla de E280-2 sigue')
  assert.ok(css.includes('.cg-frame:has(.skill-map-scope[data-loading]) .cg-footer { visibility: hidden; }'))
})

test('ES-317: el título tiene respaldo de ancho ajustado (68 %, medido en E272-1) y no cambia en reposo', () => {
  const css = read('../src/skill-map/mapCartografia.css')
  assert.ok(css.includes("font-family: 'Barlow Condensed Fallback'; src: local('Arial'), local('Liberation Sans'), local('Helvetica'); font-weight: 400 700; size-adjust: 68%;"))
  assert.ok(css.includes("'Barlow Condensed', 'Barlow Condensed Fallback', 'Arial Narrow', system-ui, sans-serif; letter-spacing: 0.02em; text-transform: uppercase; }"), 'primero Barlow Condensed (en reposo se ve la misma)')
})
