// ES-236: teclado común de los diálogos modales con contenedor. Esc cierra por el camino de «Cancelar»; Tab y Shift+Tab ciclan dentro.
// Cubre: evidencias (borrar), hojas de vida (borrar versión y retirar autorización). El comportamiento real lo mide scripts/es236-check.cjs en navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { modalKeyDown } from '../src/a11y/modalKeys.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

function fakeDom(activeIndex) {
  // 3 controles dentro de un contenedor; document.activeElement apunta al control activo.
  const items = [0, 1, 2].map(i => ({ id: i, offsetParent: {}, focus() { globalThis.document.activeElement = this } }))
  const container = { querySelectorAll: () => items, contains: element => items.includes(element) || element === container, focus() { globalThis.document.activeElement = container } }
  globalThis.document = { activeElement: activeIndex === null ? {} : items[activeIndex] }
  return { items, container }
}
const keyEvent = (key, shiftKey = false) => { const calls = { prevented: 0, stopped: 0 }; return { key, shiftKey, preventDefault() { calls.prevented++ }, stopPropagation() { calls.stopped++ }, calls } }

test('ES-236: Esc llama a cerrar, detiene la propagación y no toca el foco', () => {
  const { container } = fakeDom(1); let closed = 0
  const event = keyEvent('Escape'); modalKeyDown(event, container, () => { closed++ })
  assert.equal(closed, 1); assert.equal(event.calls.stopped, 1); assert.equal(event.calls.prevented, 1)
})

test('ES-236: Tab en el último control vuelve al primero; Shift+Tab en el primero va al último; en medio no interviene', () => {
  { const { items, container } = fakeDom(2); const event = keyEvent('Tab'); modalKeyDown(event, container, () => {}); assert.equal(globalThis.document.activeElement, items[0]); assert.equal(event.calls.prevented, 1) }
  { const { items, container } = fakeDom(0); const event = keyEvent('Tab', true); modalKeyDown(event, container, () => {}); assert.equal(globalThis.document.activeElement, items[2]); assert.equal(event.calls.prevented, 1) }
  { const { items, container } = fakeDom(1); const event = keyEvent('Tab'); modalKeyDown(event, container, () => {}); assert.equal(globalThis.document.activeElement, items[1]); assert.equal(event.calls.prevented, 0) }
  // si el foco se escapó del diálogo, Tab lo devuelve dentro
  { const { items, container } = fakeDom(null); const event = keyEvent('Tab'); modalKeyDown(event, container, () => {}); assert.equal(globalThis.document.activeElement, items[0]); assert.equal(event.calls.prevented, 1) }
})

test('ES-236: los tres diálogos usan el helper común y Esc respeta el bloqueo mientras se borra', () => {
  const evidence = read('../src/pages/EvidencePages.tsx'); const resumes = read('../src/context/resume/ResumesPage.tsx')
  assert.match(evidence, /import \{ modalKeyDown \} from '\.\.\/a11y\/modalKeys\.ts'/)
  assert.match(evidence, /role="alertdialog" onKeyDown=\{event => modalKeyDown\(event, dialog\.current, cancel\)\}/)
  assert.match(evidence, /const cancel = \(\) => \{ if \(busy\) return;/)
  assert.match(resumes, /import \{ modalKeyDown \} from '\.\.\/\.\.\/a11y\/modalKeys\.ts'/)
  assert.equal((resumes.match(/modalKeyDown\(event, dialog\.current, \(\) => \{ if \(!busy\) close\(\) \}\)/g) || []).length, 2) // borrar versión y retirar autorización
  assert.match(resumes, /const close = \(\) => \{ setConfirm\(null\); window\.setTimeout\(\(\) => opener\.current\?\.focus\(\), 0\) \}/) // el foco vuelve a quien abrió
})
