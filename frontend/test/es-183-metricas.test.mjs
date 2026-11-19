// ES-183: la pantalla de métricas del piloto no muestra cifras de metas (decisión 31) y el modo por defecto no pide nada al servidor.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/pilot/copy.ts'

// Solo el código: las líneas de comentario (que citan la ruta futura del servidor) no cuentan.
const page = fs.readFileSync(new URL('../src/pilot/PilotMetricsPage.tsx', import.meta.url), 'utf8').split(/\r?\n/).filter(line => !line.trim().startsWith('//')).join('\n')

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

// ES-310 (ES-349): la pantalla va dentro del marco de Administración, con piezas de Cartografía, sin estilos en línea ni clases antiguas; la lógica de carga no cambia.
test('ES-349: métricas del piloto en Cartografía: sin PreviewShell, sin estilos en línea ni colores propios, estados con chip y error con Banner', () => {
  const raw = fs.readFileSync(new URL('../src/pilot/PilotMetricsPage.tsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/pilot/pilotMetrics.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(page, /PreviewShell|style=\{\{|elv-|pilot-card|pilot-grid|#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|--elv-|--color-/)
  assert.match(raw, /import \{ Banner, Button, Card, Chip \} from '\.\.\/cartografia'/)
  assert.match(raw, /<Banner kind="note" title=\{c\.preview\}>/); assert.match(raw, /<Banner kind="error" title=\{c\.loadError\}>/)
  assert.match(raw, /STATUS_TONE: Record<string, \{ tone: ChipTone; symbol\?: string \}> = \{ ready: \{ tone: 'ok', symbol: '✓' \}, suppressed: \{ tone: 'wait' \} \}/)
  assert.equal((page.match(/<h1 className="pg-title">/g) || []).length, 2, 'un h1 por modo, nunca dos a la vez')
  assert.match(fs.readFileSync(new URL('../src/shell/adminLayoutState.ts', import.meta.url), 'utf8'), /'\/admin\/pilot-metrics'/)
})
