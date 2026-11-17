// ES-235: teclado en «Mis evidencias». «Ver todas» pasa el foco al radio «Todas» (el botón desaparece al usarse) y Esc cierra el diálogo de borrar devolviendo el foco.
// Estructura; el comportamiento real lo mide scripts/es164-check.cjs en navegador (foco con document.activeElement).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/EvidencePages.tsx', import.meta.url), 'utf8')

test('ES-235: «Ver todas» activa el radio «Todas» y le pasa el foco', () => {
  // ES-308 (PR 2): los radios son los del <ScaleField> de Cartografía (sin ref propio): el foco se pasa al radio value="all" dentro del contenedor del filtro.
  assert.match(page, /<div ref=\{filterBox\}><ScaleField legend=\{t\('evidence\.filter_status'\)\} name="evidence-status"/)
  assert.match(page, /onClick=\{\(\) => \{ setFilter\('all'\); setFocusAll\(true\) \}\}/)
  assert.match(page, /useEffect\(\(\) => \{ if \(focusAll\) \{ filterBox\.current\?\.querySelector<HTMLInputElement>\('input\[value="all"\]'\)\?\.focus\(\); setFocusAll\(false\) \} \}/)
})

test('ES-235: Esc en el diálogo de borrar lo cierra por el mismo camino que «Cancelar» (que devuelve el foco)', () => {
  // ES-308 (PR 2): el diálogo es el <Dialog> de Cartografía: Esc (onCancel) y «Cancelar» van por el mismo `cancel` (que respeta el bloqueo mientras se borra) y el Dialog devuelve el foco al botón que lo abrió.
  assert.match(page, /<Dialog open=\{confirmId !== null\} onClose=\{cancel\}/)
  assert.match(page, /<Button variant="ghost" disabled=\{busy\} onClick=\{cancel\}>\{t\('evidence\.delete_cancel'\)\}<\/Button>/)
  assert.match(page, /const cancel = \(\) => \{ if \(busy\) return; setConfirmId\(null\) \}/)
  const dialogSource = readFileSync(new URL('../src/cartografia/interactive.tsx', import.meta.url), 'utf8')
  assert.match(dialogSource, /onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\) \}\}/); assert.match(dialogSource, /target\.focus\(\)/)
})
