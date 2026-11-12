// ES-199: las burbujas del chat están memoizadas y la última (con el aviso de respuesta cortada) se repinta; teclear no vuelve a pintar el historial.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const page = readFileSync(resolve(here, '../src/pages/ChatPage.tsx'), 'utf8')

test('ES-199: ChatBubble es un componente memoizado y recibe solo valores primitivos (rol, texto, etiquetas)', () => {
  assert.match(page, /const ChatBubble = memo\(function ChatBubble\(\{ role, text, you, logo, children \}: \{ role: 'user' \| 'bot'; text: string; you: string; logo: string; children\?: ReactNode \}\)/)
  assert.match(page, /<ChatBubble role=\{msg\.role\} text=\{msg\.text\} you=\{copy\[lang\]\.you\} logo=\{t\('logo'\)\}>/)
})

test('ES-199: el aviso de respuesta cortada solo va como hijo de la última burbuja del asistente (las demás no cambian de props)', () => {
  assert.match(page, /\{i === messages\.length - 1 && msg\.role !== 'user' && <TruncatedNotice chat=\{chat\} \/>\}/)
  assert.equal((page.match(/<TruncatedNotice /g) ?? []).length, 1)
})

test('ES-199: el historial ya no se recorre con el marcado de cada burbuja dentro de ChatPage', () => {
  assert.doesNotMatch(page, /messages\.map\(\(msg, i\) => \(\s*<div key=\{i\}>\s*\{msg\.role === 'user'/)
})
