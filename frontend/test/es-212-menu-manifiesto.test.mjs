// ES-212 (E207-2): la persona con sesión llega al manifiesto desde el menú que sí existe hoy («☰ Menú» de Mi espacio, SpaceNav),
// en ES y EN. PersonFrame no está montado en ninguna pantalla de la persona, así que ese menú no se ve; no se monta aquí (cambio de layout).
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
const { SpaceNav } = load(resolve(root, 'space/SpaceNav.tsx'))
const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/app/chat'] }, createElement(SpaceNav)))
const menuOf = html => html.slice(html.indexOf('<details'), html.indexOf('</details>'))

test('ES-212: el menú de Mi espacio trae el enlace al manifiesto ético en ES y EN', () => {
  lang = 'es'; const es = menuOf(render())
  assert.match(es, /<a[^>]*href="\/manifiesto"[^>]*>Manifiesto ético<\/a>/)
  lang = 'en'; const en = menuOf(render())
  assert.match(en, /<a[^>]*href="\/manifiesto"[^>]*>Ethical manifest<\/a>/)
  assert.ok(!en.includes('Manifiesto'), 'sin texto en español en EN')
})

test('ES-212: el resto del menú no cambia (Puente, Mapa, Herramientas, Mis datos)', () => {
  lang = 'es'; const es = menuOf(render())
  for (const href of ['/app/bridge', '/app/skill-map', '/app/space/tools', '/app/data']) assert.ok(es.includes(`href="${href}"`), href)
})

test('ES-212: el manifiesto sigue siendo una ruta pública, sin guardián', () => {
  const app = readFileSync(resolve(root, 'App.tsx'), 'utf8')
  assert.match(app, /<Route path="\/manifiesto" element=\{<ManifestoPage \/>\}/)
})
