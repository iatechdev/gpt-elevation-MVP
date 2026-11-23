// ES-373 (O427-2): la pregunta «Si sales, perderás…» (chat.canLeave) va PRIMERO al cerrar sesión desde el chat, a cualquier ancho, y una sola vez. El comportamiento real se comprueba en
// scripts/es373-orden-guardia.cjs (navegador); aquí quedan las uniones de código que lo sostienen.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/pages/ChatPage.tsx', import.meta.url), 'utf8')

test('ES-373: escritorio (≥901 px): «Cerrar sesión» del menú pregunta ANTES de abrir la despedida', () => {
  assert.match(page, /onCheckout=\{\(\) => \{ if \(chat\.canLeave\(\)\) setShowCheckout\(true\) \}\}/)
  assert.doesNotMatch(page, /onCheckout=\{\(\) => setShowCheckout\(true\)\}/)
})

test('ES-373: móvil (≤900 px): la guardia del marco pregunta antes y abre la despedida solo si se acepta', () => {
  assert.match(page, /registerLeaveGuard\(\(\) => \{ if \(!live\.current\.canLeave\(\)\) \{ notifyStay\(\); return true \} setShowCheckout\(true\); return true \}, \{ ownLinks: true \}\)/)
})

test('ES-373: handleLogout («Saltar» y fin de la despedida) ya NO vuelve a preguntar: la pregunta no sale dos veces', () => {
  const body = /const handleLogout = async \(\) => \{([\s\S]*?)\n  \}/.exec(page)?.[1] ?? ''
  assert.ok(body.includes('await signOut(BACKEND)'), 'sigue cerrando sesión en el servidor')
  assert.doesNotMatch(body, /canLeave/)
})
