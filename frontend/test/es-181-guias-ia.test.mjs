// ES-181: la pantalla «Guías de la IA» usa solo propuesta + aprobación (nunca el guardado directo retirado en ES-191),
// el servidor decide el contenido (el cliente solo informa el mínimo) y los diálogos son accesibles.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pages/admin/AdminPrompts.tsx'), 'utf8')

test('ES-181: no llama a rutas retiradas ni al guardado directo', () => {
  assert.doesNotMatch(source, /['`]\/api\/(admin|superadmin)\/prompt['`]/, 'POST /prompt (410) no se usa')
  for (const path of ['/api/admin/prompts', '/api/admin/prompt/propose', '/api/superadmin/prompt/publish', '/api/superadmin/prompt/create', '/approve', '/reject', '/rollback']) {
    assert.ok(source.includes(path), path)
  }
})

test('ES-181: el mínimo de 50 caracteres solo informa y deshabilita el envío; la validación real es del servidor', () => {
  assert.match(source, /const MIN_CHARS = 50/)
  assert.match(source, /const MAX_CHARS = 20000/)
  assert.ok(!/\.length\s*<\s*10\b/.test(source), 'ya no hay el mínimo de 10')
})

test('ES-181: aprobar, publicar, rechazar y volver solo se pintan para superadministración', () => {
  assert.match(source, /esSuperAdmin && isPending/)
  assert.match(source, /esSuperAdmin && \(/)
  assert.match(source, /const canRollback = esSuperAdmin/)
})

// ES-310: los diálogos pasan al Dialog compartido de Cartografía (<dialog>.showModal): mismo foco al abrir, Tab atrapado, Esc y foco devuelto.
// Las aserciones se mueven de la copia local (GuideDialog) a la pieza compartida, que es ahora quien lo implementa.
test('ES-181: los diálogos son accesibles (role, aria-modal, Escape, foco atrapado y devuelto)', () => {
  assert.match(source, /<Dialog\b/); assert.doesNotMatch(source, /GuideDialog/)
  const shared = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/cartografia/interactive.tsx'), 'utf8')
  assert.match(shared, /showModal\(\)/); assert.match(shared, /aria-modal="true"/); assert.match(shared, /aria-labelledby=\{titleId\}/)
  assert.match(shared, /onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\) \}\}/, 'Escape cierra (onCancel → onClose)')
  assert.match(shared, /event\.key !== 'Tab'/); assert.match(shared, /target\.focus\(\)/, 'el foco vuelve al disparador')
  assert.match(source, /if \(!busy\) setDialog\(null\)/, 'mientras envía, Escape/Cancelar no cierran')
  assert.match(source, /aria-live="polite"/)
})

test('ES-310: la pantalla usa Cartografía y no deja estilos en línea ni colores fijos', () => {
  assert.doesNotMatch(source, /style=\{\{|React\.CSSProperties|#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../src/pages/admin/adminPrompts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|--elv-|--color-/)
})

test('ES-181: el estado de cada versión se dice con palabras y el texto «terapéuticos» ya no está', () => {
  for (const word of ['Activa', 'Archivada', 'En revisión', 'Rechazada']) assert.ok(source.includes(`'${word}'`), word)
  assert.doesNotMatch(source, /terapéutic/i)
})
