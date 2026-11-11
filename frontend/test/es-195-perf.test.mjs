// ES-195: ayudas puras de los scripts de medición (agrupar módulos del bloque de entrada, mediana) y estructura: Lighthouse no es dependencia ni entra a CI.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { groupOf, summarizeMap, chunkRows, initialFiles } from '../scripts/perf-report.mjs'
import { median, SCREENS } from '../scripts/perf-lighthouse.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')

test('ES-195: los módulos se agrupan por paquete o por carpeta de src', () => {
  assert.equal(groupOf('../../node_modules/react-dom/cjs/react-dom.production.js'), 'react-dom')
  assert.equal(groupOf('C:\\x\\node_modules\\@scope\\pkg\\index.js'), '@scope/pkg')
  assert.equal(groupOf('/repo/frontend/src/i18n/es.ts'), 'src/i18n')
  assert.equal(groupOf('/repo/frontend/src/components/landing/Hero.tsx'), 'src/components/landing')
  assert.equal(groupOf('/repo/frontend/vite.config.ts'), '(otros)')
})

test('ES-195: el resumen de un sourcemap suma el tamaño del fuente por grupo, de mayor a menor', () => {
  const rows = summarizeMap({ sources: ['/n/node_modules/a/x.js', '/n/node_modules/a/y.js', '/r/src/i18n/es.ts'], sourcesContent: ['12345', '123', '1234567890'] })
  assert.deepEqual(rows, [{ group: 'src/i18n', modules: 1, sourceBytes: 10 }, { group: 'a', modules: 2, sourceBytes: 8 }])
})

test('ES-195: bloques ordenados por tamaño y carga inicial leída de index.html', () => {
  const dist = mkdtempSync(join(tmpdir(), 'es195-'))
  try {
    mkdirSync(join(dist, 'assets'))
    writeFileSync(join(dist, 'assets', 'index-a.js'), 'x'.repeat(5000)); writeFileSync(join(dist, 'assets', 'chunk-b.js'), 'y'.repeat(100)); writeFileSync(join(dist, 'assets', 'index-c.css'), 'z'.repeat(300))
    writeFileSync(join(dist, 'index.html'), '<script type="module" src="/assets/index-a.js"></script><link rel="stylesheet" href="/assets/index-c.css"><link rel="modulepreload" href="/assets/chunk-b.js">')
    const rows = chunkRows(dist)
    assert.deepEqual(rows.map(r => r.file), ['index-a.js', 'index-c.css', 'chunk-b.js'])
    assert.ok(rows[0].gzip < rows[0].raw)
    assert.deepEqual(initialFiles(dist), { js: ['assets/index-a.js', 'assets/chunk-b.js'], css: ['assets/index-c.css'] })
  } finally { rmSync(dist, { recursive: true, force: true }) }
})

test('ES-195: mediana y las seis pantallas pedidas', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.deepEqual(SCREENS.map(s => s.id), ['landing', 'login', 'space', 'chat', 'skillmap', 'panel'])
})

test('ES-195: Lighthouse no es dependencia del repositorio y los scripts de medición no están en CI', () => {
  const pkg = JSON.parse(read('../package.json'))
  assert.equal(pkg.scripts['perf:report'], 'node scripts/perf-report.mjs')
  assert.equal(JSON.stringify(pkg.dependencies ?? {}).includes('lighthouse') || JSON.stringify(pkg.devDependencies ?? {}).includes('lighthouse'), false)
  assert.doesNotMatch(read('../../.github/workflows/ci.yml'), /perf-lighthouse|lighthouse/i)
})
