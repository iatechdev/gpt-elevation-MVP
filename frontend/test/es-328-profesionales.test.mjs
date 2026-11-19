// ES-328 (PR 2): /profesionales en el marco público migrado de Cartografía, con las piezas del sistema; sin estilos en línea ni colores fijos; mismo envío, validación y textos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../src/professional/ProfessionalApplicationPage.tsx')
const css = read('../src/professional/applicationCartografia.css')

test('ES-328: la solicitud usa PublicFrame migrated; ya no dibuja cabecera, selector de idioma ni «saltar» propios, y se retira professional.css', () => {
  assert.match(page, /<PublicFrame migrated>/)
  assert.ok(!/setLang|pro-lang|space-skip|space-scope|space-card|space\.css|professional\.css|<header|<main/.test(page), 'cabecera, idioma, salto y <main> los pone el marco')
  assert.ok(!existsSync(new URL('../src/professional/professional.css', import.meta.url)), 'professional.css se retira')
})

test('ES-328: campos y botones son los de Cartografía; sin clases heredadas, estilos en línea ni colores fijos', () => {
  assert.match(page, /import \{ Button, CheckField, TextAreaField, TextField \} from '\.\.\/cartografia'/)
  assert.ok(!/style=\{\{/.test(page), 'sin estilos en línea')
  assert.ok(!/\b(elv-|landing-|grid-cols-|pro-field|pro-error|pro-grid)/.test(page.replace(/'pro-|`pro-|"pro-|#pro-|pro-title|pro-banner|pro-cv|pro-consent/g, '')), 'sin clases elv-/landing-/Tailwind/pro-*')
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(css), 'solo tokens --cg-*')
})

test('ES-328: «Volver al inicio» solo en la pantalla de éxito; foco al título; aviso de error con role=alert y lo escrito se conserva', () => {
  assert.equal((page.match(/\{c\.home\}/g) ?? []).length, 1)
  assert.match(page, /className="pa-success"[\s\S]*<Link className="cg-btn" to="\/">\{c\.home\}<\/Link>/)
  assert.match(page, /if \(phase === 'success'\) title\.current\?\.focus\(\)/)
  assert.match(page, /role="alert" className="cg-banner cg-banner--error"/)
  assert.equal((page.match(/setValues\(EMPTY\)/g) ?? []).length, 1, 'solo el éxito limpia el formulario')
})

test('ES-328: dos columnas desde 640 px (Nombre, Correo, País, Profesión) y una debajo; objetivos táctiles del sistema', () => {
  assert.match(css, /@media \(min-width: 640px\) \{ \.pa-pair \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \} \}/)
  assert.match(css, /input\[type='file'\]\.cg-input \{[^}]*min-height: var\(--cg-touch\)/)
})
