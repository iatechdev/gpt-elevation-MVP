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

test('ES-181: los diálogos son accesibles (role, aria-modal, Escape, foco atrapado y devuelto)', () => {
  assert.match(source, /role="dialog"/); assert.match(source, /aria-modal="true"/)
  assert.match(source, /e\.key === 'Escape'/); assert.match(source, /e\.key !== 'Tab'/); assert.match(source, /trigger\?\.focus/)
  assert.match(source, /aria-live="polite"/)
})

test('ES-181: el estado de cada versión se dice con palabras y el texto «terapéuticos» ya no está', () => {
  for (const word of ['Activa', 'Archivada', 'En revisión', 'Rechazada']) assert.ok(source.includes(`'${word}'`), word)
  assert.doesNotMatch(source, /terapéutic/i)
})
