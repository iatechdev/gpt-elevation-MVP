// ES-332 (B-T8-1) · /app/feedback tiene SIEMPRE un h1, también con la bandera apagada: el Shell envuelve ambos casos en PersonScreen (que dibuja el h1) y el texto «deshabilitado» va dentro.
// La medición en navegador (ES/EN × 390/1360, build real con la bandera apagada) la hace scripts/es332-feedback-h1-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../src/pilot/FeedbackPage.tsx', import.meta.url), 'utf8')
const screen = readFileSync(new URL('../src/space/PersonScreen.tsx', import.meta.url), 'utf8')

test('ES-332: PersonScreen dibuja el h1 y el Shell de /app/feedback lo usa para TODOS los estados (bandera apagada, simulación y real)', () => {
  assert.match(screen, /<h1 className="pg-title"[^>]*>\{title\}<\/h1>/)
  const shell = page.slice(page.indexOf('function Shell('), page.indexOf('export function FeedbackPage'))
  assert.match(shell, /<PersonScreen title=\{c\.title\}/)
  assert.ok(shell.indexOf('<PersonScreen') < shell.indexOf('c.disabled'), 'el aviso «deshabilitado» va DENTRO de la pantalla con h1, no en su lugar')
  assert.doesNotMatch(page, /<h1/, 'ningún segundo h1 en la página (el único es el de PersonScreen)')
})
