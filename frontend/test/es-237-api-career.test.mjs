// ES-237 (paso 1): estructura del cliente `career/api.ts` (el comportamiento contra el servidor real y PostgreSQL lo mide scripts/es237-api-integration.cjs).
// Reglas: solo se añade un archivo (ninguna pantalla ni fixture lo usa todavía), el titular sale del token, nada de secretos en el cliente y solo el vocabulario del servidor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const api = read('../src/career/api.ts')

test('ES-237 pasos 1–2a: api.ts expone las rutas reales de /api/experiments, /api/career-plan, /api/routes y /api/route-catalog y ninguna otra', () => {
  const found = [...api.matchAll(/\/api\/[A-Za-z/-]*/g)].map(match => match[0])
  assert.ok(found.length >= 13, `rutas encontradas: ${found.length}`)
  for (const path of found) assert.match(path, /^\/api\/(experiments|career-plan|routes|route-catalog)(\/|$)/, path)
  for (const needle of ["'/api/experiments/proposals'", "'/api/experiments'", '/review-requests', '/versions`', "'/api/career-plan/proposals'", "'/api/career-plan/versions'", '/api/career-plan/versions/', '/api/career-plan/reminders', "'/api/routes/constraints'", "'/api/routes/choices'", "'/api/routes/review-requests'", "'/api/route-catalog'"]) assert.ok(api.includes(needle), needle)
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

test('ES-237 paso 2a (E307-1): un 2xx vacío, que no es JSON o que no es un objeto es «unavailable» (incierto), nunca un éxito con null', () => {
  assert.match(api, /JSON\.parse\(text\)/)
  assert.match(api, /if \(!readable \|\| value === null \|\| typeof value !== 'object' \|\| Array\.isArray\(value\)\) throw new CareerApiError\('unavailable', response\.status, ''\)/)
  assert.doesNotMatch(api, /response\.json\(\)/, 'el cuerpo se lee como texto para distinguir vacío, HTML y JSON')
})

test('ES-237 paso 2a: /api/routes usa el verbo del servidor (PUT de restricciones) y las elecciones solo aceptan accepted/rejected', () => {
  assert.match(api, /'\/api\/routes\/constraints', 'PUT', input/)
  assert.match(api, /decision: 'accepted' \| 'rejected'/)
  assert.doesNotMatch(api, /userId|UserId/)
})
