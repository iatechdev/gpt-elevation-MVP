// ES-329 / E322-1: elegir el ánimo con flechas o Espacio NO registra el check-in; se registra con un botón explícito.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const page = fs.readFileSync(path.join(here, '../src/pages/UserDashboard.tsx'), 'utf8')
const copy = fs.readFileSync(path.join(here, '../src/pages/dashboardCopy.ts'), 'utf8')

test('E322-1: el onChange de la escala solo guarda la opción; no llama a handleCheckin', () => {
  const scale = page.match(/<ScaleField legend=\{t\('dash_arrive'\)\}[\s\S]*?\/>/)?.[0] ?? ''
  assert.ok(scale, 'escala de ánimo de entrada')
  assert.match(scale, /onChange=\{value => setPendingMood\(Number\(value\)\)\}/)
  assert.doesNotMatch(scale, /handleCheckin/)
})
test('E322-1: handleCheckin solo se invoca desde el botón «Registrar», deshabilitado sin opción elegida', () => {
  const calls = page.match(/handleCheckin\(/g) ?? []
  assert.equal(calls.length, 1) // una sola llamada (la definición es `handleCheckin = async`)
  assert.match(page, /<Button disabled=\{checkingIn \|\| pendingMood === null\} onClick=\{\(\) => \{ if \(pendingMood !== null && !checkingIn\) void handleCheckin\(pendingMood\) \}\}>\{t\('dash_register'\)\}<\/Button>/)
})
test('E322-1: texto del botón en ES y EN', () => {
  assert.match(copy, /dash_register: 'Registrar mi estado'/)
  assert.match(copy, /dash_register: 'Log my state'/)
})
