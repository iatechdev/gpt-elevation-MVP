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
  assert.match(page, /<div className="chat-input-bar">\s*<ChatInput chat=\{chat\} \/>/)
  assert.match(css, /\.chat-shell \{ height: 100dvh;/); assert.match(css, /\.chat-scroll \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/)
  assert.match(css, /\.chat-input-bar \{[^}]*max-height: 70dvh/)
  assert.doesNotMatch(css, /\.chat-input-bar \{[^}]*position: fixed/)
})

test('ES-123 diseño: «Mi progreso» y «Cerrar sesión» salen en la cabecera con etiqueta accesible; ya no hay un ícono suelto dentro de la conversación', () => {
  const page = read('../src/pages/ChatPage.tsx')
  assert.match(page, /title=\{copy\[lang\]\.progress\}\s*aria-label=\{copy\[lang\]\.progress\}/)
  assert.match(page, /title=\{copy\[lang\]\.signOut\} aria-label=\{copy\[lang\]\.signOut\}/)
  assert.equal((page.match(/navigate\('\/app\/progress'\)/g) || []).length, 1)
  assert.ok(page.indexOf("navigate('/app/progress')") < page.indexOf('<main className="chat-main">')) // dentro de la cabecera, antes de la conversación
})

test('ES-123 selector del diario: botón plegable con aria-expanded/aria-controls, Esc lo cierra y devuelve el foco; el texto de consentimiento se conserva dentro del panel', () => {
  const controls = read('../src/space/ChatControls.tsx')
  assert.match(controls, /aria-expanded=\{chat\.picker\} aria-controls="chat-diary-panel"/)
  assert.match(controls, /id="chat-diary-panel"/); assert.match(controls, /event\.key === 'Escape'/); assert.match(controls, /toggle\.current\?\.focus\(\)/)
  const panel = controls.slice(controls.indexOf('id="chat-diary-panel"'), controls.indexOf('role="status" aria-live="polite"'))
  for (const key of ['c.contextLimit', 'c.contextPrivacy', 'c.deselect', 'c.limit', 'c.choose', 'c.none', 'c.howTitle', 'c.close']) assert.ok(panel.includes(key), key)
  const outside = controls.slice(0, controls.indexOf('id="chat-diary-panel"'))
  for (const key of ['c.contextLimit', 'c.contextPrivacy', 'c.deselect']) assert.ok(!outside.includes(key), `${key} no debe estar siempre visible`)
  assert.match(controls, /<span className="space-note">\{c\.ai\}<\/span>/) // la identificación de la IA sigue visible
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
  assert.doesNotMatch(controls.slice(0, controls.indexOf('id="chat-diary-panel"')), /c\.contextLimit/) // el 2.000 sigue solo dentro del panel plegable
})

test('ES-123 adenda 2 (opción 2): el dashboard ya no embebe el chat y ofrece el acceso a /app/chat, con los enlaces separados', () => {
  const dash = read('../src/pages/UserDashboard.tsx')
  assert.doesNotMatch(dash, /usePersonalChat|ChatInput|ChatContext|calc\(100vh - 100px\)|position: 'sticky', top: 76/)
  assert.match(dash, /href="\/app\/chat"[^>]*>\{copy\[lang\]\.chatLink\}/)
  assert.match(dash, /flexWrap: 'wrap', gap: '0\.25rem 1\.5rem' \}\}>\s*<a href="\/app\/route-catalog"/)
  for (const key of ['chatLink', 'chatLinkHint']) { assert.ok(copy.es[key] && copy.en[key], key); assert.notEqual(copy.es[key], copy.en[key], key) }
})

test('ES-123 textos: el selector, «Mi progreso» y el check-out existen en ES y EN, sin voseo ni ternarios de idioma en el chat de la persona', () => {
  for (const key of ['diaryNone', 'diaryCount', 'howTitle', 'close', 'progress', 'signOut']) { assert.ok(copy.es[key] && copy.en[key], key); assert.notEqual(copy.es[key], copy.en[key], key) }
  assert.match(copy.es.diaryCount, /\{n\}/); assert.match(copy.en.diaryCount, /\{n\}/)
  for (const key of ['checkout_label', 'checkout_title', 'checkout_hint', 'checkout_rating', 'checkout_signout', 'checkout_skip', 'star_1', 'star_2', 'star_3', 'star_4', 'star_5']) assert.ok(es[key] && en[key], key)
  for (const key of ['star_1', 'star_2', 'star_3', 'star_4', 'star_5']) assert.notEqual(es[key], en[key], key) // antes las estrellas salían siempre en español
  assert.equal(es.checkout_hint, 'Tómate un momento antes de cerrar.')
  const page = read('../src/pages/ChatPage.tsx')
  const person = page.slice(page.indexOf('{/* Mensajes */}'), page.indexOf('{/* Panel Admin */}')) // todo lo que ve la persona; el panel de administración queda fuera de este ticket
  assert.doesNotMatch(person, /lang === 'es' \?/); assert.doesNotMatch(person, /Muy mala|Tomá|querés|CHECK-OUT<\/p>/)
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort())
  for (const key of Object.keys(copy.es)) assert.ok(key in copy.en, `copy.en.${key}`)
  for (const key of Object.keys(copy.en)) assert.ok(key in copy.es, `copy.es.${key}`)
})
