// ES-256: el registro NATIVO de React 19 para errores atrapados por un límite se silencia en producción (imprimía mensaje y pila, que pueden llevar datos de la persona);
// la línea segura la imprime el propio límite. Y tras «Reintentar» con éxito el foco se coloca en un elemento estable (no cae a body).
// Estructura; el comportamiento real (consola del navegador y document.activeElement) lo mide scripts/es250-check.cjs en Chromium.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const main = read('../src/main.tsx'); const root = read('../src/components/rootErrors.ts'); const boundary = read('../src/components/RouteErrorBoundary.tsx')

test('ES-256 registro: createRoot recibe onCaughtError que no imprime nada en producción; en desarrollo se deja el de React', () => {
  assert.match(main, /import \{ rootErrorOptions \} from '\.\/components\/rootErrors'/)
  assert.match(main, /createRoot\(document\.getElementById\('root'\)!, rootErrorOptions\)\.render\(/)
  assert.match(root, /import\.meta\.env\.DEV \? \{\} : \{ onCaughtError: \(\) => \{/)
  // el manejador no usa el error (ni su mensaje ni la pila): no recibe parámetros
  assert.doesNotMatch(root.replace(/\/\/.*$/gm, ''), /onCaughtError: \([^)]+\)/)
  assert.doesNotMatch(root.replace(/\/\/.*$/gm, ''), /console\./)
  // los errores sin límite siguen su camino normal
  assert.doesNotMatch(root.replace(/\/\/.*$/gm, ''), /onUncaughtError/)
})

test('ES-256 la línea segura sigue saliendo del límite: nombre, ruta y componentes, nunca el mensaje', () => {
  assert.match(boundary, /console\.error\(\.\.\.safeBoundaryLog\(error, info\.componentStack, window\.location\.pathname\)\)/)
  assert.doesNotMatch(boundary, /error\.message/)
})

test('ES-256 foco: tras un reintento con éxito se coloca en un elemento estable después de renderizar; un cambio de ruta no mueve el foco', () => {
  assert.match(boundary, /if \(prevState\.kind && !this\.state\.kind && this\.recovering\) \{ this\.recovering = false; this\.refocus\(\) \}/)
  assert.match(boundary, /if \(prev\.resetKey !== this\.props\.resetKey && this\.state\.kind\) \{ this\.recovering = false;/)
  assert.match(boundary, /componentDidCatch\(error: unknown, info: ErrorInfo\) \{ this\.recovering = false;/) // si vuelve a fallar no se enfoca nada
  assert.match(boundary, /abstract refocus\(\): void/)
  assert.match(boundary, /document\.querySelector\('h1'\)/) // ruta: el título; sección: el primer encabezado o control del bloque
  assert.match(boundary, /wrapper\.current\?\.querySelector\(`h2, h3, \[tabindex="-1"\], \$\{FOCUSABLE\}`\)/)
})
