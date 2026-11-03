// ES-129: el frontend se divide por rutas y el presupuesto de tamaño falla cuando se excede.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkBundle, LIMITS } from '../scripts/check-bundle-size.mjs'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('ES-129 rutas: administración, terapeuta, junta, mapas y chat se cargan por ruta; solo portada y login van en la entrada', () => {
  const staticImports = [...app.matchAll(/^import \{ ([^}]+) \}\s+from\s+'([^']+)'/gm)].map(m => m[2])
  for (const heavy of ['pages/admin/', 'pages/therapist/', 'pages/board/', 'pages/SkillMapPage', 'pages/ChatPage', 'layouts/', 'career/', 'compass/', 'bridge/', 'skill-catalog/', 'routeCatalog/', 'facilitation/Pages', 'space/JournalPage'])
    assert.equal(staticImports.some(p => p.includes(heavy)), false, `${heavy} no debe importarse de forma estática en App.tsx`)
  for (const name of ['AdminDashboard', 'TherapistDashboard', 'BoardManifest', 'SkillMapPage', 'ChatPage', 'CompassPage'])
    assert.ok(app.includes(`const ${name} = lazy(() => import(`) && app.includes(`.then(m => ({ default: m.${name} })))`), name)
  assert.match(app, /<Suspense fallback=\{<RouteFallback \/>\}><Routes>/); assert.match(app, /<\/Routes><\/Suspense>/)
  assert.match(app, /t\('loading'\)/); assert.match(app, /role="status"/) // texto que ya existe en ES y EN, anunciado a lectores de pantalla
})

function fakeDist(entryBytes, chunkBytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es129-'))
  fs.mkdirSync(path.join(dir, 'assets'))
  const noise = n => Buffer.from(Array.from({ length: n }, (_, i) => (i * 2654435761) % 251))
  fs.writeFileSync(path.join(dir, 'assets', 'index-a.js'), noise(entryBytes))
  fs.writeFileSync(path.join(dir, 'assets', 'Big-b.js'), noise(chunkBytes))
  fs.writeFileSync(path.join(dir, 'index.html'), '<script type="module" crossorigin src="/assets/index-a.js"></script><link rel="modulepreload" crossorigin href="/assets/index-a.js">')
  return dir
}

test('ES-129 presupuesto: pasa dentro de los límites y falla (con el motivo) al exceder la carga inicial o un bloque', () => {
  const ok = checkBundle(fakeDist(50_000, 60_000))
  assert.deepEqual(ok.problems, []); assert.equal(ok.biggest.file, 'Big-b.js')
  const heavyEntry = checkBundle(fakeDist(400_000, 1_000), { initialJsGzipKb: 1, chunkRawKb: 500 })
  assert.match(heavyEntry.problems.join('\n'), /carga inicial de JS/)
  const bigChunk = checkBundle(fakeDist(1_000, 600_000))
  assert.match(bigChunk.problems.join('\n'), /bloque Big-b\.js/)
  assert.deepEqual(LIMITS, { initialJsGzipKb: 150, chunkRawKb: 500 })
})
