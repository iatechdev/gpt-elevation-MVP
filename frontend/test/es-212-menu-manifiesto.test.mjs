// ES-212 (E207-2): la persona con sesión llega al manifiesto desde el menú de usuario del marco de persona (PERSON_MENU, ES-153 paso 2: ya no hay «☰ Menú» de Mi espacio), en ES y EN.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PERSON_MENU } from '../src/shell/nav.ts'
import { shellCopy } from '../src/shell/copy.ts'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

test('ES-212: el menú de usuario del marco de persona trae el enlace al manifiesto ético en ES y EN', () => {
  const item = PERSON_MENU.find(entry => entry.to === '/manifiesto')
  assert.ok(item, 'PERSON_MENU enlaza /manifiesto')
  assert.equal(shellCopy.es[item.label], 'Manifiesto ético'); assert.equal(shellCopy.en[item.label], 'Ethical manifest')
  assert.ok(!shellCopy.en[item.label].includes('Manifiesto'), 'sin texto en español en EN')
})

test('ES-212: el resto del menú no cambia (Puente, Herramientas, Mis datos); el mapa va en la barra principal', () => {
  for (const to of ['/app/bridge', '/app/space/tools', '/app/data']) assert.ok(PERSON_MENU.some(entry => entry.to === to), to)
  assert.ok(readFileSync(resolve(root, 'shell/nav.ts'), 'utf8').includes("to: '/app/skill-map'"))
})

test('ES-212: el manifiesto sigue siendo una ruta pública, sin guardián', () => {
  const app = readFileSync(resolve(root, 'App.tsx'), 'utf8')
  assert.match(app, /<Route path="\/manifiesto" element=\{<ManifestoPage \/>\}/)
})
