// ES-129 (QA-129-02): un bloque diferido que falla muestra un aviso con «Recargar» (nunca pantalla en blanco), en ES y EN, sin recarga automática.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isChunkLoadError } from '../src/components/chunkError.ts'

const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8')

test('ES-129 error de bloque: reconoce los tres modos de fallo del navegador y no confunde otros errores', () => {
  for (const message of ['Failed to fetch dynamically imported module: https://x/assets/A-1.js', // 404 o corte de red (Chromium)
    'error loading dynamically imported module: https://x/assets/A-1.js', // Firefox
    'Importing a module script failed.', // Safari
    'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".']) // index.html con 200
    assert.equal(isChunkLoadError(new TypeError(message)), true, message)
  assert.equal(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' })), true)
  for (const other of [new TypeError("Cannot read properties of undefined (reading 'map')"), new Error('boom'), null, undefined]) assert.equal(isChunkLoadError(other), false)
})

// ES-234 (E232-1): sin conexión el primer fallo es «Unable to preload CSS for …»; antes no se reconocía y el cuerpo quedaba en blanco.
test('ES-234 sin conexión: «Unable to preload CSS/…» cuenta como bloque que no se pudo descargar',  () => {
  for (const message of ['Unable to preload CSS for http://localhost:5299/assets/session-DPGt49nw.css', 'Unable to preload CSS for https://app.example.test/assets/evidence-AbC123.css', 'Unable to preload https://x/assets/a.js']) {
    assert.equal(isChunkLoadError(new Error(message)), true, message)
    assert.equal(isChunkLoadError(message), true, message)
  }
  // lo que NO es una descarga fallida sigue sin reconocerse (no se tapan errores de render)
  for (const other of [new Error('Unable to read property of undefined'), new TypeError('x is not a function')]) assert.equal(isChunkLoadError(other), false)
})

test('ES-129 textos: aviso y botón en ES y EN, con tuteo', () => {
  const es = read('../src/i18n/es.ts'); const en = read('../src/i18n/en.ts')
  assert.ok(es.includes("route_error: 'Hay una versión nueva de la aplicación. Recarga la página para continuar.'"))
  assert.ok(en.includes("route_error: 'A new version of the app is available. Reload the page to continue.'"))
  assert.ok(es.includes("route_error_reload: 'Recargar'")); assert.ok(en.includes("route_error_reload: 'Reload'"))
  assert.doesNotMatch(es, /route_error: '[^']*(recargá|vos )/i)
})

test('ES-129 estructura: role=alert, foco en el botón, sin recarga automática, se limpia al cambiar de ruta y envuelve el Suspense', () => {
  const b = read('../src/components/RouteErrorBoundary.tsx'); const app = read('../src/App.tsx')
  assert.match(b, /role="alert"/); assert.match(b, /button\.current\?\.focus\(\)/)
  assert.match(b, /onClick=\{\(\) => window\.location\.reload\(\)\}/)
  assert.equal((b.match(/location\.reload/g) ?? []).length, 1) // solo al pulsar: sin bucles de recarga
  assert.ok(!b.includes('addEventListener')); assert.match(b, /prev\.resetKey !== this\.props\.resetKey/)
  assert.match(b, /if \(this\.state\.error\) throw this\.state\.error/) // otros errores no se disfrazan de «versión nueva»
  assert.match(app, /<RouteErrorBoundary resetKey=\{pathname\}><Suspense fallback=\{<RouteFallback \/>\}><Routes>/)
  assert.match(app, /<\/Routes><\/Suspense><\/RouteErrorBoundary>/)
  assert.match(app, /const DataPage = lazy\(/); assert.match(app, /path="\/app\/data" element=\{<DataPage \/>\}/) // ruta de #122 conservada
})
