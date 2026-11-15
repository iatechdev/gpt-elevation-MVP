// Carga el TS/TSX de producción (no una reimplementación) para pintarlo con react-dom/server en las pruebas. Solo son dobles: los .css y los módulos que se indican.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

const require = createRequire(import.meta.url)
export function createLoader(doubles = {}) {
  const cache = new Map()
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports
    const module = { exports: {} }
    cache.set(file, module)
    const source = readFileSync(file, 'utf8').replaceAll('import.meta.env', '({ DEV: true })')
    const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const localRequire = id => {
      if (id.endsWith('.css')) return {}
      for (const [match, value] of Object.entries(doubles)) if (id.includes(match)) return value
      if (!id.startsWith('.')) return require(id)
      let target = resolve(dirname(file), id)
      if (target.endsWith('.json')) { const json = JSON.parse(readFileSync(target, 'utf8')); return { default: json, ...json } }
      if (!/\.tsx?$/.test(target)) target += existsSync(target + '.ts') ? '.ts' : existsSync(target + '.tsx') ? '.tsx' : '/index.ts'
      return load(target)
    }
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
    return module.exports
  }
  return load
}
