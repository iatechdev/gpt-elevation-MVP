// ES-199 (PERF-05): daisyUI genera `:root:has(input.theme-controller[value=…]:checked)` por cada tema de landing.css. Con `:has()` en la raíz y un selector de atributo `value`, cada cambio del atributo
// `value` de CUALQUIER campo (React lo sincroniza al teclear) obliga al navegador a recalcular el estilo de toda la página: una tecla en «Textos públicos» (340 campos) costaba ~0,75 s a CPU ×4.
// vite.config.ts quita ese selector del CSS final y `build:check` falla si reaparece.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkBundle } from '../scripts/check-bundle-size.mjs'

const config = fs.readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
const source = (config.match(/const THEME_CONTROLLER = \/(.+)\/g\n/) ?? [])[1] ?? ''
const THEME_CONTROLLER = new RegExp(source, 'g')

test('ES-199: vite.config.ts registra el plugin que quita el selector theme-controller del CSS final (solo build)', () => {
  assert.ok(source.length > 0, 'no se encontró THEME_CONTROLLER en vite.config.ts')
  assert.match(config, /name: 'es199-drop-theme-controller'/)
  assert.match(config, /generateBundle\(_options, bundle\)/)
  assert.match(config, /\n {4}dropThemeController\(\),\n/)
})

test('ES-199: el filtro deja `[data-theme=…]` intacto y quita solo `:root:has(input.theme-controller[value=…]:checked)` (con y sin comillas, minificado o no)', () => {
  const before = [
    ':is(:root:has(input.theme-controller[value=elevation-landing-light]:checked),[data-theme=elevation-landing-light]){--x:1}',
    ':is(:root:has(input.theme-controller[value="elevation-landing-dark"]:checked), [data-theme="elevation-landing-dark"]) {\n  --x: 2;\n}',
  ].join('\n')
  const after = before.replace(THEME_CONTROLLER, '')
  assert.ok(!after.includes('theme-controller'))
  assert.match(after, /:is\(\[data-theme=elevation-landing-light\]\)\{--x:1\}/)
  assert.match(after, /:is\(\[data-theme="elevation-landing-dark"\]\) \{/)
  // otros selectores con :root o :has no se tocan
  const other = ':root:has(.landing-scope) .a{--y:1}[data-theme=elevation-landing-light] .b{--z:1}'
  assert.equal(other.replace(THEME_CONTROLLER, ''), other)
})

test('ES-199: nada del código usa theme-controller (los temas se eligen con data-theme), así que quitar el selector no cambia ningún tema', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])
  const files = walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).filter(file => /\.(tsx?|css|html)$/.test(file))
  assert.ok(files.length > 100)
  const offenders = files.filter(file => /theme-controller/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(offenders, [])
})

function fakeDist(css) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es199-'))
  fs.mkdirSync(path.join(dir, 'assets'))
  fs.writeFileSync(path.join(dir, 'assets', 'index-a.js'), 'x'.repeat(1000))
  fs.writeFileSync(path.join(dir, 'assets', 'vendor-react-v.js'), 'react.transitional.element')
  fs.writeFileSync(path.join(dir, 'assets', 'vendor-router-r.js'), 'router')
  fs.writeFileSync(path.join(dir, 'assets', 'index-a.css'), css)
  fs.writeFileSync(path.join(dir, 'index.html'), '<script type="module" crossorigin src="/assets/index-a.js"></script><link rel="stylesheet" crossorigin href="/assets/index-a.css">')
  return dir
}

test('ES-199: build:check falla (con el motivo) si el CSS final trae otra vez el selector theme-controller y pasa sin él', () => {
  const bad = checkBundle(fakeDist(':is(:root:has(input.theme-controller[value=a]:checked),[data-theme=a]){--x:1}'))
  assert.match(bad.problems.join('\n'), /theme-controller.*index-a\.css/)
  const good = checkBundle(fakeDist(':is([data-theme=a]){--x:1}'))
  assert.deepEqual(good.problems, [])
})
