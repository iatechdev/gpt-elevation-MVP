// ES-315: Contenido · Planes y Textos públicos en Cartografía. Comprobaciones de fuente; el recorrido en navegador está en scripts/es315-check.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { adminText } from '../src/i18n/adminCopy.ts'

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const content = read('../src/pages/admin/AdminContent.tsx')
const pending = read('../src/pages/admin/LandingPendingPanel.tsx')
const css = read('../src/pages/admin/adminContent.css').replace(/\/\*[\s\S]*?\*\//g, '')

test('ES-315: Contenido (todas las pestañas) no deja estilos en línea, colores propios ni Playfair/Inter escritos en el archivo', () => {
  for (const [name, source] of [['AdminContent', content], ['LandingPendingPanel', pending]]) {
    assert.doesNotMatch(source, /style=\{\{|React\.CSSProperties|#[0-9a-fA-F]{3,8}\b|rgba?\(|Playfair|Inter,/, name)
  }
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|--elv-|--color-/)
  assert.doesNotMatch(content, /modalKeyDown|position: 'fixed'|role="dialog"/, 'los diálogos son los de Cartografía (<dialog> nativo)')
})

test('ES-315: el formulario y la confirmación de plan usan el Dialog compartido (variante ancha), con secciones rotuladas y errores por campo', () => {
  assert.equal((content.match(/<Dialog\b/g) || []).length >= 3, true, 'validaciones + formulario de plan + desactivar')
  assert.match(content, /<Dialog\s+wide open=\{showForm\}/)
  assert.match(content, /if \(!saving\) closeForm\(\)/); assert.match(content, /if \(!saving\) closeConfirm\(\)/)
  for (const legend of ['Identificador', 'Nombre del plan', 'Descripción', 'Precio', 'Opciones']) assert.match(content, new RegExp('<legend>\\{tr\\("' + legend + '"\\)\\}</legend>'), legend)
  for (const id of ['plan-slug', 'plan-name-es', 'plan-name-en', 'plan-price']) assert.match(content, new RegExp('id="' + id + '"[^>]*error='), id)
  assert.match(content, /document\.getElementById\(firstError\)\?\.focus\(\)/, 'el foco va al primer campo con error')
  assert.match(content, /readOnly=\{!!editing\}/, 'el identificador es de solo lectura al editar')
  const shared = read('../src/cartografia/interactive.tsx'); assert.match(shared, /data-wide=\{wide \? '' : undefined\}/)
  assert.match(read('../src/cartografia/cartografia.css'), /\.cg-dialog\[data-wide\] \{ max-width: min\(40rem/)
})

test('ES-315: la lógica no cambió: validaciones, llamadas a la API, guardado por campo y 403 de textos', () => {
  for (const call of ['/api/admin/pricing/all', '/api/admin/pricing/${planId}', '/api/landing-content/admin?lang=${lang}', '/api/landing-content`']) assert.ok(content.includes(call), call)
  assert.match(content, /'Solo superadmin puede guardar textos\.'/); assert.match(content, /r\.status === 403/)
  assert.match(content, /\^\[a-z0-9-\]\+\$/); assert.match(content, /99999999\.99/)
  assert.match(content, /if \(busyRef\.current\) return/, 'sin doble envío')
  assert.match(content, /savingRef\.current/, 'un solo guardado de texto a la vez')
})

test('ES-315: tras desactivar, el foco pasa a «Editar» del mismo plan (el botón Desactivar desaparece al recargar)', () => {
  assert.match(content, /id=\{`plan-edit-\$\{p\.id\}`\}/); assert.match(content, /document\.getElementById\(`plan-edit-\$\{planId\}`\)\?\.focus\(\)/)
})

test('ES-315: no hay textos nuevos: todo sale de adminCopy con su inglés', () => {
  for (const key of ['Idioma', 'Planes', 'Textos públicos', 'Otros textos', 'Pendientes de contenido', 'Guardar', 'Reintentar', 'Desactivar', '¿Desactivar este plan?', 'DESTACADO', 'INACTIVO']) {
    assert.notEqual(adminText(key, 'en'), key, 'falta el inglés de «' + key + '»')
  }
})
