// ES-342 (PARTE B, diseño aprobado en el ticket): menú del chat reagrupado (B1) y barra superior con las piezas de Cartografía (B2). Pruebas estructurales; el navegador real lo mide scripts/es342b-chat-menu.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const menu = read('../src/space/ChatMenu.tsx'), bar = read('../src/space/ChatBar.tsx'), page = read('../src/pages/ChatPage.tsx'), css = read('../src/space/space.css'), dialog = read('../src/cartografia/interactive.tsx')
const order = (source, parts) => parts.map(part => source.indexOf(part))

test('ES-342 B1: el orden del menú es Conversación → Principal → «Menú de usuario» → Preferencias, con «Cerrar» arriba y «Cerrar sesión» como pie', () => {
  const idx = order(menu, ['{c.conversation}</h3>', '{shell.main}</h3>', 'className="chat-menu-disc"', '{shell.preferences}</h3>'])
  assert.ok(idx.every(i => i > 0), 'faltan grupos: ' + idx)
  assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'orden de los grupos')
  assert.match(menu, /headerAction=\{<Button variant="ghost" onClick=\{onClose\}>\{c\.close\}<\/Button>\}/) // «Cerrar» en la cabecera fija
  assert.match(menu, /actions=\{<Button variant="danger" onClick=\{\(\) => \{ onClose\(\); onCheckout\(\) \}\}>\{c\.signOut\}<\/Button>\}/) // pie fijo de peligro; abre el check-out como antes
  assert.doesNotMatch(menu, /PreferencesBar/, 'idioma y tema solo en «Preferencias» (no el bloque suelto del marco)')
  assert.match(menu, /<LangSwitch \/>/); assert.match(menu, /<ThemeSwitch legacy=\{legacy\} \/>/)
})

test('ES-342 B1: «Mi progreso» una sola vez y «Menú de usuario» plegado, como botón con aria-expanded/aria-controls y que vuelve a plegarse al reabrir', () => {
  assert.match(menu, /PERSON_MENU\.filter\(item => item\.label !== 'progress'\)/)
  assert.equal((menu.match(/c\.progress/g) || []).length, 1)
  assert.match(menu, /useState\(false\)/); assert.match(menu, /aria-expanded=\{more\} aria-controls=\{ids\.more\}/); assert.match(menu, /hidden=\{!more\}/)
  assert.match(menu, /function MenuBody/) // el estado vive en el cuerpo, que solo existe con el Dialog abierto: se pliega al reabrir
  assert.match(menu, /<Dialog sheet open=\{open\}/)
})

test('ES-342 B1: sin textos nuevos (todo sale de copy.ts, shell/copy.ts e i18n) y los grupos se anuncian con h3 + role=group/aria-labelledby', () => {
  const jsx = menu.split('\n').filter(line => !line.trim().startsWith('//')).join('\n').replace(/=>/g, '').replace(/<[^>]*>/g, '<>')
  assert.doesNotMatch(jsx, /<>\s*[A-Za-záéíóú]{3,}/, 'texto literal en el menú')
  assert.match(menu, /role="group" aria-labelledby=\{ids\.conv\}/); assert.match(menu, /role="group" aria-labelledby=\{ids\.prefs\}/)
})

test('ES-342 B1: el Dialog con headerAction fija cabecera y pie y solo el cuerpo se desplaza; en escritorio la hoja va centrada', () => {
  assert.match(dialog, /headerAction\?: ReactNode/); assert.match(dialog, /data-fixed=\{headerAction \? '' : undefined\}/)
  assert.match(dialog, /className="cg-dialog__head"/); assert.match(dialog, /className="cg-dialog__body"/)
  assert.match(css, /\.cg-dialog\[data-sheet\]\[data-fixed\]\[open\] \{ display: flex; flex-direction: column; overflow: hidden; \}/)
  assert.match(css, /\.cg-dialog__body \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/)
  assert.match(css, /@media \(min-width: 901px\) \{ \.cg-dialog\[data-sheet\]\[data-fixed\] \{ margin: auto; \} \}/)
  assert.doesNotMatch(css, /chat-menu-frame/, 'el bloque que se ocultaba en escritorio ya no existe: el menú es igual en todos los anchos')
})

test('ES-342 B2: ☰ 46×46 con nombre accesible «Menú», un solo h1 visible, «Pausar» ghost de Cartografía y barra de uso con --cg-mark', () => {
  assert.match(page, /className="chat-menu-btn" aria-label=\{copy\[lang\]\.menu\}/); assert.match(page, /<span aria-hidden="true">☰<\/span>/)
  assert.match(css, /\.chat-menu-btn \{ min-width: var\(--cg-touch\); min-height: var\(--cg-touch\);/)
  assert.match(css, /@media \(min-width: 901px\) \{ \.chat-menu-btn__w \{ display: inline; \} \}/) // ☰ + palabra solo a ≥ 901 px
  assert.match(bar, /<h1>\{c\.conversation\}<\/h1>/); assert.doesNotMatch(page, /<h1/); assert.doesNotMatch(bar, /<h2>/)
  assert.match(css, /\.space-chatbar-head h1 \{ margin: 0; font: 700 1\.05rem \/ 1\.1 var\(--cg-font-cond\); text-transform: uppercase;/)
  assert.match(bar, /className="cg-btn cg-btn--ghost chat-pause" aria-pressed=\{paused\}/)
  assert.match(css, /\.chat-shell \.space-meter:not\(\.space-meter-full\) i \{ background: var\(--cg-mark\); \}/)
  assert.match(css, /\.chat-shell \.space-usage-text, \.chat-menu \.space-usage-text \{ font-family: var\(--cg-font-sans\);/)
})

test('ES-342 B1/B2: el CSS nuevo usa solo tokens (sin colores fijos ni estilos en línea)', () => {
  const block = css.slice(css.indexOf('/* ES-342 (PARTE B'))
  assert.ok(block.length > 500)
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(/)
  assert.doesNotMatch(menu, /style=\{\{/)
})
