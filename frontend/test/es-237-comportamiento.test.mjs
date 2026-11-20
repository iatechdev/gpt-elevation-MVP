// ES-237 (seguimientos de QA de #349): pruebas de COMPORTAMIENTO que sí corren en CI (node --test), sin servidor de la aplicación ni base de datos.
// E349-2: la corrección E336-1 (cancelar a mitad del cuerpo = AbortError) se detecta de verdad si se quita; antes solo la medía el script de integración, que no está en CI.
// Positivo de «Sustentada por tu evidencia registrada»: solo con transferencia que el servidor sustenta ('strong' o 'partial'); en cualquier otro estado, «Aún sin evidencia».
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { CareerApiError, getRoutes, isUncertain } from '../src/career/api.ts'
import { routeOf } from '../src/career/adapter.ts'

const listen = async handler => { const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server }
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) })

test('E349-2 (E336-1): cancelar a mitad del cuerpo relanza el AbortError; no es «unavailable» ni un CareerApiError', async () => {
  const server = await listen((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"a":') /* el cuerpo nunca termina */ })
  try {
    const controller = new AbortController(); setTimeout(() => controller.abort(), 150)
    let thrown = null
    try { await getRoutes({ baseUrl: `http://127.0.0.1:${server.address().port}`, token: 't', signal: controller.signal }) } catch (error) { thrown = error }
    assert.ok(thrown, 'debía fallar')
    assert.equal(thrown instanceof CareerApiError, false, `se esperaba AbortError, llegó: ${thrown}`)
    assert.equal(thrown.name, 'AbortError')
  } finally { await close(server) }
})

test('E349-2 (contraste): el mismo cuerpo cortado SIN cancelación de la pantalla es «unavailable» (incierto)', async () => {
  const server = await listen((req, res) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100' }); res.write('{"a":'); setTimeout(() => req.socket.destroy(), 50) })
  try {
    let thrown = null
    try { await getRoutes({ baseUrl: `http://127.0.0.1:${server.address().port}`, token: 't' }) } catch (error) { thrown = error }
    assert.ok(thrown instanceof CareerApiError && thrown.kind === 'unavailable' && isUncertain(thrown), String(thrown))
  } finally { await close(server) }
})

test('E349-2: un 2xx vacío o con HTML sigue siendo «unavailable» y un objeto sigue siendo éxito', async () => {
  const bodies = { '/vacio': ['', 200], '/html': ['<html>proxy</html>', 200], '/ok': ['{"status":"needs_constraints","routes":[]}', 200] }
  const server = await listen((req, res) => { const [body, status] = bodies[req.url.replace(/\/api\/routes$/, '')] ?? ['', 404]; res.writeHead(status, { 'Content-Type': 'text/html' }); res.end(body) })
  try {
    const at = path => getRoutes({ baseUrl: `http://127.0.0.1:${server.address().port}${path}`, token: 't' })
    for (const path of ['/vacio', '/html']) await assert.rejects(at(path), error => error instanceof CareerApiError && error.kind === 'unavailable' && isUncertain(error), path)
    assert.equal((await at('/ok')).status, 'needs_constraints')
  } finally { await close(server) }
})

const route = status => ({ roleKey: 'rol_a', slot: 'continuity', labels: { es: 'Rol A', en: 'Role A' }, market: 'CO', regulated: { isRegulated: false, status: 'not_regulated' }, sources: [], dimensions: status === undefined ? {} : { demonstratedTransfer: { status } } })

test('«Sustentada por tu evidencia registrada»: positivo solo con transferencia sustentada por el servidor (strong o partial); nunca por defecto', () => {
  assert.equal(routeOf(route('strong')).supported, true)
  assert.equal(routeOf(route('partial')).supported, true)
  for (const status of ['none_yet', 'unknown', undefined, 'otro_estado']) assert.equal(routeOf(route(status)).supported, false, String(status))
  // La pantalla usa `supported` para elegir el texto; en modo servidor el texto positivo existe en ES y EN.
  assert.match(readFileSync(new URL('../src/career/CareerPages.tsx', import.meta.url), 'utf8'), /c\.t\(route\.supported \? 'supported' : 'noEvidence'\)/)
  assert.match(readFileSync(new URL('../src/career/copy.ts', import.meta.url), 'utf8'), /supported: \['Sustentada por tu evidencia registrada', 'Supported by your recorded evidence'\]/)
})
