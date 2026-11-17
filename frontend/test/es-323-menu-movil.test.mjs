// ES-323 (E300-1): con el menú de usuario abierto en ≤ 900 px el panel entra en el flujo y no tapa controles. Reglas estructurales;
// la geometría real, axe, el orden de Tab y la degradación sin :has() los mide scripts/es323-menu-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/shell/shell.css', import.meta.url), 'utf8')
const OPEN = '.cg-header:has(.cg-nav--grid3):has(.cg-usermenu__list:not([hidden]))'

test('ES-323: abierto en ≤ 900 px el panel va en el flujo, a ancho completo, y prefs/navegación bajan una fila', () => {
  const block = css.slice(css.indexOf('/* ES-323 (E300-1)'))
  assert.ok(block.includes('@media (max-width: 900px)'))
  assert.ok(block.includes(`${OPEN} .cg-usermenu { display: contents; }`), 'botón y panel son celdas de la rejilla solo mientras está abierto')
  assert.ok(block.includes(`${OPEN} .cg-usermenu__list { position: static; grid-column: 1 / -1; grid-row: 2;`))
  assert.ok(block.includes(`${OPEN} .cg-usermenu__button { grid-column: 2; grid-row: 1; justify-self: end; }`))
  assert.ok(block.includes(`${OPEN} .cg-prefs { grid-row: 3; }`) && block.includes(`${OPEN} .cg-nav--grid3 { grid-row: 4; }`))
})

test('ES-323: el panel ya no sale de la pantalla en la rejilla (ancla a la derecha) y sin :has() queda la regla anterior', () => {
  assert.ok(css.includes('.cg-header:has(.cg-nav--grid3) .cg-usermenu__list { right: 0; left: auto; }'))
  assert.ok(css.includes('  .cg-usermenu__list { right: auto; left: 0; }'), 'respaldo para navegadores sin :has()')
})

test('ES-323: ≥ 901 px sin cambio (el panel flotante no se toca fuera de la consulta móvil)', () => {
  assert.ok(css.includes('.cg-usermenu__list { position: absolute; right: 0; top: calc(100% + 6px);'))
  const block = css.slice(css.indexOf('/* ES-323 (E300-1)')); const media = block.slice(block.indexOf('@media'))
  assert.equal(media.slice(0, media.indexOf('\n}')).split(OPEN).length - 1, 5, 'las cinco reglas están dentro de la consulta móvil (antes de su llave de cierre)')
  assert.equal(block.split(OPEN).length - 1, 5, 'y no hay ninguna fuera de ella')
})
