// ES-183: la pantalla de métricas del piloto no muestra cifras de metas (decisión 31) y el modo por defecto no pide nada al servidor.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/pilot/copy.ts'

const page = fs.readFileSync(new URL('../src/pilot/PilotMetricsPage.tsx', import.meta.url), 'utf8')

test('ES-183: las metas dicen «en definición» y no llevan cifras; el umbral de «datos protegidos» se nombra', () => {
  assert.doesNotMatch(page, /5\/6|4\/6|day7|day30/)
  assert.equal(copy.es.targetPending, 'Meta en definición'); assert.equal(copy.en.targetPending, 'Target being defined')
  assert.match(copy.es.protected, /menos de 5 personas/); assert.match(copy.en.protected, /fewer than 5 people/)
  assert.match(copy.es.targetWarning, /no son resultados/); assert.match(copy.en.targetWarning, /not achieved results/)
})

test('ES-183: por defecto no hay ninguna petición (sin fetch ni repositorio); la vista preliminar usa solo el repositorio sintético tras la bandera', () => {
  assert.doesNotMatch(page, /fetch\(|axios|XMLHttpRequest|\/api\//)
  const noData = page.slice(page.indexOf('function NoData()'), page.indexOf('function MetricsSession'))
  assert.doesNotMatch(noData, /repository|useEffect|load\(/)
  assert.match(noData, /disabled aria-describedby="metrics-refresh-note"/)
  assert.match(page, /previewEnabled\(import\.meta\.env\.VITE_ENABLE_PILOT_FEEDBACK_PREVIEW\)/); assert.match(page, /createFixtureRepository/)
})
