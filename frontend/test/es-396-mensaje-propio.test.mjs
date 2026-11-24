// ES-396: el mensaje propio se ve al enviarlo («Enviando…» / «Sin confirmar») y se concilia con el historial sin duplicarse. Comportamiento real en navegador: scripts/es396-check.cjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const page = read('../src/pages/ChatPage.tsx'); const hook = read('../src/space/usePersonalChat.ts'); const scroll = read('../src/space/useThreadScroll.ts'); const css = read('../src/space/space.css'); const copy = read('../src/space/copy.ts')
const confirm = hook.slice(hook.indexOf('const confirm = async'), hook.indexOf('const post = async'))

test('ES-396: confirm() aplica el historial y cierra el envío pendiente en el mismo bloque síncrono (un solo render)', () => {
  assert.match(confirm, /const rows = await history\(token\)\n    if \(!current\(\)\) return\n    setMessages\(rows\); setLoaded\(true\)/)
  assert.doesNotMatch(confirm.slice(confirm.indexOf('setMessages(rows)')), /\bawait\b/) // sin esperas entre setMessages y setIntent(null)
  assert.equal((confirm.match(/setIntent\(null\); setSentBase\(null\)/g) ?? []).length, 2)
})

test('ES-396: la burbuja propia sale del envío pendiente y se omite cuando el historial ya trae mensajes nuevos', () => {
  assert.match(page, /chat\.intent && \(chat\.sentBase === null \|\| messages\.length <= chat\.sentBase\) && \(/)
  assert.match(page, /<PendingBubble text=\{chat\.intent\.message\}/)
  assert.match(page, /state=\{sending \|\| chat\.waiting \? copy\[lang\]\.sending : copy\[lang\]\.unconfirmed\}/)
  assert.match(hook, /setIntent\(body\); setSentBase\(messages\.length\)/)
  assert.equal((hook.match(/setSentBase\(messages\.length\)/g) ?? []).length, 2) // enviar y «Continuar»
})

test('ES-396: sin textos nuevos (se reutilizan «Enviando…» y «Sin confirmar» ES/EN) y el estado usa solo tokens', () => {
  assert.match(copy, /sending: 'Enviando…'/); assert.match(copy, /unconfirmed: 'Sin confirmar'/); assert.match(copy, /sending: 'Sending…'/); assert.match(copy, /unconfirmed: 'Unconfirmed'/)
  assert.match(css, /\.chat-msg-state \{[^}]*color: var\(--cg-muted\)/)
})

test('ES-396: «Sin confirmar» no borra el texto (la caja conserva el borrador; solo confirm() lo limpia) y el desplazamiento no deja el inicio del mensaje pendiente fuera de vista', () => {
  assert.doesNotMatch(hook.slice(hook.indexOf('const post = async'), hook.indexOf('const stop = ')), /setInput\(''\)/)
  assert.match(scroll, /\.chat-msg-state/); assert.match(scroll, /Math\.min\(max, pending\.getBoundingClientRect\(\)/)
})
