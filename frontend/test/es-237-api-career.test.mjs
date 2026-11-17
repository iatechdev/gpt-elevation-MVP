// ES-237 (paso 1): estructura del cliente `career/api.ts` (el comportamiento contra el servidor real y PostgreSQL lo mide scripts/es237-api-integration.cjs).
// Reglas: solo se añade un archivo (ninguna pantalla ni fixture lo usa todavía), el titular sale del token, nada de secretos en el cliente y solo el vocabulario del servidor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const api = read('../src/career/api.ts')

test('ES-237 paso 1: api.ts expone las rutas reales de /api/experiments y /api/career-plan y ninguna otra', () => {
  const found = [...api.matchAll(/\/api\/[A-Za-z/-]*/g)].map(match => match[0])
  assert.ok(found.length >= 13, `rutas encontradas: ${found.length}`)
  for (const path of found) assert.match(path, /^\/api\/(experiments|career-plan)(\/|$)/, path)
  for (const needle of ["'/api/experiments/proposals'", "'/api/experiments'", '/review-requests', '/versions`', "'/api/career-plan/proposals'", "'/api/career-plan/versions'", '/api/career-plan/versions/', '/api/career-plan/reminders']) assert.ok(api.includes(needle), needle)
})

test('ES-237 paso 1: el titular sale del token (sin userId en cuerpos ni rutas), sin secretos y sin almacenamiento propio', () => {
  assert.doesNotMatch(api, /userId|UserId|localStorage|sessionStorage|document\.cookie|console\./)
  assert.match(api, /Authorization: `Bearer \$\{token\}`/); assert.match(api, /cache: 'no-store'/)
  assert.match(api, /if \(!token\) throw new CareerApiError\('expired', 401, ''\)/)
})

test('ES-237 paso 1: vocabulario del servidor (continuar/ajustar/pausar/descartar); sin «aplazar» ni «deshacer aceptación» (decisión del 17-nov-2026)', () => {
  assert.match(api, /type Decision = 'continue' \| 'adjust' \| 'pause' \| 'discard'/)
  assert.doesNotMatch(api, /postpone|snooze|undo|unaccept|abandon|defer/i)
})

test('ES-237 paso 1: sin pantallas conectadas todavía (nadie importa api.ts; la bandera de la vista previa sigue igual)', () => {
  for (const file of readdirSync(new URL('../src/career/', import.meta.url)).filter(name => /\.(ts|tsx)$/.test(name) && name !== 'api.ts')) assert.doesNotMatch(read(`../src/career/${file}`), /from '\.\/api'/, file)
  assert.match(read('../src/career/CareerShell.tsx'), /VITE_ENABLE_CAREER_PREVIEW === 'true'/)
})
