// ES-197 (PERF-03): política de precarga (saveData/2g), cola de un bloque a la vez sin repetir ni lanzar, y que los especificadores coincidan con los lazy() de App.tsx.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prefetchAllowed, routeKey, idleRoutesFor, createPrefetcher, ROUTE_LOADERS, IDLE_ROUTES } from '../src/routePrefetch.ts'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')

test('ES-197: no se precarga con ahorro de datos ni en 2g; sí sin información de conexión o en 4g', () => {
  assert.equal(prefetchAllowed(undefined), true)
  assert.equal(prefetchAllowed({ effectiveType: '4g' }), true)
  assert.equal(prefetchAllowed({ saveData: true, effectiveType: '4g' }), false)
  assert.equal(prefetchAllowed({ effectiveType: '2g' }), false)
  assert.equal(prefetchAllowed({ effectiveType: 'slow-2g' }), false)
})

test('ES-197: la ruta se resuelve por el segmento padre más largo; rutas ajenas no precargan nada', () => {
  assert.equal(routeKey('/app/evidence/new'), '/app/evidence')
  assert.equal(routeKey('/app/space/tools'), '/app/space/tools')
  assert.equal(routeKey('/app/skill-map/'), '/app/skill-map')
  assert.equal(routeKey('/login'), '/login') // ES-155: «Entrar» se precarga al pasar el cursor
  assert.equal(routeKey('/manifiesto'), null)
  assert.equal(routeKey('/app/otra'), null)
  assert.deepEqual(idleRoutesFor('/app/dashboard'), IDLE_ROUTES['/app'])
  assert.deepEqual(idleRoutesFor('/login'), [])
  for (const list of Object.values(IDLE_ROUTES)) for (const key of list) assert.ok(ROUTE_LOADERS[key], key)
})

test('ES-197: la cola baja un bloque a la vez, una vez por ruta, y tolera fallos', async () => {
  const calls = []; let active = 0; let maxActive = 0
  const slow = (name, fail = false) => async () => { active++; maxActive = Math.max(maxActive, active); await new Promise(r => setTimeout(r, 5)); active--; calls.push(name); if (fail) throw new Error('red') }
  const p = createPrefetcher({ loaders: { a: [slow('a1'), slow('a2', true)], b: [slow('b1')] }, connection: () => ({ effectiveType: '4g' }) })
  assert.equal(p.request('a'), true); assert.equal(p.request('a'), false); assert.equal(p.request('b'), true); assert.equal(p.request('zzz'), false)
  await new Promise(r => setTimeout(r, 60))
  assert.deepEqual(calls, ['a1', 'a2', 'b1']); assert.equal(maxActive, 1)
  assert.deepEqual(p.completed, ['a', 'b'])
})

test('ES-197: con ahorro de datos no pide nada', async () => {
  let called = 0
  const p = createPrefetcher({ loaders: { a: [async () => { called++ }] }, connection: () => ({ saveData: true }) })
  assert.equal(p.request('a'), false); await new Promise(r => setTimeout(r, 10)); assert.equal(called, 0)
})

test('ES-197: cada especificador precargado existe como lazy() en App.tsx (sin deriva) y main.tsx instala la precarga', () => {
  const app = read('../src/App.tsx'), prefetch = read('../src/routePrefetch.ts')
  const lazy = new Set([...app.matchAll(/import\('([^']+)'\)/g)].map(m => m[1]))
  const specs = [...prefetch.matchAll(/import\('([^']+)'\)/g)].map(m => m[1])
  assert.ok(specs.length > 20)
  for (const spec of specs) assert.ok(lazy.has(spec), `${spec} no está en App.tsx`)
  assert.match(read('../src/main.tsx'), /installRoutePrefetch\(\)/)
})
