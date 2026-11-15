// ES-196 (PERF-02): vendors estables en bloques propios (cacheables entre despliegues), React en un solo bloque, y la comprobación de presupuesto lo exige.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkBundle } from '../scripts/check-bundle-size.mjs'

const config = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

test('ES-196: vite.config separa react y el enrutador en bloques vendor con nombre estable', () => {
  assert.match(config, /name: 'vendor-react'/)
  assert.match(config, /name: 'vendor-router'/)
  assert.ok(config.includes('(react|react-dom|scheduler)'))
  assert.ok(config.includes('(react-router|react-router-dom|'))
})

function dist(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es196-'))
  fs.mkdirSync(path.join(dir, 'assets'))
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'assets', name), text)
  fs.writeFileSync(path.join(dir, 'index.html'), '<script type="module" src="/assets/index-a.js"></script>')
  return dir
}

test('ES-196: la comprobación de presupuesto falla si React está duplicado o faltan los vendors', () => {
  const marker = 'react.transitional.element'
  const good = checkBundle(dist({ 'index-a.js': 'x', 'vendor-react-v.js': marker, 'vendor-router-r.js': 'r' }))
  assert.deepEqual(good.problems, []); assert.deepEqual(good.reactCopies, ['vendor-react-v.js'])
  const duplicated = checkBundle(dist({ 'index-a.js': marker, 'vendor-react-v.js': marker, 'vendor-router-r.js': 'r' }))
  assert.match(duplicated.problems.join('\n'), /React duplicado en 2 bloques/)
  const missing = checkBundle(dist({ 'index-a.js': 'x' }))
  assert.match(missing.problems.join('\n'), /faltan los bloques de vendors/)
})
