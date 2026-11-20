// ES-359 (PR 1): menú de cuenta del marco global. UN componente para los cuatro roles, con Preferencias (idioma y tema) y «Cerrar sesión» dentro.
// El comportamiento en el navegador (foco, Esc, Tab, axe, móvil) lo prueba scripts/es359-menu-cuenta.cjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shellCopy } from '../src/shell/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const menu = read('../src/shell/AccountMenu.tsx'), frames = read('../src/shell/frames.tsx'), frame = read('../src/shell/Frame.tsx'), hook = read('../src/shell/useSignOut.ts')

test('un solo componente de cuenta para persona, profesional, administración y junta; el UserMenu y el SignOutButton antiguos ya no existen', () => {
  assert.equal((frames.match(/<AccountMenu /g) ?? []).length, 4)
  assert.doesNotMatch(frames, /UserMenu|SignOutButton|PreferencesBar/)
  assert.doesNotMatch(frame, /export function UserMenu|export function SignOutButton/)
  for (const frameName of ['PersonChrome', 'ProfessionalFrame', 'AdminFrame', 'BoardFrame']) {
    const start = frames.indexOf(`export function ${frameName}`)
    assert.ok(start > 0 && frames.slice(start, start + 2200).includes('<AccountMenu '), frameName)
  }
  assert.equal((frames.match(/preferences=\{null\}/g) ?? []).length, 4) // idioma y tema ya no van sueltos en el encabezado
})

test('el botón tiene etiqueta visible «Menú de usuario» (el nombre accesible contiene el texto visible) y el panel trae nombre y rol, Preferencias y «Cerrar sesión»', () => {
  assert.ok(menu.includes('<span className="cg-usermenu__label">{c.userMenu}</span>'))
  assert.doesNotMatch(menu, /aria-label=\{`\$\{c\.userMenu\}: \$\{name\}`\}/) // el nombre ya no es la etiqueta del botón
  for (const needle of ['{name}', '{roleLabel}', 'c.preferences', 'c.language', 'c.theme', '<LangSwitch />', '<ThemeSwitch legacy={legacyTheme} />', 'c.signOut', 'items.map(']) assert.ok(menu.includes(needle), needle)
})

test('teclado: Enter/Espacio abre, Escape cierra y devuelve el foco al botón, salir del panel con Tab o un clic fuera lo cierra', () => {
  for (const needle of ['aria-expanded={open}', 'aria-controls={id}', "event.key === 'Escape'", 'button.current?.focus()', "document.addEventListener('mousedown'", 'onBlur={', 'hidden={!open}']) assert.ok(menu.includes(needle), needle)
})

test('cerrar sesión: misma lógica que el antiguo «Salir» (guardia de borradores, revocación en el servidor, vuelta al inicio) en un hook reutilizable', () => {
  assert.ok(hook.includes("leaveBlocked('/', 'action')") && hook.includes('await signOut(BACKEND)') && hook.includes("navigate('/', { replace: true })"))
  assert.ok(menu.includes('useSignOut()') && menu.includes('disabled={leaving}') && menu.includes('aria-busy={leaving}'))
})

test('textos: «Salir» pasa a «Cerrar sesión» (aprobado en ES-359), existe el rol «Persona»/«Person» y no hay otros textos nuevos', () => {
  assert.equal(shellCopy.es.signOut, 'Cerrar sesión'); assert.equal(shellCopy.en.signOut, 'Sign out')
  assert.equal(shellCopy.es.rolePerson, 'Persona'); assert.equal(shellCopy.en.rolePerson, 'Person')
  assert.equal(shellCopy.es.userMenu, 'Menú de usuario'); assert.equal(shellCopy.es.preferences, 'Preferencias')
  assert.deepEqual(Object.keys(shellCopy.es).sort(), Object.keys(shellCopy.en).sort())
})

test('CSS: solo tokens (sin colores fijos), objetivos táctiles y selección visible con ✓ además del relleno', () => {
  const css = read('../src/shell/shell.css')
  const part = css.slice(css.indexOf('/* menú de cuenta (ES-359'), css.indexOf('/* cuerpo y barra lateral de administración */'))
  assert.ok(part.length > 500)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(part), false)
  assert.ok(part.includes('min-height: var(--cg-touch)') && part.includes("content: '✓ '"))
})
