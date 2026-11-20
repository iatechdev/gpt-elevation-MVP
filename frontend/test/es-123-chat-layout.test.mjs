// ES-123: chat con la conversación como área principal, selector del diario plegable y textos del chat solo por i18n (ES/EN).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { copy } from '../src/space/copy.ts'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
// es.ts / en.ts importan módulos sin extensión: se leen como texto (clave: 'valor' de primer nivel)
const dict = (path) => Object.fromEntries([...read(path).matchAll(/^  (\w+): '((?:[^'\\]|\\.)*)',?\s*$/gm)].map(m => [m[1], m[2]]))
const es = dict('../src/i18n/es.ts'); const en = dict('../src/i18n/en.ts')

test('ES-123 diseño: la conversación tiene scroll propio y la caja de mensaje va en el flujo, sin barra fija ni relleno de 300 px', () => {
  const page = read('../src/pages/ChatPage.tsx'); const css = read('../src/space/space.css')
  assert.doesNotMatch(page, /paddingBottom: 300/); assert.doesNotMatch(page, /position: 'fixed', bottom: 0/)
  assert.match(page, /className="chat-scroll" role="region" aria-label=\{copy\[lang\]\.conversation\} tabIndex=\{0\}/)
  assert.match(page, /<div className="chat-input-bar">\s*<ChatInput chat=\{chat\} enterSends=\{enterSends\} \/>/)
  // ES-333 (PR 2): el contenedor del chat mide el alto de la ventana en columna (100dvh, sin constantes), el hilo es el único que se desplaza y la caja no se encoge ni se fija.
  assert.match(css, /\.chat-shell \{ height: 100dvh;/); assert.match(css, /\.cg-main \.chat-scroll \{ flex: 1 1 0; min-height: 0; overflow-y: auto;/)
  assert.match(css, /\.chat-input-bar \{[^}]*max-height: 70dvh/); assert.match(css, /\.chat-top, \.chat-input-bar \{ flex: none; max-height: none; overflow: visible; \}/)
  assert.doesNotMatch(css, /\.chat-input-bar \{[^}]*position: fixed/)
})

test('ES-123 diseño: «Mi progreso» y «Cerrar sesión» salen en el menú con texto visible; ya no hay un ícono suelto dentro de la conversación', () => {
  // ES-333 (PR 2): las acciones pasan de íconos en la cabecera propia a botones con TEXTO en el menú (hoja inferior); se conserva la etiqueta accesible (ahora el propio texto) y un solo camino a «Mi progreso».
  const page = read('../src/pages/ChatPage.tsx'); const menu = read('../src/space/ChatMenu.tsx')
  assert.match(menu, /<button type="button" onClick=\{pick\(onProgress\)\}>\{c\.progress\}<\/button>/)
  assert.match(menu, /<Button variant="danger" onClick=\{\(\) => \{ onClose\(\); onCheckout\(\) \}\}>\{c\.signOut\}<\/Button>/) // ES-342 (B1): «Cerrar sesión» es el pie fijo del menú (botón de peligro)
  assert.equal((page.match(/navigate\('\/app\/progress'\)/g) || []).length, 1)
  assert.match(page, /onProgress=\{\(\) => \{ if \(chat\.canLeave\(\)\) navigate\('\/app\/progress'\) \}\}/) // sigue pidiendo confirmación si hay un envío sin confirmar
  assert.ok(!page.includes('<header'), 'la cabecera propia (marca, idioma, íconos) ya no existe: el marco y el menú la reemplazan')
})

test('ES-123 selector del diario: botón que abre la hoja (aria-expanded), Esc la cierra y devuelve el foco; el texto de consentimiento se conserva dentro de la hoja', () => {
  // ES-333 (PR 2): el panel plegable pasa a ser una hoja inferior (Dialog nativo: Esc por onCancel/onClose, Tab atrapado y foco devuelto al botón «Diario»; lo prueba es-236). Se conservan los textos y el bloqueo.
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /aria-haspopup="dialog" aria-expanded=\{chat\.picker\}/)
  assert.match(controls, /<Dialog sheet open=\{chat\.picker\} onClose=\{closePicker\}/); assert.match(controls, /const closePicker = \(\) => chat\.setPicker\(false\)/)
  const panel = controls.slice(controls.indexOf('<Dialog sheet open={chat.picker}'), controls.indexOf('role="status" aria-live="polite" className="space-note chat-counter"'))
  for (const key of ['c.contextLimit', 'c.contextPrivacy', 'c.deselect', 'c.limit', 'c.choose', 'c.none', 'c.howTitle', 'c.close']) assert.ok(panel.includes(key), key)
  const outside = controls.slice(0, controls.indexOf('<Dialog sheet open={chat.picker}'))
  for (const key of ['c.contextLimit', 'c.contextPrivacy', 'c.deselect']) assert.ok(!outside.includes(key), `${key} no debe estar siempre visible`)
  // ES-333 (PR 2): «Asistente de IA» (copy.ai) deja el compositor y pasa a la etiqueta de CADA respuesta de la IA («✦ ELEVATION · Asistente de IA»): la identificación sigue visible junto a cada texto de la IA.
  const page = read('../src/pages/ChatPage.tsx'); assert.match(page, /<span className="chat-msg-who">✦ \{logo\} · \{ai\}<\/span>/); assert.match(page, /<span className="chat-msg-who">✦ \{t\('logo'\)\} · \{copy\[lang\]\.ai\}<\/span>/)
  assert.match(controls, /blocked\.paused \|\| blocked\.exhausted/); assert.match(controls, /\|\| off/) // escritura bloqueada al pausar o agotar (ES-112)
})

test('ES-123 adenda 1: etiqueta «Mensaje» sin cifra, contador desde 3.600 con aria-live y límite de 2.000 en lenguaje claro dentro del panel', () => {
  assert.equal(copy.es.composer, 'Mensaje'); assert.equal(copy.en.composer, 'Message')
  for (const key of ['counter', 'counterMax']) { assert.ok(copy.es[key] && copy.en[key], key); assert.notEqual(copy.es[key], copy.en[key], key) }
  assert.match(copy.es.counter, /\{n\}/); assert.match(copy.en.counter, /\{n\}/); assert.match(copy.es.counterMax, /4\.000/); assert.match(copy.en.counterMax, /4,000/)
  assert.doesNotMatch(copy.es.counterMax, /Llegaste|tenés|querés/) // sin voseo
  assert.match(copy.es.contextLimit, /2\.000/); assert.match(copy.en.contextLimit, /2,000/)
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /const COUNTER_FROM = 3600/); assert.match(controls, /maxLength=\{MAX_MESSAGE\}/)
  assert.match(controls, /role="status" aria-live="polite" className="space-note chat-counter"/)
  assert.doesNotMatch(controls.slice(0, controls.indexOf('<Dialog sheet open={chat.picker}')), /c\.contextLimit/) // el 2.000 sigue solo dentro de la hoja del diario
})

test('ES-123 adenda 2 (opción 2): el dashboard ya no embebe el chat y ofrece el acceso a /app/chat, con los enlaces separados', () => {
  const dash = read('../src/pages/UserDashboard.tsx')
  assert.doesNotMatch(dash, /usePersonalChat|ChatInput|ChatContext|calc\(100vh - 100px\)|position: 'sticky', top: 76/)
  assert.match(dash, /to="\/app\/chat">\{copy\[lang\]\.chatLink\}/) // ES-329: el acceso es un <Link> del marco (antes <a href>)
  assert.match(dash, /<nav className="pc-links"[\s\S]*<Link className="pc-link" to="\/app\/compass">[\s\S]*<Link className="pc-link" to="\/app\/route-catalog">/) // ES-329: los enlaces secundarios van en una fila (nav), separados
  for (const key of ['chatLink', 'chatLinkHint']) { assert.ok(copy.es[key] && copy.en[key], key); assert.notEqual(copy.es[key], copy.en[key], key) }
})

test('ES-123 textos: el selector, «Mi progreso» y el check-out existen en ES y EN, sin voseo ni ternarios de idioma en el chat de la persona', () => {
  for (const key of ['diaryNone', 'diaryCount', 'howTitle', 'close', 'progress', 'signOut']) { assert.ok(copy.es[key] && copy.en[key], key); assert.notEqual(copy.es[key], copy.en[key], key) }
  assert.match(copy.es.diaryCount, /\{n\}/); assert.match(copy.en.diaryCount, /\{n\}/)
  for (const key of ['checkout_label', 'checkout_title', 'checkout_hint', 'checkout_rating', 'checkout_signout', 'checkout_skip', 'star_1', 'star_2', 'star_3', 'star_4', 'star_5']) assert.ok(es[key] && en[key], key)
  for (const key of ['star_1', 'star_2', 'star_3', 'star_4', 'star_5']) assert.notEqual(es[key], en[key], key) // antes las estrellas salían siempre en español
  assert.equal(es.checkout_hint, 'Tómate un momento antes de cerrar.')
  const page = read('../src/pages/ChatPage.tsx')
  const person = page.slice(page.indexOf('{/* Mensajes */}')) // todo lo que ve la persona (ES-333 PR 3: ya no hay panel de administración en el chat)
  assert.doesNotMatch(person, /lang === 'es' \?/); assert.doesNotMatch(person, /Muy mala|Tomá|querés|CHECK-OUT<\/p>/)
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort())
  for (const key of Object.keys(copy.es)) assert.ok(key in copy.en, `copy.en.${key}`)
  for (const key of Object.keys(copy.en)) assert.ok(key in copy.es, `copy.es.${key}`)
})
