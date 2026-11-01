import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { adminText } from '../src/i18n/adminCopy.ts'
const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
let lang = 'es'
const cache = new Map()
globalThis.localStorage = { getItem: () => null }
function load(file) {
  if (file.endsWith('.css')) return {}
  if (cache.has(file)) return cache.get(file)
  if (file === resolve(root, 'i18n/useLanguage.ts')) return { useLanguage: () => ({ lang, t: key => key }) }
  if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8'))
  const exports = {}; cache.set(file, exports)
  const code = ts.transpileModule(readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ DEV: false })'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'exports', code)(id => {
    if (!id.startsWith('.')) return require(id)
    const base = resolve(dirname(file), id)
    const path = [base, base + '.ts', base + '.tsx'].find(existsSync)
    return load(path ?? base)
  }, exports)
  return exports
}
const render = Component => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(Component)))
test('ES-127: componentes administrativos reales muestran estados iniciales ES/EN sin traducir datos personales', () => {
  const cases = [['AdminDashboard', 'Cargando métricas...', 'Loading metrics...'], ['AdminMetrics', 'Cargando métricas...', 'Loading metrics...'], ['AdminUsers', 'Usuarios', 'Users'], ['AdminContent', 'Contenido', 'Content']]
  for (const [name, es, en] of cases) {
    const Component = load(resolve(root, `pages/admin/${name}.tsx`))[name]
    lang = 'es'; assert.ok(render(Component).includes(es), `${name}: ES`)
    lang = 'en'; const html = render(Component); assert.ok(html.includes(en), `${name}: EN`)
    assert.ok(!html.includes(es), `${name}: no Spanish UI copy in EN initial state`)
  }
  assert.equal(adminText('Synthetic Person', 'en'), 'Synthetic Person')
  assert.equal(adminText('Usuario Synthetic Person creado exitosamente.', 'en'), 'User Synthetic Person created successfully.')
  assert.equal(adminText('Contenido', 'es'), 'Contenido')
})
