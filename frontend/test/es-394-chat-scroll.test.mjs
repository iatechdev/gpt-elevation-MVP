// ES-394: el chat sigue la respuesta (política de desplazamiento) y el marco con barra lateral ya no apila la barra sobre el chat. Comportamiento real en navegador: scripts/es394-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const page = read('../src/pages/ChatPage.tsx'); const hook = read('../src/space/useThreadScroll.ts'); const css = read('../src/space/space.css'); const copy = read('../src/space/copy.ts')

test('ES-394: la página ya no usa scrollIntoView (movía también el marco y la ventana) y usa el hook del hilo', () => {
  assert.doesNotMatch(page, /scrollIntoView|chatEndRef/)
  assert.match(page, /useThreadScroll\(scrollRef, transcriptRef, messages\.length, sending, chat\.loaded\)/)
  assert.match(page, /ref=\{scrollRef\} onScroll=\{thread\.onScroll\} onWheel=\{thread\.onWheel\} onTouchMove=\{thread\.onTouchMove\} onKeyDown=\{thread\.onKeyDown\} onPointerDown=\{thread\.onPointerDown\} className="chat-scroll"/)
})

test('ES-394: política aprobada: margen de 80 px, solo mueve el contenedor del hilo, respuesta larga desde su inicio, reduced-motion sin animación', () => {
  assert.match(hook, /NEAR_BOTTOM_PX = 80/)
  assert.doesNotMatch(hook, /scrollIntoView/)
  assert.match(hook, /el\.scrollTo\(/)
  assert.match(hook, /prefers-reduced-motion: reduce/)
  assert.match(hook, /'auto' : 'smooth'/)
  assert.match(hook, /lastBot/) // alinea con el inicio de la última respuesta
  assert.match(hook, /Math\.min\(maxTop, start\)/) // corta: hasta el final; larga: su inicio
  assert.match(hook, /!following\.current\) \{ return \}/) // quien subió no es arrastrado
})

test('ES-394: control «Ir al último mensaje»: ranura viva de alto 0, botón con nombre accesible, textos ES/EN', () => {
  assert.match(page, /<div className="chat-jump-slot" aria-live="polite">\{thread\.away && messages\.length > 0 && <button type="button" className="chat-jump" onClick=\{thread\.jump\}>/)
  assert.match(page, /<span aria-hidden="true">↓<\/span> \{copy\[lang\]\.jumpLatest\}/)
  assert.match(copy, /jumpLatest: 'Ir al último mensaje'/); assert.match(copy, /jumpLatest: 'Jump to latest message'/)
  assert.match(css, /\.chat-jump-slot \{ position: sticky; bottom: 0; height: 0;/)
  assert.match(css, /\.chat-jump:focus-visible \{ outline: var\(--cg-focus\) solid var\(--cg-mark\)/)
  assert.match(css, /\.chat-jump \{[^}]*min-height: var\(--cg-touch\)/)
})

test('ES-394: el hilo gestiona su desplazamiento (sin ancla automática) y, con barra lateral (>900 px), el chat conserva la rejilla de dos columnas', () => {
  assert.match(css, /\.chat-scroll \{ overflow-anchor: none; \}/)
  assert.match(css, /@media \(min-width: 901px\) \{\s*\.cg-frame:has\(\.chat-shell\) > \.cg-body--wideside \{ display: grid; grid-template-rows: minmax\(0, 1fr\); align-items: stretch; \}\s*\.cg-frame:has\(\.chat-shell\) > \.cg-body--wideside > \.cg-side--groups \{ min-height: 0; overflow-y: auto; \}/)
})
