// ES-201: el paso de precompresión escribe un .br para cada texto grande de dist/ y se ejecuta con `npm run build`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { compressDist, COMPRESSIBLE, MIN_BYTES } from '../scripts/precompress.mjs'

const here = dirname(fileURLToPath(import.meta.url))

test('ES-201: compressDist crea .br de los textos grandes (idénticos al decodificar), omite lo pequeño y lo ya comprimido', () => {
  const dist = mkdtempSync(join(tmpdir(), 'es201-'))
  try {
    mkdirSync(join(dist, 'assets'))
    const big = 'console.log("elevation");\n'.repeat(300)
    writeFileSync(join(dist, 'index.html'), '<p>hola</p>'.repeat(200)); writeFileSync(join(dist, 'assets', 'a-12345678.js'), big)
    writeFileSync(join(dist, 'assets', 'chico-12345678.js'), 'x'); writeFileSync(join(dist, 'assets', 'f-12345678.woff2'), Buffer.alloc(5000, 1)); writeFileSync(join(dist, 'assets', 'p.png'), Buffer.alloc(5000, 2))
    const summary = compressDist(dist)
    assert.equal(summary.files, 2); assert.ok(summary.brotliBytes < summary.rawBytes)
    assert.equal(zlib.brotliDecompressSync(readFileSync(join(dist, 'assets', 'a-12345678.js.br'))).toString(), big)
    assert.equal(existsSync(join(dist, 'index.html.br')), true)
    for (const skipped of ['chico-12345678.js.br', 'f-12345678.woff2.br', 'p.png.br']) assert.equal(existsSync(join(dist, 'assets', skipped)), false, skipped)
    assert.equal(compressDist(dist).files, 2) // idempotente: no comprime los .br
    assert.ok(readdirSync(join(dist, 'assets')).every(f => !f.endsWith('.br.br')))
  } finally { rmSync(dist, { recursive: true, force: true }) }
})

test('ES-201: tipos comprimibles, umbral y que `npm run build` y el Dockerfile lo ejecutan', () => {
  assert.ok(['.js', '.css', '.html', '.svg', '.json'].every(ext => COMPRESSIBLE.has(ext))); assert.equal(COMPRESSIBLE.has('.woff2'), false); assert.equal(MIN_BYTES, 1024)
  assert.match(JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')).scripts.build, /vite build && node scripts\/precompress\.mjs$/)
  assert.match(readFileSync(resolve(here, '../../Dockerfile'), 'utf8'), /npm run build/) // el despliegue usa `npm run build`, que ya incluye la precompresión
})
