// ES-15: el menú de «Mi espacio» vive en /app/space/tools. /app/next-step es del recorrido profesional de ES-34 (#45); las dos ramas la declaraban y,
// al fusionarse, una habría tapado a la otra. Estas pruebas fijan la ruta nueva y la invariante general: ninguna ruta repetida en App.tsx.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/space/copy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-15: App.tsx no declara dos rutas absolutas con el mismo path (una tapa a la otra)', () => {
  // Solo las absolutas (empiezan por «/»): las relativas, como «manifest», cuelgan de padres distintos y no compiten entre sí.
  const paths = [...read('../src/App.tsx').matchAll(/<Route\s+path="(\/[^"]*)"/g)].map(m => m[1])
  assert.ok(paths.length > 10, 'se encontraron las rutas')
  const repeated = paths.filter((p, i) => paths.indexOf(p) !== i)
  assert.deepEqual(repeated, [])
})

test('ES-15: el menú de «Mi espacio» usa /app/space/tools y ya no reclama /app/next-step', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /<Route path="\/app\/space\/tools" element=\{<SpaceToolsPage \/>\} \/>/)
  assert.doesNotMatch(app, /path="\/app\/next-step"[^>]*NextStepPage|NextStepPage/)
  assert.match(read('../src/space/SpaceNav.tsx'), /to="\/app\/space\/tools"/)
  assert.doesNotMatch(read('../src/space/SpaceNav.tsx'), /next-step/)
})

test('ES-15: el rótulo del menú es propio y ya no repite «Mi siguiente paso» (nombre del recorrido de ES-34)', () => {
  for (const lang of ['es', 'en']) {
    for (const key of ['tools', 'toolsEmpty']) assert.ok(copy[lang][key] && copy[lang][key].trim(), `${lang}.${key}`)
    assert.equal(copy[lang].next, undefined)
    assert.doesNotMatch(copy[lang].tools, /siguiente paso|next step/i)
  }
  assert.notEqual(copy.es.tools, copy.en.tools)
  assert.equal(Object.keys(copy.es).sort().join(), Object.keys(copy.en).sort().join()) // ES y EN con las mismas claves
})
