// ES-187 (frontend): administración del catálogo de rutas. El guardado manda la versión del elemento, el 409 `item_changed` se trata como conflicto (no como error genérico),
// «Crear borrador» se deshabilita con razón y cada elemento lleva su chip. Textos en ES y EN. El comportamiento contra el servidor real lo cubre scripts/es187-api-integration.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(resolve(here, p), 'utf8')
const api = read('../src/routeCatalog/api.ts'), pages = read('../src/routeCatalog/CatalogPages.tsx'), copy = read('../src/routeCatalog/copy.ts')

test('ES-187: el guardado manda expectedUpdatedAt y la versión se renueva tras guardar', () => {
  assert.match(api, /expectedUpdatedAt !== undefined \? \{ \.\.\.body, expectedUpdatedAt \} : body/)
  assert.match(pages, /api\.save\(id, kind!, key, payload\(kind!, data, synthetic\), newItem \? \(stamp\.current \?\? null\) : stamp\.current\)/) // ES-266: elemento nuevo = null
  assert.match(pages, /stamp\.current = string\(persisted\.updatedAt\)/)
})

test('ES-187: item_changed abre el aviso de conflicto con «Ver su versión» y «Conservar la mía», y no se guarda solo', () => {
  assert.match(pages, /failure\.code === 'item_changed'/)
  assert.match(pages, /'hide_theirs' : 'see_theirs'/); assert.match(pages, /tr\('keep_mine'\)/)
  assert.match(api, /readonly current\?: Data \| null/)
  assert.match(pages, /const keepMine = \(\) => \{ stamp\.current = /)
})

test('ES-187: «Crear borrador» se deshabilita con razón visible y cada elemento muestra «Completo» o «Faltan datos (n)»', () => {
  assert.match(pages, /disabled=\{busy \|\| !!openDraft\}/); assert.match(pages, /aria-describedby=\{openDraft \? 'catalog-draft-reason' : undefined\}/)
  assert.match(pages, /tr\('missing_chip'\)\}.*\(\$\{gaps\}\)|\$\{tr\('missing_chip'\)\} \(\$\{gaps\}\)/)
})

test('ES-187: todos los textos nuevos existen en ES y EN y el aviso de «no detecta ediciones simultáneas» ya no se dice', () => {
  for (const key of ['draft_exists', 'open_draft', 'complete', 'missing_chip', 'item_changed', 'item_removed', 'see_theirs', 'hide_theirs', 'keep_mine', 'no_differences', 'keep_ready']) {
    const match = copy.match(new RegExp(`\\b${key}: \\['([^']|’)+', '[^']+'\\]|\\b${key}: \\['[^']+', '[^']+'\\]`))
    assert.ok(match || new RegExp(`\\b${key}: \\[`).test(copy), key)
  }
  assert.doesNotMatch(copy, /no detecta todas las ediciones simultáneas|does not detect all simultaneous edits/)
})

// E213-1: si el servidor guarda pero la respuesta se pierde, lo releído que coincide con lo enviado se adopta (versión y «Guardado»); si no, el siguiente guardado daría un 409 falso.
// ES-266: un elemento NUEVO manda expectedUpdatedAt null; si la clave ya existe, 409 item_exists abre el mismo aviso de conflicto.
test('ES-187 (ES-266): elemento nuevo manda expectedUpdatedAt null y item_exists abre el aviso de conflicto', () => {
  assert.match(pages, /newItem \? \(stamp\.current \?\? null\) : stamp\.current/)
  assert.match(pages, /failure\.code === 'item_exists'/)
  assert.match(api, /expectedUpdatedAt !== undefined \? \{ \.\.\.body, expectedUpdatedAt \} : body/)
  assert.match(copy, /item_exists: \['Otra persona creó/)
})

test('ES-187 (E213-1): la respuesta perdida se resuelve releyendo y adoptando la versión persistida', () => {
  assert.match(pages, /const lost = !acknowledged && !\(failure instanceof CatalogError && failure\.status < 500\)/)
  assert.match(pages, /\(acknowledged \|\| lost\) && persisted/)
  assert.match(pages, /payload\(kind!, data, synthetic\)/)
})

// ES-310 (PR 4): el catálogo de rutas de administración usa Cartografía dentro del marco de Administración; la lógica y los textos no cambian.
test('ES-310 PR4: sin estilos en línea, sin clases antiguas ni colores fijos; usa las piezas de Cartografía', () => {
  const fields = read('../src/routeCatalog/CatalogFields.tsx'), css = read('../src/routeCatalog/catalog.css')
  for (const source of [pages, fields]) {
    assert.doesNotMatch(source, /style=\{\{/); assert.doesNotMatch(source, /\belv-[a-z]+/); assert.doesNotMatch(source, /route-catalog-scope|catalog-skip|<dialog/)
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgb\(|route-catalog-scope|elv-/); assert.match(css, /var\(--cg-line\)/)
  assert.match(pages, /from '\.\.\/cartografia'/); assert.match(fields, /from '\.\.\/cartografia'/)
  assert.match(pages, /<Dialog open=\{confirmation !== null\}/); assert.match(pages, /<Button variant=\{confirmation === 'remove' \? 'danger' : 'primary'\}/)
})
test('ES-310 PR4: los estados llevan palabra (y ✓ en «Completo» y «Publicada»); «Revisar publicación» se deshabilita con razón enlazada', () => {
  assert.match(pages, /<Chip tone="ok" symbol="✓">\{tr\('complete'\)\}<\/Chip>/); assert.match(pages, /published: \{ tone: 'ok', symbol: '✓' \}/)
  assert.match(pages, /aria-describedby=\{missingHere > 0 \? 'catalog-publish-reason' : undefined\}/); assert.match(pages, /id="catalog-publish-reason"/)
})
test('ES-310 PR4: las rutas del catálogo están dentro de AdminLayout y salir con cambios sin guardar por un enlace del marco pide confirmar', () => {
  const app = read('../src/App.tsx')
  assert.doesNotMatch(app, /path="\/admin\/route-catalog/)
  for (const path of ['route-catalog', 'route-catalog/:id', 'route-catalog/:id/:kind/:itemKey']) assert.ok(app.includes(`<Route path="${path}" element={<CatalogManager />} />`), path)
  assert.ok(app.indexOf('path="route-catalog"') > app.indexOf('<AdminLayout />'), 'dentro del padre /admin con AdminLayout')
  assert.match(pages, /document\.addEventListener\('click', links, true\)/); assert.match(pages, /if \(!dirty \|\| !link/); assert.match(pages, /window\.confirm\(tr\('leave'\)\)\) \{ event\.preventDefault\(\); event\.stopPropagation\(\)/)
})
