// ES-239: el diálogo de cierre de la sala del profesional es un <dialog> nativo modal (Esc lo cierra, el resto de la página queda inerte) y devuelve el foco a «Finalizar».
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const close = readFileSync(resolve(here, '../src/pages/therapist/CloseSession.tsx'), 'utf8')
const room = readFileSync(resolve(here, '../src/pages/therapist/SessionRoom.tsx'), 'utf8')

test('ES-239: el cierre usa <dialog> con showModal() (Esc y foco atrapado nativos), no un contenedor fijo con role="dialog"', () => {
  assert.match(close, /<dialog ref=\{dialog\} aria-labelledby="sr-close-title" onClose=\{onDialogClosed\}/)
  assert.match(close, /dialog\.current\.showModal\(\)/)
  assert.doesNotMatch(close + room, /aria-modal="true"/) // no queda el modal con position: fixed del diseño anterior
})

test('ES-239: al cerrarse (Esc o «Seguir en la sesión») el foco vuelve al botón que lo abrió y el texto escrito vive en el componente', () => {
  assert.match(close, /const onDialogClosed = \(\) => \{ setOpen\(false\); setProblem\(null\); opener\.current\?\.focus\(\) \}/)
  assert.match(close, /const \[note, setNote\] = useState\(''\)/) // no se borra al cerrar el diálogo
  assert.ok(!/setNote\(''\)/.test(close))
})
