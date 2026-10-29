import fs from 'node:fs'
import ts from 'typescript'

// Read source only: this inventory never starts the app or accesses personal data.
const source = ts.createSourceFile('App.tsx', fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const guards = new Set(['ProtectedRoute', 'AdminRoute', 'TherapistRoute', 'BoardRoute'])
const rows = []
function names(node) {
  const result = []
  function visit(child) {
    if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) result.push(child.tagName.getText(source))
    ts.forEachChild(child, visit)
  }
  if (node) visit(node)
  return result
}
function walk(node, parent = '', inherited = []) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    if (opening.tagName.getText(source) === 'Route') {
      const attributes = opening.attributes.properties.filter(ts.isJsxAttribute)
      const pathAttribute = attributes.find(attribute => attribute.name.getText(source) === 'path')
      const element = attributes.find(attribute => attribute.name.getText(source) === 'element')
      const index = attributes.some(attribute => attribute.name.getText(source) === 'index')
      const declared = pathAttribute?.initializer
      if (declared && !ts.isStringLiteral(declared)) throw new Error('Dynamic route path needs manual inventory')
      const segment = declared?.text
      const path = segment === '*' && !parent ? '*' : segment?.startsWith('/') ? segment : segment ? `${parent}/${segment}`.replace(/\/+/g, '/') : parent
      const components = names(element?.initializer)
      const activeGuards = [...new Set([...inherited, ...components.filter(name => guards.has(name))])]
      const children = ts.isJsxElement(node) ? node.children : []
      const hasChildren = children.some(child => (ts.isJsxElement(child) ? child.openingElement : ts.isJsxSelfClosingElement(child) ? child : null)?.tagName.getText(source) === 'Route')
      if (segment !== undefined || index) rows.push({ path, kind: components.includes('Navigate') ? 'redirect' : hasChildren ? 'container' : 'screen', index, components, clientGuards: activeGuards, line: source.getLineAndCharacterOfPosition(opening.getStart(source)).line + 1 })
      for (const child of children) walk(child, path, activeGuards)
      return
    }
  }
  ts.forEachChild(node, child => walk(child, parent, inherited))
}
walk(source)
const lines = [
  '# ES-38 — Inventario de rutas y matriz pendiente', '',
  'Generado con `node scripts/es38-route-inventory.mjs` desde frontend/. Reejecutar tras integrar ES-37.', '',
  'Los guards indicados son componentes cliente, no una prueba de autorización del servidor. Una fila puede ser un contenedor o una redirección, no una pantalla adicional. Los parámetros requieren IDs sintéticos locales; no usar cuentas del piloto.', '',
  'Para cada pantalla: ES y EN; 320/375/390/768/1024/1440 px; teclado/foco; texto al 200%; reduced-motion; claro y oscuro solo donde ya exista. Registrar por separado cargando, vacío, datos, guardando, éxito y error cuando correspondan; justificar N/A. No habilitar flags pendientes para clientes.', '',
  '| Ruta resuelta | Tipo | Componentes | Guards cliente | App.tsx | Revisión visual |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.path}${row.index ? ' (index)' : ''} | ${row.kind} | ${row.components.join(', ')} | ${row.clientGuards.join(', ') || 'ninguno'} | ${row.line} | No ejecutada |`), '',
  `${rows.length} declaraciones con path o index; ${rows.filter(row => row.kind === 'screen').length} entradas de pantalla, ${rows.filter(row => row.kind === 'container').length} contenedores y ${rows.filter(row => row.kind === 'redirect').length} redirecciones. Esto no acredita cobertura funcional, visual ni de seguridad.`, '',
]
fs.writeFileSync(new URL('../../docs/hu-tecnicas/ES-38-MATRIZ-RUTAS.md', import.meta.url), lines.join('\n'))
console.log(`ES-38: ${rows.length} rutas inventariadas; revisión visual pendiente`)
