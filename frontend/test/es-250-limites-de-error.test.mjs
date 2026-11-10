// ES-250: límites de error. Clasificador (sin conexión / versión nueva / recurso / código), registro sin datos personales, estructura y textos ES/EN.
// El comportamiento real (excepción en un bloque, sin red, CSS bloqueado, 404) lo mide scripts/es250-check.cjs en Chromium.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { classifyFailure, safeBoundaryLog } from '../src/components/chunkError.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const boundary = read('../src/components/RouteErrorBoundary.tsx')

test('ES-250 clasificador: sin red = offline; con red JS = versión nueva; CSS/otros = recurso; el resto = código', () => {
  const chunk = new TypeError('Failed to fetch dynamically imported module: https://x/assets/A-1.js')
  assert.equal(classifyFailure(chunk, false), 'offline')
  assert.equal(classifyFailure(chunk, true), 'version')
  assert.equal(classifyFailure(new TypeError('Importing a module script failed.'), true), 'version')
  assert.equal(classifyFailure(new TypeError('Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'), true), 'version')
  assert.equal(classifyFailure(Object.assign(new Error('x'), { name: 'ChunkLoadError' }), true), 'version')
  // E234-3: «Unable to preload» de un CSS u otro recurso con red NO se disfraza de «versión nueva»
  assert.equal(classifyFailure(new Error('Unable to preload CSS for https://x/assets/session-AbC.css'), true), 'resource')
  assert.equal(classifyFailure(new Error('Unable to preload https://x/assets/a.js'), true), 'version')
  assert.equal(classifyFailure(new Error('Unable to preload CSS for https://x/assets/session-AbC.css'), false), 'offline')
  assert.equal(classifyFailure(new TypeError('Failed to fetch'), true), 'resource')
  for (const other of [new TypeError("Cannot read properties of undefined (reading 'map')"), new Error('boom'), null, undefined]) assert.equal(classifyFailure(other, true), 'code')
})

test('ES-250 registro: nombre del error, ruta sin querystring y nombres de componentes; NUNCA el mensaje', () => {
  const error = Object.assign(new Error('fallo con persona@example.invalid y token abc123'), { name: 'TypeError' })
  const stack = '\n    at Panel (http://x/a.js:1:1)\n    at Section (http://x/a.js:2:2)\n    at div (<anonymous>)'
  const line = safeBoundaryLog(error, stack, '/app/bridge?email=persona@example.invalid#x')
  assert.deepEqual(line, ['[boundary]', 'TypeError', '/app/bridge', 'Panel > Section > div'])
  assert.doesNotMatch(line.join(' '), /persona@example|abc123|fallo con/)
  assert.deepEqual(safeBoundaryLog(null, null, '/x'), ['[boundary]', 'Error', '/x', ''])
})

test('ES-250 estructura: ya no se relanza el error de código; reintento manual; sin recargas automáticas; SectionBoundary sin cambio de layout', () => {
  assert.doesNotMatch(boundary, /throw this\.state\.error/) // antes: cuerpo en blanco (E234-2)
  assert.match(boundary, /retry = \(\) => this\.setState\(\{ error: null, kind: null \}\)/)
  assert.equal((boundary.match(/location\.reload/g) ?? []).length, 1) // solo al pulsar «Recargar»
  assert.match(boundary, /className="contents"/) // el envoltorio no altera el diseño
  assert.match(boundary, /role="alert"/)
  assert.match(boundary, /console\.error\(\.\.\.safeBoundaryLog\(error, info\.componentStack, window\.location\.pathname\)\)/)
  assert.doesNotMatch(boundary, /error\.message/) // nunca se registra el mensaje
  const app = read('../src/App.tsx')
  assert.match(app, /<RouteErrorBoundary resetKey=\{pathname\}><Suspense fallback=\{<RouteFallback \/>\}><Routes>/)
  // los tres bloques aislados que aprobó Infra
  assert.match(read('../src/pages/SkillMapPage.tsx'), /<SectionBoundary><AiAnalysisPanel/)
  assert.match(read('../src/pages/SkillMapPage.tsx'), /<SectionBoundary resetKey=\{skill\.skillKey\}><SkillDetail/)
  assert.match(read('../src/bridge/BridgePage.tsx'), /<SectionBoundary><SourcesPanel/)
})

test('ES-250 textos ES/EN: cuatro variantes con las mismas claves', () => {
  const es = read('../src/i18n/es.ts'); const en = read('../src/i18n/en.ts')
  for (const key of ['route_error_retry', 'route_error_offline', 'route_error_resource', 'route_error_section', 'route_error_screen']) {
    assert.match(es, new RegExp(`\\n  ${key}: '`)); assert.match(en, new RegExp(`\\n  ${key}: '`))
  }
  assert.match(es, /route_error_offline: 'Sin conexión\./); assert.match(en, /route_error_offline: 'No connection\./)
  assert.match(es, /route_error_section: 'Algo salió mal en esta sección\./); assert.match(en, /route_error_section: 'Something went wrong in this section\./)
})
