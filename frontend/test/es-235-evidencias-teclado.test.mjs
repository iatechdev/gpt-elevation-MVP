// ES-235: teclado en «Mis evidencias». «Ver todas» pasa el foco al radio «Todas» (el botón desaparece al usarse) y Esc cierra el diálogo de borrar devolviendo el foco.
// Estructura; el comportamiento real lo mide scripts/es164-check.cjs en navegador (foco con document.activeElement).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pages/EvidencePages.tsx', import.meta.url), 'utf8')

test('ES-235: «Ver todas» activa el radio «Todas» y le pasa el foco', () => {
  assert.match(page, /<input ref=\{value === 'all' \? allRadio : undefined\} type="radio" name="evidence-status"/)
  assert.match(page, /onClick=\{\(\) => \{ setFilter\('all'\); setFocusAll\(true\) \}\}/)
  assert.match(page, /useEffect\(\(\) => \{ if \(focusAll\) \{ allRadio\.current\?\.focus\(\); setFocusAll\(false\) \} \}/)
})

test('ES-235: Esc en el diálogo de borrar lo cierra por el mismo camino que «Cancelar» (que devuelve el foco)', () => {
  assert.match(page, /role="alertdialog" onKeyDown=\{event => modalKeyDown\(event, dialog\.current, cancel\)\}/) // ES-236: Esc + Tab atrapado en el helper común
  assert.match(page, /const cancel = \(\) => \{ if \(busy\) return; setConfirmId\(null\); window\.setTimeout\(\(\) => opener\.current\?\.focus\(\), 0\) \}/)
})
