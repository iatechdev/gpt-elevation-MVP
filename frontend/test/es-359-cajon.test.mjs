// ES-359 (PR3): cabecera móvil de 56 px y cajón de navegación (NavDrawer). Pruebas estructurales; el navegador real lo mide scripts/es359-cajon.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const drawer = read('../src/shell/NavDrawer.tsx'), frame = read('../src/shell/Frame.tsx'), frames = read('../src/shell/frames.tsx'), css = read('../src/shell/shell.css'), copy = read('../src/shell/copy.ts')

test('ES-359 PR3: el cajón es un <dialog> modal con foco de vuelta al botón, Esc, velo y sin desplazar el fondo', () => {
  assert.match(drawer, /dialog\.showModal\(\)/); assert.match(drawer, /opener\.current\?\.focus\(\)/)
  assert.match(drawer, /onCancel=\{event => \{ event\.preventDefault\(\); onClose\(\) \}\}/) // Esc
  assert.match(drawer, /event\.target === document\.documentElement \|\| event\.target === ref\.current/) // velo
  assert.match(drawer, /classList\.add\(LOCK\)/); assert.match(drawer, /classList\.remove\(LOCK\)/); assert.match(css, /html\.cg-scroll-lock \{ overflow: hidden; \}/)
  assert.match(drawer, /aria-labelledby=\{titleId\}/)
})

test('ES-359 PR3: contenido del cajón = cabecera fija (Menú, nombre y rol, Cerrar), extra, grupos, Preferencias y pie fijo «Cerrar sesión» (useSignOut)', () => {
  for (const part of ['{c.menu}', '{c.close}', '{extra}', '{c.preferences}', '<LangSwitch />', '<ThemeSwitch legacy={legacyTheme} />', '{leaving ? c.signingOut : c.signOut}', 'useSignOut()']) assert.ok(drawer.includes(part), part)
  assert.match(drawer, /leaveBlocked\(href\)/) // un borrador sin guardar pregunta antes de navegar
  assert.match(css, /\.cg-drawer__foot \{ flex: none;/); assert.match(css, /\.cg-drawer__body \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/)
})

test('ES-359 PR3: en ≤ 900 px el marco con `drawer` dibuja marca + «☰ Menú» (sin navegación ni preferencias sueltas) y a escritorio queda igual', () => {
  assert.match(frame, /const compact = useNarrowHeader\(\) && !!drawer/)
  assert.match(frame, /\{compact \? <button/)
  assert.match(frame, /className="cg-menubtn" aria-haspopup="dialog" aria-expanded=\{drawerOpen\}/)
  assert.match(frame, /<span className="cg-menubtn__icon" aria-hidden="true" \/> \{c\.menu\}/)
  assert.match(css, /\.cg-header\[data-compact\] \{ flex-wrap: nowrap; min-height: 56px;/)
  assert.match(frames, /drawer=\{\{ groups: \[\{ title: null, items: PERSON_NAV \}, \{ title: c\.userMenu, items: PERSON_MENU \}\]/)
})

test('ES-359 PR3: sin textos nuevos (Menú y Cerrar ya existían en el chat) y el CSS usa solo tokens', () => {
  assert.match(copy, /menu: 'Menú', close: 'Cerrar'/); assert.match(copy, /menu: 'Menu', close: 'Close'/)
  const block = css.slice(css.indexOf('ES-359 (PR3)'))
  assert.ok(block.length > 800); assert.doesNotMatch(block.replace(/rgb\(14 22 19 \/ 0\.55\)/, ''), /#[0-9a-fA-F]{3,8}\b|rgb\(/)
  assert.doesNotMatch(drawer, /style=\{\{/)
})

test('ES-359 PR3: el icono ☰ del botón «Menú» es el escape CSS de U+2630 (no bytes corruptos como «³0») y no queda ningún carácter de sustitución en los archivos del cajón', () => {
  const BS = String.fromCharCode(92) // la barra invertida del escape CSS
  assert.ok(css.includes(`.cg-menubtn__icon::before { content: "${BS}2630"; }`), 'el contenido del icono debe ser el escape CSS de U+2630')
  for (const [name, text] of [['shell.css', css], ['NavDrawer.tsx', drawer], ['Frame.tsx', frame], ['frames.tsx', frames], ['copy.ts', copy]]) {
    assert.ok(!text.includes('³'), `${name}: «³» (escape corrupto)`); assert.ok(!text.includes('�'), `${name}: carácter de sustitución`)
  }
})
