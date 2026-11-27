// ES-412 / D-15: en Chromium, una respuesta con Cache-Control: no-store cuyo cuerpo nadie lee deja la petición «sin terminar» (y agota networkidle). La API manda no-store en /api (server.js) y en el 404 legal.
// Aquí: la estructura. El comportamiento en navegador lo mide scripts/es412-d15-check.cjs (antes: 3/3 rutas con peticiones pendientes; después: 0).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-412: las tres lecturas de D-15 consumen el cuerpo de la respuesta no-OK antes de salir', () => {
  const hook = read('../src/legal/useLegalContent.ts'), admin = read('../src/pages/admin/AdminContent.tsx')
  assert.match(hook, /if \(!res\.ok\) \{ void res\.text\(\)\.catch/)
  assert.match(admin, /if \(!r\.ok\) \{ void r\.text\(\)\.catch\(\(\) => \{\}\); return null \}/, 'contadores de pendientes')
  assert.match(admin, /if \(!r\.ok\) \{ void r\.text\(\)\.catch\(\(\) => \{\}\); setDocs\(\[\]\)/, 'cola de validaciones')
})
